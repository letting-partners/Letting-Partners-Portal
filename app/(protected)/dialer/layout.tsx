import { DialerLayoutShell } from "./dialer-layout-shell";

export default function DialerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DialerLayoutShell>{children}</DialerLayoutShell>;
}
