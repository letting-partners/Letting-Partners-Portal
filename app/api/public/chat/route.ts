import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { addVisitorMessage, ChatError, getVisitorThread, startCustomerConversation } from "@/services/chat";

/**
 * The public chat endpoint used by the website widget.
 *
 * Unauthenticated by necessity - visitors are anonymous - so it is rate
 * limited per visitor token and per IP, and it only ever returns the thread
 * belonging to the token that was presented.
 */

export const dynamic = "force-dynamic";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

function cors(response: NextResponse, origin: string | null): NextResponse {
  if (SITE_ORIGIN && origin === SITE_ORIGIN) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Headers", "content-type");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

const startSchema = z.object({
  visitorToken: z.string().max(120).optional().nullable(),
  /** The public slug, or the internal id. */
  propertyId: z.string().trim().max(240).optional().nullable(),
  name: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().max(254).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  message: z.string().trim().min(1, "Write a message.").max(4000),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const body = await request.json();
    const parsed = startSchema.parse(body);

    const limiterKey = parsed.visitorToken
      ? `chat:visitor:${parsed.visitorToken}`
      : `chat:ip:${clientIp(request)}`;

    const limit = await consumeRateLimit(limiterKey, RATE_LIMITS.customerChatPerVisitor);
    if (!limit.allowed) {
      return cors(
        NextResponse.json(
          { ok: false, error: "Too many messages. Please wait a moment." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
        ),
        origin,
      );
    }

    // An existing token with no new details is a follow-up on the same thread.
    if (parsed.visitorToken && !parsed.propertyId && !parsed.name) {
      const result = await addVisitorMessage(parsed.visitorToken, parsed.message);
      return cors(
        NextResponse.json({ ok: true, conversationId: result.conversationId, visitorToken: parsed.visitorToken }),
        origin,
      );
    }

    const result = await startCustomerConversation(parsed);
    return cors(NextResponse.json({ ok: true, ...result }), origin);
  } catch (error) {
    if (error instanceof ChatError) {
      return cors(NextResponse.json({ ok: false, error: error.message }, { status: 400 }), origin);
    }
    if (error instanceof z.ZodError) {
      return cors(
        NextResponse.json(
          { ok: false, error: error.issues[0]?.message ?? "Check the message." },
          { status: 400 },
        ),
        origin,
      );
    }

    console.error("Public chat endpoint failed:", error);
    return cors(
      NextResponse.json({ ok: false, error: "Unable to send the message." }, { status: 500 }),
      origin,
    );
  }
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const visitorToken = request.nextUrl.searchParams.get("visitorToken");

  if (!visitorToken) {
    return cors(NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 }), origin);
  }

  try {
    const thread = await getVisitorThread(visitorToken);
    if (!thread) {
      return cors(NextResponse.json({ ok: true, thread: null }), origin);
    }
    return cors(NextResponse.json({ ok: true, thread }), origin);
  } catch (error) {
    console.error("Public chat read failed:", error);
    return cors(
      NextResponse.json({ ok: false, error: "Unable to load the conversation." }, { status: 500 }),
      origin,
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return cors(new NextResponse(null, { status: 204 }), request.headers.get("origin"));
}
