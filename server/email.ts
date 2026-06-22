export type { EmailMessage, EmailProvider } from "./email/provider";
export { getEmailProvider } from "./email/factory";
export { buildLoginOtpTemplate } from "./email/templates/login-otp";
export { sendOtpLoginEmail } from "./email/service";
