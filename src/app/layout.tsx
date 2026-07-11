import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: {
    default: "Puku Zeiterfassung",
    template: "%s | Puku Zeiterfassung",
  },
  description: "Zeiterfassung für Mitarbeiter",
  applicationName: "Puku Zeiterfassung",
  manifest: "/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Puku Zeiterfassung",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
