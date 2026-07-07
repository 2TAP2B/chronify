"use client";

import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";

type Props = {
  value: Date;
  userId?: string;
};

export function TimesheetDatePicker({ value, userId }: Props) {
  const router = useRouter();

  return (
    <DatePicker
      value={value}
      onChange={(d) => {
        if (!d) return;
        const iso = d.toISOString().slice(0, 10);
        const params = new URLSearchParams({ date: iso });
        if (userId) params.set("userId", userId);
        router.push(`?${params.toString()}`);
      }}
      className="w-[180px]"
    />
  );
}