"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

type UserOption = {
  id: string;
  name: string;
};

export function UserSelector({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: UserOption[];
}) {
  const t = useTranslations("timesheet");
  const router = useRouter();
  const searchParams = useSearchParams();

  function onSelect(userId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (userId === currentUserId) {
      params.delete("userId");
    } else {
      params.set("userId", userId);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={currentUserId}
      onChange={(e) => onSelect(e.target.value)}
      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
    >
      <option value={currentUserId}>{t("myTimesheet")}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.name}</option>
      ))}
    </select>
  );
}
