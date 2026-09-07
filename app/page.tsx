import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

/** The portal has no public landing page: go to the dashboard or to sign in. */
export default async function RootPage() {
  const user = await getSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
