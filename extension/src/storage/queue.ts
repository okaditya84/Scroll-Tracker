import type { TrackingPayload } from '@/types/tracking';

const QUEUE_KEY = 'scrollwise-event-queue';

export interface QueuedEvent {
  id: string;
  event: TrackingPayload;
}

const createQueuedEvent = (event: TrackingPayload): QueuedEvent => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  event
});

const normalizeQueue = (raw: unknown): QueuedEvent[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map(item => {
    if (item && typeof item === 'object' && 'id' in item && 'event' in item) {
      const candidate = item as { id: string; event: TrackingPayload };
      if (typeof candidate.id === 'string' && candidate.event) {
        return candidate;
      }
    }
    return createQueuedEvent(item as TrackingPayload);
  });
};

const writeQueue = async (queue: QueuedEvent[]) => {
  if (queue.length) {
    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  } else {
    await chrome.storage.local.remove(QUEUE_KEY);
  }
};

const readQueue = async (): Promise<QueuedEvent[]> => {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const raw = stored[QUEUE_KEY];
  const normalized = normalizeQueue(raw);
  const needsUpgrade = Array.isArray(raw) && raw.some(item => !(item && typeof item === 'object' && 'id' in item && 'event' in item));
  if (needsUpgrade && normalized.length) {
    await writeQueue(normalized);
  }
  return normalized;
};

export const enqueueEvents = async (events: TrackingPayload[]) => {
  if (!events.length) return [] as string[];
  const existing = await readQueue();
  const next = events.map(createQueuedEvent);
  await writeQueue([...existing, ...next]);
  return next.map(item => item.id);
};

export const getQueuedEvents = async () => readQueue();

export const removeQueuedEvents = async (ids: string[]) => {
  if (!ids.length) return;
  const existing = await readQueue();
  const filtered = existing.filter(item => !ids.includes(item.id));
  await writeQueue(filtered);
};

export const clearQueue = async () => {
  await chrome.storage.local.remove(QUEUE_KEY);
};
