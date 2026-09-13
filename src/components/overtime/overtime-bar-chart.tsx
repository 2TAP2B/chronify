"use client";

import { Bar, BarChart, CartesianGrid, XAxis, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type MonthData = {
  month: number;
  label: string;
  hours: number;
};

const chartConfig = {
  hours: {
    label: "Überstunden",
    theme: {
      light: "hsl(221 83% 53%)",
      dark: "hsl(210 80% 60%)",
    },
  },
  negative: {
    label: "Minus",
    theme: {
      light: "hsl(0 72% 45%)",
      dark: "hsl(0 70% 55%)",
    },
  },
} satisfies ChartConfig;

export function OvertimeBarChart({
  data,
  labels: { title, description },
}: {
  data: { month: number; deltaMs: number; label?: string }[];
  labels: {
    title: string;
    description: string;
  };
}) {
  const chartData: MonthData[] = data.map((m) => ({
    month: m.month,
    label: m.label ?? String(m.month),
    hours: Math.round((m.deltaMs / 3_600_000) * 10) / 10,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="hours" radius={4}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={entry.hours >= 0 ? "var(--color-hours)" : "var(--color-negative)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
