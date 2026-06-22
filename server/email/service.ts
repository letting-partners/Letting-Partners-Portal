import "server-only";
import { env } from "@/lib/env";
import { getEmailProvider } from "./factory";
import { buildLoginOtpTemplate } from "./templates/login-otp";
import { buildNumberSearchedTemplate } from "./templates/number-searched";

type SendOtpLoginEmailInput = {
  to: string;
  otpCode: string;
  expiresInMinutes: number;
};

export async function sendOtpLoginEmail(input: SendOtpLoginEmailInput): Promise<void> {
  const provider = getEmailProvider();
  const template = buildLoginOtpTemplate({
    otpCode: input.otpCode,
    expiresInMinutes: input.expiresInMinutes,
  });

  await provider.send({
    to: input.to,
    from: env.OTP_EMAIL_FROM,
    subject: template.subject,
    text: template.text,
  });
}

type SendNumberSearchedEmailInput = {
  to: string;
  ownerAgentName: string;
  searchingAgentName: string;
  landlordName: string;
  landlordPhone: string;
};

export async function sendNumberSearchedEmail(input: SendNumberSearchedEmailInput): Promise<void> {
  const provider = getEmailProvider();
  const template = buildNumberSearchedTemplate({
    ownerAgentName: input.ownerAgentName,
    searchingAgentName: input.searchingAgentName,
    landlordName: input.landlordName,
    landlordPhone: input.landlordPhone,
  });

  await provider.send({
    to: input.to,
    from: env.OTP_EMAIL_FROM,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}
