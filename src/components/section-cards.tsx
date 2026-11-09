import { useLocale } from "next-intl";
import { formatHoursDecimal } from "@/lib/duration";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type SectionCardsData = {
  todayHours: number;
  todayTargetHours: number;
  weekHours: number;
  weekTargetHours: number;
  overtimeHours: number;
  overtimeTrend: "up" | "down" | "neutral";
  vacationRemaining: number;
  vacationTotal: number;
};

export function SectionCards({
  data,
  labels,
}: {
  data: SectionCardsData;
  labels: {
    todayWorked: string;
    weekWorked: string;
    overtimeBalance: string;
    vacationRemaining: string;
    dailyTarget: string;
    weekTarget: string;
    days: string;
  };
}) {
  const locale = useLocale();
  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{labels.todayWorked}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {formatHoursDecimal(data.todayHours, locale)} h
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {labels.dailyTarget}: {formatHoursDecimal(data.todayTargetHours, locale)} h
          </p>
        </CardHeader>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{labels.weekWorked}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {formatHoursDecimal(data.weekHours, locale)} h
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {labels.weekTarget}: {formatHoursDecimal(data.weekTargetHours, locale)} h
          </p>
        </CardHeader>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{labels.overtimeBalance}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.overtimeHours >= 0 ? "+" : ""}
            {formatHoursDecimal(data.overtimeHours, locale)} h
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{labels.vacationRemaining}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.vacationRemaining} {labels.days}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {data.vacationTotal} {labels.days}
          </p>
        </CardHeader>
      </Card>
    </div>
  );
}
