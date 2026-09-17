import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { UserDetail } from "@/components/admin/user-detail";

type Props = {
  params: Promise<{ locale: string; userId: string }>;
};

export default async function AdminUserDetailPage({ params }: Props) {
  const { locale, userId } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const [user, workingModel] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        role: true,
        locale: true,
        federalState: true,
        timezone: true,
        breakMode: true,
        active: true,
        hireDate: true,
        nfcCardId: true,
        lastLoginAt: true,
      },
    }),
    db.workingModel.findFirst({
      where: {
        userId,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
      },
      orderBy: { validFrom: "desc" },
    }),
  ]);

  if (!user) redirect(`/${locale}/admin/users`);

  return (
    <UserDetail
      user={{
        ...user,
        hireDate: user.hireDate?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        isSelf: session.user.id === user.id,
      }}
      workingModel={
        workingModel
          ? {
              id: workingModel.id,
              weeklyTargetMinutes: workingModel.weeklyTargetMinutes,
              validFrom: workingModel.validFrom.toISOString(),
              validTo: workingModel.validTo?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "adminUsers" });
  return { title: t("title") };
}
