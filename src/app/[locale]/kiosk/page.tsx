import { setRequestLocale, getLocale } from "next-intl/server";
import type { Metadata, Viewport } from "next";
import { KioskScreen } from "@/components/kiosk/kiosk-screen";

type Props = {
  params: Promise<{ locale: string }>;
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false,
  themeColor: "#2563eb",
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    manifest: "/kiosk-manifest",
    title: "Puku Kiosk",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Puku Kiosk",
    },
  };
}

export default async function KioskPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";

  return <KioskScreen locale={appLocale} />;
}