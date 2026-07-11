import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ChangePasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("changePassword");
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ChangePasswordForm locale={locale} />
      </div>
    </div>
  );
}