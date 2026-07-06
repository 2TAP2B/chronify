"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const STEP_MIN = 15;

function parseHHMM(s: string): number | null {
  const clean = s.replace(/[^\d:]/g, "");
  const m = clean.match(/^(\d{1,2}):?(\d{0,2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function formatHHMM(totalMin: number | null): string {
  if (totalMin == null) return "";
  const clamped = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function autoFormatTime(s: string): string {
  const digits = s.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function autoComplete(s: string): string {
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 2) {
    const h = parseInt(digits, 10);
    if (!Number.isNaN(h) && h <= 23) {
      return `${String(h).padStart(2, "0")}:00`;
    }
  }
  return formatHHMM(parseHHMM(s));
}

export function TimeInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [clockOpen, setClockOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback((v: string) => {
    const completed = autoComplete(v);
    if (completed) {
      onChange(completed);
      setDraft(completed);
    } else {
      setDraft(v);
    }
  }, [onChange]);

  const handleBlur = useCallback(() => {
    commit(draft);
  }, [commit, draft]);

  const handleChange = useCallback((raw: string) => {
    const formatted = autoFormatTime(raw);
    setDraft(formatted);
    onChange(formatted);
  }, [onChange]);

  const step = useCallback((delta: number) => {
    const current = parseHHMM(draft) ?? parseHHMM(value) ?? 0;
    let next = current + delta;
    next = ((next % 1440) + 1440) % 1440;
    next = Math.round(next / STEP_MIN) * STEP_MIN;
    next = ((next % 1440) + 1440) % 1440;
    const formatted = formatHHMM(next);
    setDraft(formatted);
    onChange(formatted);
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      step(STEP_MIN);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(-STEP_MIN);
    }
  }, [step]);

  const handleClockSelect = useCallback((totalMin: number) => {
    const formatted = formatHHMM(totalMin);
    setDraft(formatted);
    onChange(formatted);
  }, [onChange]);

  const currentMin = parseHHMM(draft) ?? 0;
  const currentHour = Math.floor(currentMin / 60);
  const currentMinute = currentMin % 60;

  return (
    <div className="flex items-center gap-1">
      <Popover open={clockOpen} onOpenChange={setClockOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent hover:text-foreground"
            tabIndex={-1}
          >
            <Clock className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <ClockPicker
            hour={currentHour}
            minute={currentMinute}
            onSelect={handleClockSelect}
            onClose={() => setClockOpen(false)}
          />
        </PopoverContent>
      </Popover>
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={5}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="font-mono tabular-nums"
      />
    </div>
  );
}

function ClockPicker({
  hour,
  minute,
  onSelect,
  onClose,
}: {
  hour: number;
  minute: number;
  onSelect: (totalMin: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"hour" | "minute">(
    minute % STEP_MIN !== 0 ? "minute" : "hour"
  );
  const [selectedHour, setSelectedHour] = useState(hour);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          type="button"
          className={cn(
            "rounded px-2 py-1 text-xs font-medium",
            tab === "hour" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
          onClick={() => setTab("hour")}
        >
          {String(selectedHour).padStart(2, "0")} Std
        </button>
        <span className="text-xs text-muted-foreground">:</span>
        <button
          type="button"
          className={cn(
            "rounded px-2 py-1 text-xs font-medium",
            tab === "minute" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
          onClick={() => setTab("minute")}
        >
          {String(minute).padStart(2, "0")} Min
        </button>
      </div>
      {tab === "hour" ? (
        <div className="grid grid-cols-6 gap-1">
          {hours.map((h) => (
            <button
              key={h}
              type="button"
              className={cn(
                "h-8 w-8 rounded text-xs font-mono tabular-nums",
                h === selectedHour
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
              onClick={() => {
                setSelectedHour(h);
                onSelect(h * 60 + (minute - (minute % STEP_MIN)));
                setTab("minute");
              }}
            >
              {String(h).padStart(2, "0")}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {minutes.map((m) => (
            <button
              key={m}
              type="button"
              className={cn(
                "h-8 w-12 rounded text-xs font-mono tabular-nums",
                m === (minute - (minute % STEP_MIN))
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
              onClick={() => {
                onSelect(selectedHour * 60 + m);
                onClose();
              }}
            >
              {String(m).padStart(2, "0")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
