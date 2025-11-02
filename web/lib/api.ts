const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }

  const response = await fetch(`${API_URL}${path}`, {
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
  me: (token: string) =>
    request<UserPayload>('/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    }),
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
};
