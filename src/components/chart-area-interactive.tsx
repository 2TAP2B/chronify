"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ChartPoint = {
  date: string;
  hours: number;
  target: number;
};

const chartConfig = {
  hours: {
    label: "Gearbeitet",
    theme: {
      light: "hsl(221 83% 53%)",
      dark: "hsl(210 80% 60%)",
    },
  },
  target: {
    label: "Soll",
    theme: {
      light: "hsl(160 64% 40%)",
      dark: "hsl(160 55% 50%)",
    },
  },
} satisfies ChartConfig;

export function ChartAreaInteractive({
  data,
  labels,
}: {
  data: ChartPoint[];
  labels: {
    title: string;
    description: string;
    last3Months: string;
    last30Days: string;
    last7Days: string;
    worked: string;
    target: string;
  };
}) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("7d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const filteredData = React.useMemo(() => {
    if (data.length === 0) return [];
    const referenceDate = new Date(data[data.length - 1].date);
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return data.filter((item) => new Date(item.date) >= startDate);
  }, [data, timeRange]);

  const chartConfigLabeled = {
    hours: { ...chartConfig.hours, label: labels.worked },
    target: { ...chartConfig.target, label: labels.target },
  } satisfies ChartConfig;

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">{labels.description}</span>
          <span className="@[540px]/card:hidden">{labels.last30Days}</span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90d" className="h-8 px-2.5">
              {labels.last3Months}
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5">
              {labels.last30Days}
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">
              {labels.last7Days}
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="@[767px]/card:hidden flex w-40" aria-label="Select a value">
              <SelectValue placeholder={labels.last30Days} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                {labels.last3Months}
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                {labels.last30Days}
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                {labels.last7Days}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfigLabeled} className="aspect-auto h-[250px] w-full">
          <BarChart accessibilityLayer data={filteredData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("de-DE", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("de-DE", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  indicator="dashed"
                />
              }
            />
            <Bar dataKey="target" fill="var(--color-target)" radius={4} />
            <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
