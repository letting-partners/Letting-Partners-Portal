export const THEME_COOKIE = "lp_portal_theme";

export const THEME_OPTIONS = ["LIGHT", "DARK", "SYSTEM"] as const;
export type ThemePreference = (typeof THEME_OPTIONS)[number];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_OPTIONS as readonly string[]).includes(value);
}

/**
 * The value stamped on <html>. "SYSTEM" stamps nothing, which lets the
 * prefers-color-scheme rules in tokens.css decide.
 */
export function themeAttribute(preference: ThemePreference): "light" | "dark" | undefined {
  if (preference === "LIGHT") return "light";
  if (preference === "DARK") return "dark";
  return undefined;
}

export const THEME_LABELS: Record<ThemePreference, string> = {
  LIGHT: "Light",
  DARK: "Dark",
  SYSTEM: "System",
};
