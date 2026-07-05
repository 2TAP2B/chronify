import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Puku Zeiterfassung",
    template: "%s | Puku Zeiterfassung",
  },
  description: "Zeiterfassung für Mitarbeiter",
  applicationName: "Puku Zeiterfassung",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Puku Zeiterfassung",
  },
  manifest: "/manifest",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
