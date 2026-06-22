import "server-only";
import type { EmailMessage, EmailProvider } from "./provider";

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      [
        "=== EMAIL (console provider) ===",
        `To: ${message.to}`,
        `From: ${message.from}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "=== END EMAIL ===",
      ].join("\n"),
    );
  }
}
