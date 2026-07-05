import "server-only";
import { db } from "@/lib/db";
import { sendPushToUser } from "./push";

type CreateNotificationInput = {
  userId: string;
  type:
    | "VACATION_APPROVED"
    | "VACATION_REJECTED"
    | "VACATION_REQUESTED"
    | "SICK_NOTE_REMINDER"
    | "TIMER_REMINDER"
    | "GENERIC";
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  url?: string;
};

export async function notifyUser(input: CreateNotificationInput) {
  const [n] = await db.notification.createManyAndReturn({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ? (input.payload as object) : undefined,
      channel: "APP",
    },
  });

  await sendPushToUser(input.userId, {
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.type,
  }).catch(() => {});

  return n;
}
