"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useTimer, useTimerInit } from "@/components/timer/use-timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Coffee, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";

export function TimerWidget() {
  useTimerInit();
  const t = useTranslations("timer");
  const tDash = useTranslations("dashboard");
  const tArbzg = useTranslations("arbzg");
  const timer = useTimer();
  const [warningsOpen, setWarningsOpen] = useState(false);

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
              {t("breakTime")}:{" "}
              <span className="font-mono tabular-nums">{timer.displayBreak}</span>
            </div>
          </div>
        </div>

        {timer.error && (
          <p className="text-sm text-destructive">{timer.error}</p>
        )}

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

        {timer.warnings.length > 0 && (
          <div
            onClick={() => setWarningsOpen((v) => !v)}
            className="cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              {timer.warnings.map((w, i) => (
                w.level === "warning"
                  ? <AlertTriangle key={i} className="h-4 w-4 shrink-0 text-amber-500" />
                  : <Info key={i} className="h-4 w-4 shrink-0 text-blue-500" />
              ))}
              <span className="text-xs text-muted-foreground">
                {warningsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </span>
            </div>
            {warningsOpen && (
              <div className="mt-2 space-y-1.5">
                {timer.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md p-2 text-xs ${
                      w.level === "warning"
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        : "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                    }`}
                  >
                    {w.level === "warning" ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    )}
                    <span>{tArbzg(w.messageKey)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
