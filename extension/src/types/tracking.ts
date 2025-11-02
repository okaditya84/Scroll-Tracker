export type TrackingEventType = 'scroll' | 'click' | 'idle' | 'focus' | 'blur';

export interface TrackingPayload {
  type: TrackingEventType;
  url: string;
  domain: string;
  durationMs?: number;
  scrollDistance?: number;
  startedAt?: string;
  metadata?: Record<string, unknown>;
}
