"use client";

import { useTimer, useTimerInit } from "@/components/timer/use-timer";
import { SectionCards, type SectionCardsData } from "@/components/section-cards";

type Props = {
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
};

export function LiveSectionCards({ data, labels }: Props) {
  useTimerInit();
  const timer = useTimer();

  const liveSessionHours = timer.active ? timer.displayElapsedMs / 3_600_000 : 0;

  const baseTodayHours = timer.loaded ? timer.todayWorkedMs / 3_600_000 : data.todayHours;

  const liveData: SectionCardsData = {
    ...data,
    todayHours: baseTodayHours + liveSessionHours,
    weekHours: data.weekHours + liveSessionHours,
  };

  return <SectionCards data={liveData} labels={labels} />;
}
