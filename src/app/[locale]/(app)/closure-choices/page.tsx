import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInZone } from "@/lib/datetime";
import { ClosureChoiceCard } from "@/components/closures/closure-choice-card";
import { listUserChoices } from "@/server/services/business-closures";
import { requireUser } from "@/server/context";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ClosureChoicesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("closureChoices");
  const user = await requireUser();

  const choices = await listUserChoices(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {choices.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noChoices")}</p>
          </CardContent>
        </Card>
      ) : (
        choices.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle>{c.closure.name}</CardTitle>
              <CardDescription>
                {formatInZone(c.closure.from, "Europe/Berlin", "dd.MM.yyyy", appLocale)} –{" "}
                {formatInZone(c.closure.to, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClosureChoiceCard
                closureId={c.closureId}
                currentChoice={c.choice}
                name={c.closure.name}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
