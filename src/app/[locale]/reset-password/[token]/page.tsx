import { setRequestLocale } from "next-intl/server";
import { AlertCircle } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { db } from "@/lib/db";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function ResetPasswordPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const resetToken = await db.verificationToken.findFirst({
    where: { token },
  });

  const isValid = !!resetToken && resetToken.expires > new Date();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm">
        {isValid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center shadow-sm">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {locale === "de" ? "Link ungültig oder abgelaufen." : "Link invalid or expired."}
            </p>
            <a href={`/${locale}/forgot-password`} className="text-sm text-primary hover:underline">
              {locale === "de" ? "Neuen Link anfordern" : "Request new link"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
