import "server-only";

export const OTP_REQUIRED_AFTER_INACTIVITY_HOURS = 12;
const OTP_REQUIRED_AFTER_INACTIVITY_MS =
  OTP_REQUIRED_AFTER_INACTIVITY_HOURS * 60 * 60 * 1000;

export function isOtpRequiredForLogin(
  lastActivityAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!lastActivityAt) {
    return true;
  }

  return now.getTime() - lastActivityAt.getTime() >= OTP_REQUIRED_AFTER_INACTIVITY_MS;
}
