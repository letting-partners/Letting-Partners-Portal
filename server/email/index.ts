export type { EmailMessage, EmailProvider } from "./provider";
export { getEmailProvider } from "./factory";
export { buildLoginOtpTemplate } from "./templates/login-otp";
export { sendOtpLoginEmail } from "./service";
