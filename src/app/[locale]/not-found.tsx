import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("description")}</p>
      <Button asChild>
        <Link href={`/${locale}/dashboard`}>{t("backToDashboard")}</Link>
      </Button>
    </div>
  );
}
