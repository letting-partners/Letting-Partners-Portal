export function ensureTestEnv(): void {
  const mutableEnv = process.env as Record<string, string | undefined>;

  mutableEnv.NODE_ENV = "test";
  mutableEnv.AUTH_SESSION_SECRET = "test-session-secret-1234567890-1234567890";
  mutableEnv.AUTH_COOKIE_NAME = "session_token";
  mutableEnv.AUTH_SESSION_TTL_HOURS = "12";

  mutableEnv.EMAIL_PROVIDER = "console";
  mutableEnv.OTP_EMAIL_FROM = "test@example.com";
  mutableEnv.OTP_TTL_MINUTES = "10";
  mutableEnv.OTP_MAX_SENDS_PER_WINDOW = "2";
  mutableEnv.OTP_SEND_WINDOW_MINUTES = "10";
  mutableEnv.OTP_MAX_VERIFY_ATTEMPTS_PER_CODE = "5";
  mutableEnv.OTP_MAX_VERIFY_ATTEMPTS_PER_WINDOW = "2";
  mutableEnv.OTP_VERIFY_WINDOW_MINUTES = "10";
  mutableEnv.ALLOW_ADMIN_PASSIVE_REVERT = "false";

  if (!mutableEnv.DATABASE_URL) {
    mutableEnv.DATABASE_URL =
      mutableEnv.TEST_DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/landlord_registry_test?schema=public";
  }
}

export function hasPostgresTestDatabase(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL);
}

export function usePostgresTestDatabase(): void {
  const mutableEnv = process.env as Record<string, string | undefined>;
  if (mutableEnv.TEST_DATABASE_URL) {
    mutableEnv.DATABASE_URL = mutableEnv.TEST_DATABASE_URL;
  }
}
