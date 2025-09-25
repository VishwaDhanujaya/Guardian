import { AxiosResponse } from 'axios';

import { apiService } from '@/services/apiService';

type HttpResponse<T> = {
  status: 'success' | 'error';
  data: T;
  message: string;
};

function unwrap<T>(response: AxiosResponse<HttpResponse<T>>): T {
  return response.data.data;
}

function mapName(first?: string | null, last?: string | null): string {
  const parts = [first, last].filter(Boolean);
  if (parts.length === 0) return 'Unknown user';
  return parts.join(' ');
}

export type LoginSuccess = {
  status: 'authenticated';
  accessToken: string;
  refreshToken: string;
};

export type LoginRequiresMfa = {
  status: 'mfa_required';
  mfaToken: string;
};

export type LoginResult = LoginSuccess | LoginRequiresMfa;

export async function loginUser({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<LoginResult> {
  const response = await apiService.post<HttpResponse<{
    accessToken?: string;
    refreshToken?: string;
    mfa_token?: string;
  }>>('/api/v1/auth/login', {
    username,
    password,
  });

  if (response.data.message === 'mfa_required' && response.data.data?.mfa_token) {
    return { status: 'mfa_required', mfaToken: response.data.data.mfa_token };
  }

  const { accessToken, refreshToken } = response.data.data ?? {};

  if (!accessToken || !refreshToken) {
    throw new Error('Login response missing tokens');
  }

  return { status: 'authenticated', accessToken, refreshToken };
}

export async function registerUser(data: {
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  password: string;
}): Promise<void> {
  await apiService.post('/api/v1/auth/register', {
    username: data.username,
    password: data.password,
    email: data.email,
    first_name: data.firstName,
    last_name: data.lastName,
  });
}

export async function verifyMfa({
  code,
  token,
}: {
  code: string;
  token: string;
}): Promise<void> {
  await apiService.post('/api/v1/mfa/verify-code', {
    code,
    mfa_token: token,
  });
}

export async function resendMfaToken(token: string): Promise<string> {
  const response = await apiService.post<HttpResponse<{ mfa_token: string }>>(
    '/api/v1/mfa/resend-code',
    {
      mfa_token: token,
    },
  );

  return unwrap(response).mfa_token;
}

export type Profile = {
  id: number;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  is_officer?: number | boolean;
};

export async function fetchProfile(): Promise<{
  name: string;
  isOfficer: boolean;
}> {
  const response = await apiService.get<HttpResponse<Profile>>('/api/v1/auth/profile');
  const profile = unwrap(response);
  return {
    name: mapName(profile.first_name, profile.last_name) || profile.username,
    isOfficer: Boolean(profile.is_officer),
  };
}

// Alerts
export type AlertDraft = {
  id?: string;
  title: string;
  message: string;
  category: string;
};

export type AlertRow = {
  id: string;
  title: string;
  message: string;
  category: string;
  createdAt?: string;
};

type ApiAlert = {
  id: number;
  title: string;
  description: string;
  type: string;
  created_at?: string;
};

function mapAlert(alert: ApiAlert): AlertRow {
  return {
    id: String(alert.id),
    title: alert.title,
    message: alert.description,
    category: alert.type,
    createdAt: alert.created_at ?? undefined,
  };
}

export async function fetchAlerts(page?: number): Promise<AlertRow[]> {
  const response = await apiService.get<HttpResponse<ApiAlert[]>>('/api/v1/alerts', {
    params: page !== undefined ? { page } : undefined,
  });

  return unwrap(response).map(mapAlert);
}

export async function getAlert(id: string): Promise<AlertDraft> {
  const response = await apiService.get<HttpResponse<ApiAlert>>(`/api/v1/alerts/${id}`);
  const alert = unwrap(response);
  return {
    id: String(alert.id),
    title: alert.title,
    message: alert.description,
    category: alert.type,
  };
}

export async function saveAlert(data: AlertDraft): Promise<AlertRow> {
  if (data.id) {
    // No dedicated update endpoint; recreate after deleting the old alert.
    await apiService.delete(`/api/v1/alerts/${data.id}`);
  }

  const response = await apiService.post<HttpResponse<ApiAlert>>('/api/v1/alerts', {
    title: data.title,
    description: data.message,
    type: data.category,
  });

  return mapAlert(unwrap(response));
}

export async function deleteAlert(id: string): Promise<void> {
  await apiService.delete(`/api/v1/alerts/${id}`);
}

// Incidents
export type Note = { id: string; text: string; at: string; by: string };

export type Report = {
  id: string;
  title: string;
  category: 'Safety' | 'Crime' | 'Maintenance' | 'Other';
  location: string;
  reportedBy: string;
  reportedAt: string;
  status: 'New' | 'In Review' | 'Approved' | 'Assigned' | 'Ongoing' | 'Resolved';
  priority: 'Urgent' | 'Normal' | 'Low';
  description?: string;
  notes: Note[];
};

type ApiReport = {
  id: number;
  description: string;
  longitude?: number | null;
  latitude?: number | null;
  user_id: number;
  status: 'PENDING' | 'IN-PROGRESS' | 'COMPLETED' | 'CLOSED';
  priority?: number | null;
  createdAt?: string | null;
};

type ApiNote = {
  id: number;
  subject: string;
  content: string;
  created_at?: string;
};

function mapPriority(score?: number | null): 'Urgent' | 'Normal' | 'Low' {
  if (typeof score !== 'number') return 'Normal';
  if (score >= 70) return 'Urgent';
  if (score <= 30) return 'Low';
  return 'Normal';
}

function mapStatus(status: ApiReport['status']): Report['status'] {
  switch (status) {
    case 'IN-PROGRESS':
      return 'Ongoing';
    case 'COMPLETED':
    case 'CLOSED':
      return 'Resolved';
    case 'PENDING':
      return 'In Review';
    default:
      return 'New';
  }
}

function mapReportNotes(notes: ApiNote[] | undefined): Note[] {
  if (!notes) return [];
  return notes.map((note) => ({
    id: String(note.id),
    text: note.content,
    at: note.created_at ? new Date(note.created_at).toLocaleString() : 'Unknown',
    by: note.subject || 'Officer',
  }));
}

function buildTitle(description: string): string {
  if (!description) return 'Incident report';
  const trimmed = description.trim();
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}…`;
}

export async function getIncident(id: string): Promise<Report> {
  const reportRes = await apiService.get<HttpResponse<ApiReport>>(`/api/v1/reports/${id}`);
  const report = unwrap(reportRes);

  let notes: Note[] = [];
  try {
    const notesRes = await apiService.get<HttpResponse<ApiNote[]>>(
      `/api/v1/notes/resource/${id}`,
      {
        params: { resourceType: 'report' },
      },
    );
    notes = mapReportNotes(unwrap(notesRes));
  } catch {
    notes = [];
  }

  const createdAt = report.createdAt ? new Date(report.createdAt) : null;
  const reportedAt = createdAt
    ? createdAt.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown';

  const location =
    report.latitude !== null && report.latitude !== undefined &&
    report.longitude !== null && report.longitude !== undefined
      ? `${report.latitude.toFixed(3)}, ${report.longitude.toFixed(3)}`
      : 'Location unavailable';

  return {
    id: String(report.id),
    title: buildTitle(report.description),
    category: 'Safety',
    location,
    reportedBy: `User #${report.user_id}`,
    reportedAt,
    status: mapStatus(report.status),
    priority: mapPriority(report.priority ?? undefined),
    description: report.description,
    notes,
  };
}

// Lost & Found
export type FoundItem = { id: string; title: string; meta: string };

type ApiLostItem = {
  id: number;
  name: string;
  description?: string;
  model?: string;
  serial_number?: string;
  color?: string;
  branch?: string;
  longitude?: number | null;
  latitude?: number | null;
  status?: string;
  created_at?: string;
  user_id?: number;
};

export async function fetchFoundItems(): Promise<FoundItem[]> {
  try {
    const response = await apiService.get<HttpResponse<ApiLostItem[]>>(
      '/api/v1/lost-articles/all',
    );
    const items = unwrap(response);
    return items.map((item) => ({
      id: String(item.id),
      title: item.name,
      meta: item.branch ? `${item.branch} · ${item.color ?? 'Unspecified'}` : item.color ?? 'Unspecified',
    }));
  } catch (error: any) {
    if (error.response?.status === 401) {
      return [];
    }
    throw error;
  }
}

export async function reportLostItem(data: {
  itemName: string;
  desc: string;
  model: string;
  serial: string;
  lastLoc: string;
  color: string;
}): Promise<{ success: boolean }> {
  await apiService.post('/api/v1/lost-articles', {
    name: data.itemName,
    description: data.desc || 'Not provided',
    model: data.model || 'Unknown',
    serial_number: data.serial || 'Unknown',
    color: data.color || 'Unknown',
    longitude: 0,
    latitude: 0,
    status: 'PENDING',
    branch: data.lastLoc || 'UNSPECIFIED',
  });

  return { success: true };
}

export type FoundItemDetail = {
  id: string;
  name: string;
  description?: string;
  model?: string;
  serial?: string;
  color?: string;
  lastLocation?: string;
  branch?: string;
  postedAt?: string;
};

export async function getFoundItem(id: string): Promise<FoundItemDetail> {
  const response = await apiService.get<HttpResponse<ApiLostItem>>(
    `/api/v1/lost-articles/${id}`,
  );
  const item = unwrap(response);
  return {
    id: String(item.id),
    name: item.name,
    description: item.description,
    model: item.model,
    serial: item.serial_number,
    color: item.color,
    lastLocation: item.branch,
    branch: item.branch,
    postedAt: item.created_at,
  };
}

export type LostItemDetail = {
  id: string;
  name: string;
  description?: string;
  model?: string;
  serial?: string;
  color?: string;
  lastLocation?: string;
  reportedBy?: string;
  reportedAt?: string;
  status?: string;
};

export async function getLostItem(id: string): Promise<LostItemDetail> {
  const response = await apiService.get<HttpResponse<ApiLostItem>>(
    `/api/v1/lost-articles/${id}`,
  );
  const item = unwrap(response);
  const reportedAt = item.created_at
    ? new Date(item.created_at).toLocaleString()
    : undefined;

  return {
    id: String(item.id),
    name: item.name,
    description: item.description,
    model: item.model,
    serial: item.serial_number,
    color: item.color,
    lastLocation: item.branch,
    reportedBy: item.user_id ? `User #${item.user_id}` : undefined,
    reportedAt,
    status: item.status,
  };
}

