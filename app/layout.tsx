import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RootShell } from "@/components/root-shell";
import "./portal-globals.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--lp-font",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.lettingpartners.co.uk"),
  title: "Letting Partners | UK Property Letting & Management",
  description:
    "Premium property letting, management, tenant support, legal coordination, maintenance, mortgage consultancy, and development support across London and Birmingham.",
  keywords: [
    "letting agents London",
    "property management London",
    "landlord services Birmingham",
    "tenant services London",
    "UK property letting",
  ],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Letting Partners",
    title: "Letting Partners | UK Property Letting & Management",
    description:
      "Professional letting, management, tenant, legal, maintenance, mortgage, and development support across London and Birmingham.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}
