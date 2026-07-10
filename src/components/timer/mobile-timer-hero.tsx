"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTimer, useTimerInit } from "@/components/timer/use-timer";
import { Button } from "@/components/ui/button";
import { Play, Square, Coffee, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  userName: string;
  todayWorkedMs: number;
  todayTargetHours: number;
  locale: string;
};

export function MobileTimerHero({
  userName,
  todayWorkedMs,
  todayTargetHours,
  locale,
}: Props) {
  useTimerInit();
  const t = useTranslations("dashboard");
  const tTimer = useTranslations("timer");
  const tArbzg = useTranslations("arbzg");
  const timer = useTimer();
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const localeStr = (locale as "de" | "en") || "de";
  const dateFormat = new Intl.DateTimeFormat(localeStr === "de" ? "de-DE" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFormat = new Intl.DateTimeFormat(localeStr === "de" ? "de-DE" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const active = timer.active;
  const onBreak = timer.onBreak;

  const displayMs = timer.totalWorkedMs;
  const hours = Math.floor(displayMs / 3_600_000);
  const minutes = Math.floor((displayMs % 3_600_000) / 60_000);
  const seconds = Math.floor((displayMs % 60_000) / 1000);
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const targetHours = todayTargetHours;
  const progressPct = targetHours > 0 ? Math.min(100, Math.round((displayMs / 3_600_000 / targetHours) * 100)) : 0;

  const firstName = userName.split(" ")[0] || userName;

  return (
    <div className="lg:hidden -mx-4 -mt-4 px-4 pt-4 pb-2 flex flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("hi", { name: firstName })}
        </h1>
        <p className="text-base text-muted-foreground">
          {t("todayIs", { date: dateFormat.format(now) })}
        </p>
        <p className="font-mono text-xl tabular-nums text-foreground">
          {timeFormat.format(now)}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("workingTimeToday")}
        </p>
        <div className="font-mono text-6xl font-bold tabular-nums tracking-tight">
          {timeStr}
        </div>
        {targetHours > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("dailyTarget")}: {targetHours.toFixed(1)} h · {progressPct}%
          </p>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 pb-4">
        {!active ? (
          <Button
            onClick={timer.start}
            disabled={timer.loading}
            size="lg"
            className="h-16 w-full text-lg font-semibold"
          >
            <Play className="mr-2 h-6 w-6" />
            {t("timerStart")}
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={timer.toggleBreak}
              disabled={timer.loading}
              variant={onBreak ? "default" : "secondary"}
              size="lg"
              className="h-16 text-lg font-semibold"
            >
              <Coffee className="mr-2 h-6 w-6" />
              {onBreak ? tTimer("resume") : tTimer("break")}
            </Button>
            <Button
              onClick={timer.stop}
              disabled={timer.loading}
              variant="destructive"
              size="lg"
              className="h-16 text-lg font-semibold"
            >
              <Square className="mr-2 h-6 w-6" />
              {t("timerStop")}
            </Button>
          </div>
        )}
        {timer.error && (
          <p className="text-center text-sm text-destructive">{timer.error}</p>
        )}

        {timer.warnings.length > 0 && (
          <div
            onClick={() => setWarningsOpen((v) => !v)}
            className="w-full cursor-pointer select-none"
          >
            <div className="flex items-center justify-center gap-2">
              {timer.warnings.map((w, i) => (
                w.level === "warning"
                  ? <AlertTriangle key={i} className="h-5 w-5 shrink-0 text-amber-500" />
                  : <Info key={i} className="h-5 w-5 shrink-0 text-blue-500" />
              ))}
              {warningsOpen
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
            {warningsOpen && (
              <div className="mt-2 space-y-1.5">
                {timer.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg p-2.5 text-xs text-left ${
                      w.level === "warning"
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        : "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                    }`}
                  >
                    {w.level === "warning" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <span>{tArbzg(w.messageKey)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
