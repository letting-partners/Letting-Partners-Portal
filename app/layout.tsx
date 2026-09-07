import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { isThemePreference, themeAttribute, THEME_COOKIE } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--lp-font",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${publicEnv.NEXT_PUBLIC_COMPANY_NAME} Portal`,
    template: `%s | ${publicEnv.NEXT_PUBLIC_COMPANY_NAME} Portal`,
  },
  description: "Internal lettings CRM and property management portal.",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
  // The portal is staff-only; it must never appear in a search index.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1620" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the preference on the server means the correct theme is in the
  // first paint - no flash, and no blocking inline script.
  const cookieStore = await cookies();
  const stored = cookieStore.get(THEME_COOKIE)?.value;
  const preference = isThemePreference(stored) ? stored : "SYSTEM";

  return (
    <html lang="en" className={inter.variable} data-theme={themeAttribute(preference)}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
