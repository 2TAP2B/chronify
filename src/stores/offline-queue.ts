"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type QueuedMutation = {
  id: string;
  url: string;
  method: string;
  body: unknown;
  createdAt: number;
};

type OfflineQueueState = {
  queue: QueuedMutation[];
  enqueue: (mutation: Omit<QueuedMutation, "id" | "createdAt">) => void;
  dequeue: () => QueuedMutation | undefined;
  remove: (id: string) => void;
  clear: () => void;
  size: () => number;
};

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      enqueue: (mutation) =>
        set((state) => ({
          queue: [...state.queue, { ...mutation, id: crypto.randomUUID(), createdAt: Date.now() }],
        })),
      dequeue: () => {
        const q = get().queue;
        if (q.length === 0) return undefined;
        const first = q[0];
        set({ queue: q.slice(1) });
        return first;
      },
      remove: (id) => set((state) => ({ queue: state.queue.filter((q) => q.id !== id) })),
      clear: () => set({ queue: [] }),
      size: () => get().queue.length,
    }),
    { name: "puku-offline-queue" }
  )
);

export async function fetchOrQueue(
  url: string,
  options: RequestInit,
  onQueued?: () => void
): Promise<Response | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useOfflineQueue.getState().enqueue({
      url,
      method: options.method ?? "GET",
      body: options.body ? JSON.parse(options.body as string) : null,
    });
    onQueued?.();
    return null;
  }
  return fetch(url, options);
}

export async function replayQueue(onReplayed?: (mutation: QueuedMutation) => void) {
  const state = useOfflineQueue.getState();
  while (state.queue.length > 0) {
    const mutation = state.queue[0];
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: mutation.body ? JSON.stringify(mutation.body) : undefined,
      });
      if (res.ok) {
        state.remove(mutation.id);
        onReplayed?.(mutation);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}
