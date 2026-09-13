"use client";

import { useTranslations } from "next-intl";
import { useTimer, useTimerInit } from "@/components/timer/use-timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Coffee } from "lucide-react";

export function TimerWidget() {
  useTimerInit();
  const t = useTranslations("timer");
  const tDash = useTranslations("dashboard");
  const timer = useTimer();

  const active = timer.active;
  const onBreak = timer.onBreak;

  const startedAtLabel =
    active && timer.status?.startedAt
      ? new Date(timer.status.startedAt).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {active ? (onBreak ? t("onBreak") : t("running")) : t("inactive")}
            </p>
            {startedAtLabel && (
              <p className="text-xs text-muted-foreground">
                {t("startedAt", { time: startedAtLabel })}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tabular-nums">
              {timer.totalWorkedDisplay}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("breakTime")}: <span className="font-mono tabular-nums">{timer.displayBreak}</span>
            </div>
          </div>
        </div>

        {timer.error && <p className="text-sm text-destructive">{timer.error}</p>}

        <div className="flex gap-2">
          {!active ? (
            <Button onClick={timer.start} disabled={timer.loading} className="flex-1">
              <Play className="mr-2 h-4 w-4" />
              {tDash("timerStart")}
            </Button>
          ) : (
            <>
              <Button
                onClick={timer.toggleBreak}
                disabled={timer.loading}
                variant={onBreak ? "default" : "secondary"}
                className="flex-1"
              >
                <Coffee className="mr-2 h-4 w-4" />
                {onBreak ? t("resume") : t("break")}
              </Button>
              <Button
                onClick={timer.stop}
                disabled={timer.loading}
                variant="destructive"
                className="flex-1"
              >
                <Square className="mr-2 h-4 w-4" />
                {tDash("timerStop")}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
