type ResolvedBase = { base: string; appended: boolean };

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const hasApiSegment = (value: string) => /\/api(?:\/|$)/i.test(value);

const resolveApiBase = (raw?: string): ResolvedBase | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const normalised = stripTrailingSlash(trimmed);

  try {
    const url = new URL(normalised);
    const path = stripTrailingSlash(url.pathname || '');
    if (!path || path === '') {
      url.pathname = '/api';
      return { base: stripTrailingSlash(url.toString()), appended: true };
    }
    if (hasApiSegment(path)) {
      url.pathname = path;
      return { base: stripTrailingSlash(url.toString()), appended: false };
    }
    url.pathname = `${path}/api`;
    return { base: stripTrailingSlash(url.toString()), appended: true };
  } catch {
    if (hasApiSegment(normalised)) {
      return { base: normalised, appended: false };
    }
    return { base: `${normalised}/api`, appended: true };
  }
};

let cachedApiBase: ResolvedBase | undefined;

const getApiBase = () => {
  if (!cachedApiBase) {
    cachedApiBase = resolveApiBase(process.env.NEXT_PUBLIC_API_URL);
    if (!cachedApiBase) {
      throw new Error('NEXT_PUBLIC_API_URL is not configured');
    }
    if (cachedApiBase.appended && typeof window !== 'undefined') {
      console.warn('[scrollwise] NEXT_PUBLIC_API_URL was missing an /api segment; using', cachedApiBase.base);
    }
  }
  return cachedApiBase.base;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TrackingSettings {
  paused?: boolean;
  pausedAt?: string;
  reason?: string;
}

export interface PresenceSnapshot {
  lastEventAt?: string;
  lastEventType?: string;
  lastUrl?: string;
  lastDomain?: string;
  lastDurationMs?: number;
  lastScrollDistance?: number;
}

export interface ContactProfile {
  phone?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
}

export interface UserPayload {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  timezone?: string;
  habits?: {
    dailyGoalMinutes?: number;
    notificationsEnabled?: boolean;
  };
  role?: 'user' | 'admin' | 'superadmin';
  accountStatus?: 'active' | 'invited' | 'suspended';
  tracking?: TrackingSettings;
  presence?: PresenceSnapshot;
  contact?: ContactProfile;
  createdAt: string;
}

export interface AuthResponse {
  user: UserPayload;
  tokens: AuthTokens;
  session: {
    id: string;
    expiresAt: string;
  };
}

export interface PaginatedResponse<T> {
  page: number;
  limit: number;
  total: number;
  items: T[];
}

export interface TimelineEvent {
  _id: string;
  type: 'scroll' | 'click' | 'idle' | 'focus' | 'blur';
  durationMs?: number;
  scrollDistance?: number;
  url: string;
  domain: string;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  createdAt: string;
}

export interface DailyTotals {
  scrollDistance: number;
  activeMinutes: number;
  idleMinutes: number;
  clickCount: number;
}

export interface DailyBreakdown {
  domain: Record<string, number>;
  hour: Record<string, number>;
}

export interface DailyMetric {
  userId?: string;
  _id?: string;
  date: string;
  totals: DailyTotals;
  breakdown: DailyBreakdown;
  lastComputedAt?: string;
}

export interface SummaryResponse {
  today: DailyMetric | null;
  weekly: Array<{
    date: string;
    scrollDistance: number;
    activeMinutes: number;
    clickCount: number;
  }>;
  totals: Record<string, { count: number; durationMs: number; scrollDistance: number }>;
}

export interface InsightPayload {
  _id: string;
  title: string;
  body: string;
  metricDate: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface InsightsResponse {
  insights: InsightPayload[];
}

export interface GenerateInsightResponse {
  insight: InsightPayload;
}

export interface TimelineResponse {
  timeline: TimelineEvent[];
}

export type AdminUserRecord = UserPayload & { _id?: string };
export type AdminEventRecord = TimelineEvent & { userId?: string };

export interface AuditRecord {
  _id: string;
  action: string;
  actorEmail?: string;
  targetId?: string;
  targetType?: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface LiveActivityItem {
  user?: AdminUserRecord;
  lastEvent?: AdminEventRecord;
  status: 'active' | 'recent' | 'idle' | 'offline';
  windowCount: number;
  typeCounts: Record<string, number>;
  topDomain?: string;
  recentEvents: AdminEventRecord[];
}

export interface AdminUserDetail {
  user: AdminUserRecord;
  metrics: DailyMetric[];
  recentEvents: AdminEventRecord[];
  insights: Array<InsightPayload & { userId?: string }>;
  audits: AuditRecord[];
}

export interface PolicyPayload {
  slug: 'terms' | 'privacy' | 'contact';
  title: string;
  body: string;
  updatedAt: string;
}

export interface ContactMessagePayload {
  _id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  createdAt: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const base = getApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const response = await fetch(`${base}${normalizedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    credentials: 'include'
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, payload.error ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const api = {
  register: (body: { email: string; password: string; displayName: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  google: (body: { idToken: string }) => request<AuthResponse>('/auth/google', { method: 'POST', body: JSON.stringify(body) }),
  refresh: (body: { refreshToken: string }) =>
    request<{ tokens: AuthTokens; session: { id: string; expiresAt: string } }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  logout: (token: string, refreshToken?: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(refreshToken ? { refreshToken } : {})
    }),
  me: async (token: string) => {
    const payload = await request<UserPayload | { user: UserPayload }>('/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return (payload as { user?: UserPayload }).user ?? (payload as UserPayload);
  },
  updateProfile: (token: string, body: { displayName?: string; timezone?: string; avatarUrl?: string }) =>
    request<UserPayload>('/users/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  updatePreferences: (token: string, body: { dailyGoalMinutes?: number; notificationsEnabled?: boolean }) =>
    request<{ habits: any }>('/users/me/preferences', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  deleteAccount: (token: string) =>
    request<void>('/users/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }),
  summary: (token: string) =>
    request<SummaryResponse>('/tracking/summary', {
      headers: { Authorization: `Bearer ${token}` }
    }),
  timeline: (token: string) =>
    request<TimelineResponse>('/tracking/timeline', {
      headers: { Authorization: `Bearer ${token}` }
    }),
  insights: (token: string) =>
    request<InsightsResponse>('/insights', {
      headers: { Authorization: `Bearer ${token}` }
    }),
  generateInsight: (token: string, body?: { date?: string; regenerate?: boolean }) =>
    request<GenerateInsightResponse>('/insights/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {})
    })
  ,
  // Admin endpoints
  adminSummary: (token: string) =>
    request<{ users: number; events: number; metrics: number; insights: number }>('/admin/summary', {
      headers: { Authorization: `Bearer ${token}` }
    }),
  adminLiveActivity: (token: string, opts?: { windowMs?: number }) =>
    request<{ windowMs: number; updatedAt: string; items: LiveActivityItem[] }>(
      `/admin/activity/live${opts?.windowMs ? `?windowMs=${opts.windowMs}` : ''}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ),
  adminListUsers: (token: string, opts?: { q?: string; page?: number; limit?: number }) =>
    request<PaginatedResponse<AdminUserRecord>>(
      `/admin/users?q=${encodeURIComponent(opts?.q ?? '')}&page=${opts?.page ?? 1}&limit=${opts?.limit ?? 50}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ),
  adminGetUserDetail: (token: string, id: string) =>
    request<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/detail`, {
      headers: { Authorization: `Bearer ${token}` }
    }),
  adminPromoteUser: (token: string, id: string) =>
    request<any>(`/admin/users/${encodeURIComponent(id)}/promote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }),
  adminDemoteUser: (token: string, id: string) =>
    request<any>(`/admin/users/${encodeURIComponent(id)}/demote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }),
  adminUpdateTracking: (token: string, id: string, body: { paused: boolean; reason?: string }) =>
    request<{ ok: boolean; tracking: TrackingSettings }>(`/admin/users/${encodeURIComponent(id)}/tracking`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  adminDeleteUser: (token: string, id: string) =>
    request<any>(`/admin/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }),
  adminExportEvents: (token: string, opts?: { userId?: string; domain?: string }) => {
    const q = `/admin/events/export?userId=${encodeURIComponent(opts?.userId ?? '')}&domain=${encodeURIComponent(opts?.domain ?? '')}`;
    // return raw text via fetch because request() expects JSON
    return fetch(getApiBase() + q, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }).then(r => {
      if (!r.ok) throw new ApiError(r.status, 'Export failed');
      return r.blob();
    });
  },
  adminListEvents: (token: string, opts?: { userId?: string; domain?: string; page?: number; limit?: number }) =>
    request<PaginatedResponse<AdminEventRecord>>(
      `/admin/events?userId=${encodeURIComponent(opts?.userId ?? '')}&domain=${encodeURIComponent(opts?.domain ?? '')}&page=${opts?.page ?? 1}&limit=${opts?.limit ?? 50}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
  adminListMetrics: (token: string, opts?: { userId?: string; page?: number; limit?: number }) =>
    request<PaginatedResponse<DailyMetric>>(
      `/admin/metrics?userId=${encodeURIComponent(opts?.userId ?? '')}&page=${opts?.page ?? 1}&limit=${opts?.limit ?? 50}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ),
  adminListInsights: (token: string, opts?: { userId?: string; page?: number; limit?: number }) =>
    request<PaginatedResponse<InsightPayload & { userId?: string }>>(
      `/admin/insights?userId=${encodeURIComponent(opts?.userId ?? '')}&page=${opts?.page ?? 1}&limit=${opts?.limit ?? 50}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ),
  adminListContactMessages: (token: string) =>
    request<{ items: ContactMessagePayload[] }>('/admin/contact/messages', {
      headers: { Authorization: `Bearer ${token}` }
    }),
  // Content / policy endpoints
  contentListPolicies: () => request<{ items: PolicyPayload[] }>('/content/policies'),
  contentGetPolicy: (slug: string) => request<PolicyPayload>(`/content/policies/${slug}`),
  contentUpdatePolicy: (token: string, slug: string, body: Partial<PolicyPayload>) =>
    request<PolicyPayload>(`/content/policies/${slug}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  submitContactMessage: (body: { name: string; email: string; subject?: string; message: string }, token?: string) =>
    request<{ id: string; createdAt: string }>(`/content/contact`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: JSON.stringify(body)
    })
};
