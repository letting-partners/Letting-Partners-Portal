import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import { listDailyReportsForRole } from "@/server/portal/reports";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  const reports = await listDailyReportsForRole({
    role: auth.user.role,
    userId: auth.user.id,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });

  return NextResponse.json({
    reports,
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "DAILY_REPORTS_ARE_AUTO_GENERATED" },
    { status: 405 },
  );
}