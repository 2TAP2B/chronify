import { setRequestLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ImprintPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("imprintTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h2 className="font-semibold">{t("imprintNameLabel")}</h2>
            <p>{settings.imprintName ?? "—"}</p>
          </div>
          <div>
            <h2 className="font-semibold">{t("imprintAddressLabel")}</h2>
            <p className="whitespace-pre-line">{settings.imprintAddress ?? "—"}</p>
          </div>
          <div>
            <h2 className="font-semibold">{t("imprintContactLabel")}</h2>
            {settings.imprintEmail && <p>E-Mail: {settings.imprintEmail}</p>}
            {settings.imprintPhone && <p>Telefon: {settings.imprintPhone}</p>}
          </div>
          {!settings.imprintName && !settings.imprintAddress && !settings.imprintEmail && (
            <p className="text-muted-foreground">{t("imprintNotConfigured")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}