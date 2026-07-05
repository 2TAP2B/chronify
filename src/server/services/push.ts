import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.PUSH_VAPID_SUBJECT ?? "mailto:admin@example.com",
    process.env.PUSH_VAPID_PUBLIC_KEY!,
    process.env.PUSH_VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  ensureConfigured();
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          stale.push(sub.id);
        }
      }
    })
  );

  if (stale.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: stale } } });
  }
  return sent;
}

export function getVapidPublicKey(): string {
  return process.env.PUSH_VAPID_PUBLIC_KEY!;
}
