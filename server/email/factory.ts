import "server-only";
import { env } from "@/lib/env";
import type { EmailProvider } from "./provider";
import { ConsoleEmailProvider } from "./console-provider";
import { ResendEmailProvider } from "./resend-provider";

let providerSingleton: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (providerSingleton) {
    return providerSingleton;
  }

  if (env.EMAIL_PROVIDER === "console") {
    providerSingleton = new ConsoleEmailProvider();
    return providerSingleton;
  }

  if (env.EMAIL_PROVIDER === "resend") {
    providerSingleton = new ResendEmailProvider();
    return providerSingleton;
  }

  // Keep the interface provider-based. SMTP provider can be introduced here later.
  throw new Error("EMAIL_PROVIDER=smtp is not implemented yet. Use EMAIL_PROVIDER=resend or console.");
}
