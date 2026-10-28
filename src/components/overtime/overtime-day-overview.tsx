"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, Cell, ReferenceLine } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type DayOverviewDay = {
  /** ISO calendar date (yyyy-MM-dd) */
  date: string;
  deltaMinutes: number;
  workedMinutes: number;
  targetMinutes: number;
  breakMinutes: number;
};

const POSITIVE_COLOR = "hsl(160 84% 39%)";
const NEGATIVE_COLOR = "hsl(0 72% 51%)";

const chartConfig = {
  hours: {
    label: "Überstunden",
    theme: { light: POSITIVE_COLOR, dark: POSITIVE_COLOR },
  },
  negative: {
    label: "Minus",
    theme: { light: NEGATIVE_COLOR, dark: NEGATIVE_COLOR },
  },
} satisfies ChartConfig;

const WEEKDAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function signedHHmm(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

function plainHHmm(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
}

type Props = {
  days: DayOverviewDay[];
  monthNames: string[];
  labels: {
    title: string;
    chartTitle: string;
    listTitle: string;
    noData: string;
    workedLabel: string;
    targetLabel: string;
    breakLabel: string;
  };
};

export function OvertimeDayOverview({ days, monthNames, labels }: Props) {
  const [month, setMonth] = useState(() => new Date().getUTCMonth() + 1);
  const lang = useLocale() === "en" ? "en-US" : "de-DE";
  const weekdayLabels = lang === "en-US" ? WEEKDAY_LABELS_EN : WEEKDAY_LABELS;

  // Days of the selected month that carry a target or real work —
  // weekends/holidays without work stay out of the chart and the list.
  const visibleDays = useMemo(
    () =>
      days
        .filter((d) => Number(d.date.slice(5, 7)) === month)
        .filter((d) => d.targetMinutes > 0 || d.workedMinutes > 0),
    [days, month]
  );

  const chartData = visibleDays.map((d) => ({
    ...d,
    day: Number(d.date.slice(8, 10)),
    hours: Math.round((Math.abs(d.deltaMinutes) / 60) * 10) / 10,
    positive: d.deltaMinutes >= 0,
    label: String(Number(d.date.slice(8, 10))),
  }));

  const formatDay = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    return `${weekdayLabels[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {monthNames.map((name, i) => {
            const m = i + 1;
            const active = m === month;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setMonth(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                aria-pressed={active}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {visibleDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.noData}</p>
        ) : (
          <>
            {/* daily bars */}
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[180px] w-full sm:h-[220px]"
            >
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  minTickGap={16}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ChartTooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_label, payload) => {
                        const p = payload?.[0]?.payload as (typeof chartData)[0] | undefined;
                        return p ? formatDay(p.date) : "";
                      }}
                      formatter={(_value, _name, item) => {
                        const p = item?.payload as (typeof chartData)[0] | undefined;
                        return p ? signedHHmm(p.deltaMinutes) : "";
                      }}
                    />
                  }
                />
                <Bar dataKey="hours" radius={3} maxBarSize={14}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.day}
                      fill={entry.positive ? "var(--color-hours)" : "var(--color-negative)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            {/* compact list */}
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {visibleDays.map((d) => {
                const positive = d.deltaMinutes >= 0;
                return (
                  <div
                    key={d.date}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatDay(d.date)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {plainHHmm(d.workedMinutes)} / {plainHHmm(d.targetMinutes)}
                        {d.breakMinutes > 0 && ` · ${labels.breakLabel} ${d.breakMinutes}m`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-sm font-semibold tabular-nums",
                        positive ? "text-emerald-600" : "text-destructive"
                      )}
                    >
                      {signedHHmm(d.deltaMinutes)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
