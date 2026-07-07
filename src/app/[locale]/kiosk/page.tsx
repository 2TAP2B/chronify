import { setRequestLocale, getLocale } from "next-intl/server";
import { KioskScreen } from "@/components/kiosk/kiosk-screen";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function KioskPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";

  return <KioskScreen locale={appLocale} />;
}