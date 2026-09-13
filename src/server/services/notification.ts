import "server-only";
import { db } from "@/lib/db";
import { sendPushToUser } from "./push";
import { sendMail } from "./mail";
import { vacationApprovedEmail, vacationRejectedEmail } from "@/lib/email-templates";

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
  email?: {
    template: "vacation_approved" | "vacation_rejected";
    locale: "de" | "en";
    recipientName: string;
    appName: string;
    vars: Record<string, string | number>;
  };
};

const APP_NAME = process.env.APP_NAME ?? "Chronify";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

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

  if (input.email) {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (user?.email) {
      const v = input.email.vars;
      const baseUrl = input.url ?? `${APP_URL}/${input.email.locale}/vacation`;
      let mailContent;

      if (input.email.template === "vacation_approved") {
        mailContent = vacationApprovedEmail({
          locale: input.email.locale,
          appName: input.email.appName,
          recipientName: input.email.recipientName,
          fromDate: String(v.fromDate ?? ""),
          toDate: String(v.toDate ?? ""),
          days: Number(v.days ?? 0),
          vacationUrl: baseUrl,
        });
      } else if (input.email.template === "vacation_rejected") {
        mailContent = vacationRejectedEmail({
          locale: input.email.locale,
          appName: input.email.appName,
          recipientName: input.email.recipientName,
          fromDate: String(v.fromDate ?? ""),
          toDate: String(v.toDate ?? ""),
          reason: v.reason ? String(v.reason) : null,
          vacationUrl: baseUrl,
        });
      }

      if (mailContent) {
        await sendMail({
          to: user.email,
          subject: mailContent.subject,
          html: mailContent.html,
          text: mailContent.text,
        });
      }
    }
  }

  return n;
}
