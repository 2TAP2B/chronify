"use client";

import { useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

type Props = {
  value: Date;
  userId?: string;
};

export function TimesheetDatePicker({ value, userId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="Datum wählen"
        >
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={(d) => {
            if (!d) return;
            const iso = d.toISOString().slice(0, 10);
            const params = new URLSearchParams({ date: iso });
            if (userId) params.set("userId", userId);
            router.push(`?${params.toString()}`);
            setOpen(false);
          }}
          showWeekNumber
          locale={de}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
