import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getUserCalendar } from "@/server/services/calendar";
import { PersonalCalendar } from "@/components/calendar/personal-calendar";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function CalendarPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("calendar");

  const session = await auth();
  if (!session?.user?.id || !session?.user?.role) return null;

  const { year: yearStr, month: monthStr } = await searchParams;
  const now = new Date();
  const year = yearStr ? Number(yearStr) : now.getFullYear();
  const month = monthStr ? Number(monthStr) : now.getMonth() + 1;

  const events = await getUserCalendar({
    actor: { id: session.user.id, role: session.user.role },
    year,
    month,
  });

  const initialDate = new Date(year, month - 1, 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <PersonalCalendar events={events} initialDate={initialDate} />
    </div>
  );
}
