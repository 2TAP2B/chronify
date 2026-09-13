import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ImportDialog } from "@/components/admin/import-dialog";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ImportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("import");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <ImportDialog users={users} />
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="mb-3 text-lg font-semibold">{t("howTo")}</h2>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>1. {t("step1")}</li>
          <li>2. {t("step2")}</li>
          <li>3. {t("step3")}</li>
          <li>4. {t("step4")}</li>
        </ol>
        <div className="mt-4 rounded-md bg-muted p-3">
          <p className="text-xs font-mono">
            Datum,Von,Bis
            <br />
            2026-07-01,08:00,16:00
            <br />
            2026-07-02,07:30,15:30
          </p>
        </div>
      </div>
    </div>
  );
}
