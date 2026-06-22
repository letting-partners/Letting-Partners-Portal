declare module "nodemailer" {
  interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
    [key: string]: unknown;
  }
  interface MailOptions {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }
  interface SentMessageInfo { messageId: string; }
  interface Transporter {
    sendMail(mailOptions: MailOptions): Promise<SentMessageInfo>;
  }
  function createTransport(options: TransportOptions | string): Transporter;
}
