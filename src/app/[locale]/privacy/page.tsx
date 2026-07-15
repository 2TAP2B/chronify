import { setRequestLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("privacyTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h2 className="mb-1 font-semibold">{t("privacyController")}</h2>
            {settings.imprintName && <p>{settings.imprintName}</p>}
            {settings.imprintAddress && <p className="whitespace-pre-line">{settings.imprintAddress}</p>}
            {settings.imprintEmail && <p>E-Mail: {settings.imprintEmail}</p>}
            {settings.imprintPhone && <p>Telefon: {settings.imprintPhone}</p>}
          </section>

          <section>
            <h2 className="mb-1 font-semibold">{t("privacyDataTitle")}</h2>
            <p>{t("privacyDataDesc")}</p>
            <ul className="ml-4 mt-1 list-disc space-y-1">
              <li>{t("privacyDataName")}</li>
              <li>{t("privacyDataEmail")}</li>
              <li>{t("privacyDataTime")}</li>
              <li>{t("privacyDataVacation")}</li>
              <li>{t("privacyDataSick")}</li>
              <li>{t("privacyDataNfc")}</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1 font-semibold">{t("privacyPurposeTitle")}</h2>
            <p>{t("privacyPurposeDesc")}</p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold">{t("privacyRetentionTitle")}</h2>
            <p>{t("privacyRetentionDesc", { years: settings.retentionYears })}</p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold">{t("privacyRightsTitle")}</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>{t("privacyRightAccess")}</li>
              <li>{t("privacyRightRectification")}</li>
              <li>{t("privacyRightErasure")}</li>
              <li>{t("privacyRightPortability")}</li>
              <li>{t("privacyRightObject")}</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1 font-semibold">{t("privacyComplaintTitle")}</h2>
            <p>{t("privacyComplaintDesc")}</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}