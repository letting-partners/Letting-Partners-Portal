import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { VerifyOtpClient } from "./verify-otp-client";

type PageProps = {
  searchParams?: {
    email?: string | string[];
  };
};

function readParam(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifyOtpPage({ searchParams }: PageProps) {
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

  return <VerifyOtpClient initialEmail={initialEmail} />;
}
