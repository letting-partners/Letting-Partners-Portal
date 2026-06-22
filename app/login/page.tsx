import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { LoginClient } from "./login-client";

type PageProps = {
  searchParams?: {
    email?: string | string[];
    reason?: string | string[];
  };
};

function readParam(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (session) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        role: true,
        isActive: true,
      },
    });

    if (user?.isActive) {
      redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
    }
  }

  const initialEmail = readParam(searchParams?.email) ?? "";
  const reason = readParam(searchParams?.reason);

  return <LoginClient initialEmail={initialEmail} reason={reason} />;
}
