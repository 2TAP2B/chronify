import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { db } from "@/lib/db";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const session = await auth();
  if (session) redirect(`/${locale}/dashboard`);

  const settings = await db.orgSettings.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { passwordLoginDisabled: true },
  });

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <LoginForm passwordLoginDisabled={settings.passwordLoginDisabled} />
      </div>
    </div>
  );
}
