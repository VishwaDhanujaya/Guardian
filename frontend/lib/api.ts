import type { AxiosResponse } from "axios";

import { apiService } from "@/services/apiService";

type ApiEnvelope<T> = {
  status?: "success" | "error" | boolean;
  data: T;
  message?: string;
};

function isApiEnvelope<T>(payload: any): payload is ApiEnvelope<T> {
  return payload != null && typeof payload === "object" && "data" in payload;
}

async function unwrap<T>(
  promise: Promise<AxiosResponse<ApiEnvelope<T> | T>>,
): Promise<T> {
  const response = await promise;
  const payload = response.data as ApiEnvelope<T> | T;

  if (isApiEnvelope<T>(payload)) {
    const status = payload.status;
    if (status === "error" || status === false) {
      throw new Error(payload.message ?? "Request failed");
    }
    return payload.data;
  }

  return payload as T;
}

function getApiBaseUrl(): string {
  const base = apiService.defaults.baseURL ?? "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function toSignedFileUrl(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const baseUrl = getApiBaseUrl();
  const path = `/api/v1/files?token=${encodeURIComponent(trimmed)}`;
  if (!baseUrl) return path;
  return `${baseUrl}${path}`;
}

function toStringId(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

function formatRelative(date: string | null | undefined): string {
  if (!date) {
    return "Just now";
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return parsed.toLocaleDateString();
}

export function formatRelativeTime(
  date: string | null | undefined,
): string {
  return formatRelative(date);
}

type ReportPriority = "Urgent" | "Normal" | "Low";
type BackendReportStatus = "PENDING" | "IN-PROGRESS" | "COMPLETED" | "CLOSED";
type FrontendReportStatus =
  | "New"
  | "In Review"
  | "Approved"
  | "Assigned"
  | "Ongoing"
  | "Resolved";

function mapPriority(priority?: number | null): ReportPriority {
  if (typeof priority !== "number" || Number.isNaN(priority)) {
    return "Normal";
  }
  const normalized = priority > 1 ? priority / 100 : priority;
  if (normalized >= 0.66) {
    return "Urgent";
  }
  if (normalized >= 0.33) {
    return "Normal";
  }
  return "Low";
}

function mapReportStatus(status?: string | null): FrontendReportStatus {
  switch (status) {
    case "PENDING":
      return "In Review";
    case "IN-PROGRESS":
      return "Ongoing";
    case "COMPLETED":
    case "CLOSED":
      return "Resolved";
    default:
      return "New";
  }
}

function mapStatusToBackend(status: FrontendReportStatus): BackendReportStatus {
  switch (status) {
    case "In Review":
    case "New":
      return "PENDING";
    case "Approved":
    case "Assigned":
    case "Ongoing":
      return "IN-PROGRESS";
    case "Resolved":
    default:
      return "COMPLETED";
  }
}

function formatLocation(latitude?: number | null, longitude?: number | null): string {
  if (typeof latitude === "number" && typeof longitude === "number") {
    const lat = latitude.toFixed(3);
    const lon = longitude.toFixed(3);
    return `Lat ${lat}, Lon ${lon}`;
  }
  return "Not specified";
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function fetchMapboxToken(): Promise<string> {
  const data = await unwrap<any>(
    apiService.get<ApiEnvelope<any>>("/api/v1/map-box/token"),
  );

  const token = (data?.token ?? data?.mapBoxToken ?? data) as string | undefined;
  if (typeof token === "string" && token.trim().length > 0) {
    return token.trim();
  }

  throw new Error("Mapbox token is not available");
}

export type ItemNote = { id: string; text: string; at: string; by: string };

function mapNote(note: any): ItemNote {
  const created = note?.created_at ?? note?.createdAt;
  return {
    id: toStringId(note?.id),
    text: note?.content ?? "",
    at: formatRelative(created ?? null),
    by: note?.subject?.trim?.() ? note.subject : "Officer",
  };
}

/**
 * Auth / Profile helpers
 */
export type Profile = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  isOfficer: boolean;
};

export async function fetchProfile(): Promise<Profile> {
  const data = await unwrap<any>(
    apiService.get<ApiEnvelope<any>>("/api/v1/auth/profile"),
  );

  const firstName = data?.first_name?.trim?.() ?? "";
  const lastName = data?.last_name?.trim?.() ?? "";
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    id: toStringId(data?.id),
    username: data?.username ?? "",
    email: data?.email ?? "",
    firstName,
    lastName,
    name: combined || data?.username?.trim?.() || "User",
    isOfficer: Boolean(data?.is_officer),
  };
}

/**
 * Alerts
 */
export type AlertDraft = {
  id?: string;
  title: string;
  description: string;
  type: string;
};

export type AlertRow = {
  id: string;
  title: string;
  description: string;
  type: string;
  createdAt?: string | null;
};

export async function fetchAlerts(): Promise<AlertRow[]> {
  const data = await unwrap<any[]>(
    apiService.get<ApiEnvelope<any[]>>("/api/v1/alerts"),
  );
  return (Array.isArray(data) ? data : []).map((alert) => ({
    id: toStringId(alert.id),
    title: alert.title ?? "",
    description: alert.description ?? "",
    type: alert.type ?? "",
    createdAt: alert.created_at ?? null,
  }));
}

export async function getAlert(id: string): Promise<AlertRow> {
  const data = await unwrap<any>(
    apiService.get<ApiEnvelope<any>>(`/api/v1/alerts/${id}`),
  );
  return {
    id: toStringId(data.id),
    title: data.title ?? "",
    description: data.description ?? "",
    type: data.type ?? "",
    createdAt: data.created_at ?? null,
  };
}

export async function saveAlert(data: AlertDraft): Promise<AlertRow> {
  const payload = {
    title: data.title,
    description: data.description,
    type: data.type,
  };
  const endpoint = data.id
    ? apiService.put<ApiEnvelope<any>>(`/api/v1/alerts/${data.id}`, payload)
    : apiService.post<ApiEnvelope<any>>("/api/v1/alerts", payload);
  const response = await unwrap<any>(endpoint);
  return {
    id: toStringId(response.id),
    title: response.title ?? payload.title,
    description: response.description ?? payload.description,
    type: response.type ?? payload.type,
    createdAt: response.created_at ?? null,
  };
}

export async function deleteAlert(id: string): Promise<void> {
  await apiService.delete(`/api/v1/alerts/${id}`);
}

/**
 * Reports / Incidents
 */
export type Note = { id: string; text: string; at: string; by: string };

export type ReportSummary = {
  id: string;
  title: string;
  citizen: string;
  status: FrontendReportStatus;
  reportedAgo: string;
  suggestedPriority: ReportPriority;
  rawStatus: BackendReportStatus;
  category?: string | null;
  createdAt?: string | null;
};

export type Report = {
  id: string;
  title: string;
  category: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  reportedBy: string;
  reportedAt: string;
  status: FrontendReportStatus;
  priority: ReportPriority;
  description?: string;
  notes: Note[];
  images?: string[];
  witnesses: ReportWitness[];
  rawStatus: BackendReportStatus;
};

function normaliseReportCategory(label: string | null | undefined): string | null {
  if (typeof label !== "string") return null;
  const cleaned = label.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 60) return null;
  const isAllUpper = cleaned === cleaned.toUpperCase();
  const isAllLower = cleaned === cleaned.toLowerCase();
  if (isAllUpper || isAllLower) {
    return cleaned
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return cleaned;
}

function parseReportDescription(raw: any): {
  category: string | null;
  segments: string[];
} {
  if (typeof raw !== "string") {
    return { category: null, segments: [] };
  }

  const parts = raw
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  let category: string | null = null;
  const segments: string[] = [];

  parts.forEach((segment) => {
    if (!category) {
      const bracketMatch = segment.match(/^\[(.+)\]$/);
      if (bracketMatch) {
        const label = normaliseReportCategory(bracketMatch[1]);
        if (label) {
          category = label;
          return;
        }
      }
      const explicitMatch = segment.match(/^Category:\s*(.+)$/i);
      if (explicitMatch) {
        const label = normaliseReportCategory(explicitMatch[1]);
        if (label) {
          category = label;
          return;
        }
      }
    }
    segments.push(segment);
  });

  return { category, segments };
}

function summariseReport(description: any): {
  category: string | null;
  body: string;
  summary: string;
} {
  const parsed = parseReportDescription(description);
  const body = parsed.segments.join("\n\n");
  const summary = parsed.segments.length > 0 ? parsed.segments[0] : "";
  return { category: parsed.category, body, summary };
}

export type CreateReportPayload = {
  description: string;
  latitude?: number;
  longitude?: number;
  photos?: ReportPhoto[];
};

export type ReportPhoto = {
  uri: string;
  name?: string;
  mimeType?: string;
};

export type ReportWitnessPayload = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  contactNumber: string;
};

export type ReportWitness = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  contactNumber: string;
};

function mapReportWitness(data: any): ReportWitness {
  return {
    id: toStringId(data?.id),
    firstName: data?.first_name ?? "",
    lastName: data?.last_name ?? "",
    dateOfBirth: data?.date_of_birth ?? "",
    contactNumber: data?.contact_number ?? "",
  };
}

export async function createReport(
  payload: CreateReportPayload,
): Promise<ReportSummary> {
  const form = new FormData();
  form.append("description", payload.description);
  if (typeof payload.latitude === "number") {
    form.append("latitude", String(payload.latitude));
  }
  if (typeof payload.longitude === "number") {
    form.append("longitude", String(payload.longitude));
  }

  if (Array.isArray(payload.photos)) {
    payload.photos.forEach((photo, index) => {
      if (!photo?.uri) return;
      const name = photo.name?.trim() || `photo-${index + 1}.jpg`;
      const type = photo.mimeType?.trim() || "image/jpeg";
      form.append(
        "photos",
        {
          uri: photo.uri,
          name,
          type,
        } as any,
      );
    });
  }

  const data = await unwrap<any>(
    apiService.post<ApiEnvelope<any>>("/api/v1/reports", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );

  const id = toStringId(data?.id);
  const status = mapReportStatus(data?.status);
  const parsed = summariseReport(data?.description ?? payload.description);
  const titleSource = parsed.summary?.trim?.() ?? "";
  const title = titleSource.length > 0 ? titleSource.slice(0, 80) : `Report #${id}`;

  return {
    id,
    title,
    citizen: data?.user_id ? `Citizen #${data.user_id}` : "Unknown",
    status,
    reportedAgo: formatRelative(data?.createdAt ?? data?.created_at ?? null),
    suggestedPriority: mapPriority(data?.priority),
    rawStatus: (data?.status as BackendReportStatus) ?? "PENDING",
    category: parsed.category,
    createdAt: data?.createdAt ?? data?.created_at ?? null,
  };
}

export async function createReportWitness(
  reportId: string,
  payload: ReportWitnessPayload,
): Promise<ReportWitness> {
  const body = {
    first_name: payload.firstName,
    last_name: payload.lastName,
    date_of_birth: payload.dateOfBirth,
    contact_number: payload.contactNumber,
  };

  const data = await unwrap<any>(
    apiService.post<ApiEnvelope<any>>(`/api/v1/reports/witness/${reportId}`, body),
  );

  return mapReportWitness(data);
}

export async function fetchReports(): Promise<ReportSummary[]> {
  const data = await unwrap<any[]>(
    apiService.get<ApiEnvelope<any[]>>("/api/v1/reports"),
  );
  const list = Array.isArray(data) ? data : [];
  return list.map((report: any) => {
    const id = toStringId(report.id);
    const status = mapReportStatus(report.status);
    const parsed = summariseReport(report.description);
    const summary = parsed.summary?.trim?.() ?? "";
    const titleBase = summary.length > 0 ? summary : parsed.category ?? `Report #${id}`;
    return {
      id,
      title: titleBase.slice(0, 80),
      citizen: report.user_id ? `Citizen #${report.user_id}` : "Unknown",
      status,
      reportedAgo: formatRelative(report.createdAt ?? report.created_at ?? null),
      suggestedPriority: mapPriority(report.priority),
      rawStatus: (report.status as BackendReportStatus) ?? "PENDING",
      category: parsed.category,
      createdAt: report.createdAt ?? report.created_at ?? null,
    };
  });
}

export async function fetchReportNotes(id: string): Promise<Note[]> {
  const data = await unwrap<any[]>(
    apiService.get<ApiEnvelope<any[]>>(`/api/v1/notes/resource/${id}`, {
      params: { resourceType: "report" },
    }),
  );
  return (Array.isArray(data) ? data : []).map(mapNote);
}

export async function getIncident(id: string): Promise<Report> {
  const [report, notes] = await Promise.all([
    unwrap<any>(apiService.get<ApiEnvelope<any>>(`/api/v1/reports/${id}`)),
    unwrap<any[]>(
      apiService.get<ApiEnvelope<any[]>>(`/api/v1/notes/resource/${id}`, {
        params: { resourceType: "report" },
      }),
    ).catch(() => [] as any[]),
  ]);

  const title = report.description ? report.description.slice(0, 80) : `Report #${id}`;
  const parsed = summariseReport(report.description);
  const titleSource = parsed.summary?.trim?.() ?? "";
  const finalTitle = titleSource.length > 0 ? titleSource.slice(0, 80) : title;
  const images = Array.isArray(report.images)
    ? (report.images as unknown[])
        .map((token) => toSignedFileUrl(token))
        .filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  const latitude = toNumberOrNull(report.latitude);
  const longitude = toNumberOrNull(report.longitude);
  const locationText = (() => {
    if (latitude != null && longitude != null) {
      return formatLocation(latitude, longitude);
    }
    const fallback = typeof report.location === "string" ? report.location.trim() : "";
    return fallback.length > 0 ? fallback : formatLocation(undefined, undefined);
  })();
  return {
    id: toStringId(report.id),
    title: finalTitle,
    category: parsed.category ?? "Incident",
    location: locationText,
    latitude,
    longitude,
    reportedBy: report.user_id ? `Citizen #${report.user_id}` : "Unknown",
    reportedAt: formatRelative(report.createdAt ?? report.created_at ?? null),
    status: mapReportStatus(report.status),
    priority: mapPriority(report.priority),
    description: parsed.body || report.description || "",
    notes: Array.isArray(notes) ? notes.map(mapNote) : [],
    images,
    witnesses: Array.isArray(report.witnesses)
      ? report.witnesses.map(mapReportWitness)
      : [],
    rawStatus: (report.status as BackendReportStatus) ?? "PENDING",
  };
}

export async function updateReportStatus(
  id: string,
  status: FrontendReportStatus,
): Promise<void> {
  await unwrap<any>(
    apiService.patch<ApiEnvelope<any>>(`/api/v1/reports/update-status/${id}`, {
      status: mapStatusToBackend(status),
    }),
  );
}

export async function addReportNote(
  reportId: string,
  subject: string,
  content: string,
): Promise<Note> {
  const created = await unwrap<any>(
    apiService.post<ApiEnvelope<any>>(
      `/api/v1/notes/resource/${reportId}`,
      {
        subject,
        content,
      },
      {
        params: { resourceType: "report" },
      },
    ),
  );
  return mapNote(created);
}

/**
 * Lost & Found
 */
type LostBackendStatus = "PENDING" | "INVESTIGATING" | "FOUND" | "CLOSED";
export type LostFrontendStatus =
  | "New"
  | "In Review"
  | "Approved"
  | "Assigned"
  | "Searching"
  | "Returned";

const LOST_STATUS_TO_FRONT: Record<
  LostBackendStatus | "IN-PROGRESS",
  LostFrontendStatus
> = {
  PENDING: "In Review",
  "IN-PROGRESS": "Searching",
  INVESTIGATING: "Searching",
  FOUND: "Returned",
  CLOSED: "Returned",
} as const;

const LOST_FRONT_TO_BACK: Record<LostFrontendStatus, LostBackendStatus> = {
  New: "PENDING",
  "In Review": "PENDING",
  Approved: "INVESTIGATING",
  Assigned: "INVESTIGATING",
  Searching: "INVESTIGATING",
  Returned: "FOUND",
};

function mapLostStatusFromBackend(status?: string | null): LostFrontendStatus {
  if (!status) {
    return "New";
  }
  const normalized = status.toUpperCase() as LostBackendStatus | "IN-PROGRESS";
  return LOST_STATUS_TO_FRONT[normalized as LostBackendStatus] ?? "New";
}

function mapLostStatusToBackend(status: LostFrontendStatus): LostBackendStatus {
  return LOST_FRONT_TO_BACK[status] ?? "PENDING";
}

export type FoundItem = { id: string; title: string; meta: string };

export type FoundItemDetail = {
  id: string;
  name: string;
  description?: string;
  model?: string;
  serial?: string;
  color?: string;
  lastLocation?: string;
  latitude?: number | null;
  longitude?: number | null;
  branch?: string;
  status?: LostFrontendStatus;
  createdAt?: string | null;
};

export type LostItemDetail = FoundItemDetail & {
  reportedBy?: string;
  reportedById?: string | null;
};

export type LostItemPayload = {
  itemName: string;
  description?: string;
  model?: string;
  serial?: string;
  color?: string;
  branch: string;
  latitude: number;
  longitude: number;
  status?: "PENDING" | "INVESTIGATING" | "FOUND" | "CLOSED";
};

export async function fetchFoundItems(): Promise<FoundItem[]> {
  const data = await unwrap<any[]>(
    apiService.get<ApiEnvelope<any[]>>("/api/v1/lost-articles/all"),
  );
  const returnedStatuses = new Set(["FOUND", "CLOSED"]);
  return (Array.isArray(data) ? data : [])
    .filter((item) => returnedStatuses.has(item.status))
    .map((item) => ({
      id: toStringId(item.id),
      title: item.name ?? "Unknown item",
      meta: [item.branch, formatRelative(item.created_at ?? null)].filter(Boolean).join(" · "),
    }));
}

function mapLostItem(item: any): FoundItemDetail {
  const latitude = toNumberOrNull(item?.latitude);
  const longitude = toNumberOrNull(item?.longitude);
  const fallbackLocation = typeof item?.last_location === "string" ? item.last_location.trim() : "";
  const lastLocation =
    latitude != null && longitude != null
      ? formatLocation(latitude, longitude)
      : fallbackLocation;
  return {
    id: toStringId(item?.id),
    name: item?.name ?? "",
    description: item?.description ?? "",
    model: item?.model ?? "",
    serial: item?.serial_number ?? "",
    color: item?.color ?? "",
    lastLocation,
    latitude,
    longitude,
    branch: item?.branch ?? "",
    status: mapLostStatusFromBackend(item?.status ?? undefined),
    createdAt: item?.created_at ?? null,
  };
}

function mapLostItemDetail(item: any): LostItemDetail {
  return {
    ...mapLostItem(item),
    reportedBy: item?.user_id ? `Citizen #${item.user_id}` : undefined,
    reportedById: item?.user_id != null ? toStringId(item.user_id) : undefined,
  };
}

export async function getFoundItem(id: string): Promise<FoundItemDetail> {
  const data = await unwrap<any>(
    apiService.get<ApiEnvelope<any>>(`/api/v1/lost-articles/${id}`),
  );
  return mapLostItem(data);
}

export async function getLostItem(id: string): Promise<LostItemDetail> {
  const data = await unwrap<any>(
    apiService.get<ApiEnvelope<any>>(`/api/v1/lost-articles/${id}`),
  );
  return mapLostItemDetail(data);
}

export async function reportLostItem(payload: LostItemPayload): Promise<void> {
  const form = new FormData();
  form.append("name", payload.itemName);
  form.append("description", payload.description ?? "");
  if (payload.serial) form.append("serial_number", payload.serial);
  if (payload.color) form.append("color", payload.color);
  if (payload.model) form.append("model", payload.model);
  form.append("longitude", String(payload.longitude));
  form.append("latitude", String(payload.latitude));
  form.append("status", payload.status ?? "PENDING");
  form.append("branch", payload.branch);

  await unwrap<any>(
    apiService.post<ApiEnvelope<any>>("/api/v1/lost-articles", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );
}

export async function fetchLostItems(): Promise<LostItemDetail[]> {
  const data = await unwrap<any[]>(
    apiService.get<ApiEnvelope<any[]>>("/api/v1/lost-articles/all"),
  );
  return (Array.isArray(data) ? data : []).map(mapLostItemDetail);
}

export type LostItemUpdatePayload = {
  name?: string;
  description?: string;
  model?: string;
  serial?: string;
  color?: string;
  branch?: string;
  latitude?: number;
  longitude?: number;
  status?: LostFrontendStatus;
};

function toLostItemUpdateBody(payload: Partial<LostItemUpdatePayload>) {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.model !== undefined) body.model = payload.model;
  if (payload.serial !== undefined) body.serial_number = payload.serial;
  if (payload.color !== undefined) body.color = payload.color;
  if (payload.branch !== undefined) body.branch = payload.branch;
  if (payload.latitude !== undefined) body.latitude = payload.latitude;
  if (payload.longitude !== undefined) body.longitude = payload.longitude;
  if (payload.status !== undefined)
    body.status = mapLostStatusToBackend(payload.status);
  return body;
}

export async function updateLostItem(
  id: string,
  payload: Partial<LostItemUpdatePayload>,
): Promise<LostItemDetail> {
  const body = toLostItemUpdateBody(payload);
  const data = await unwrap<any>(
    apiService.patch<ApiEnvelope<any>>(`/api/v1/lost-articles/${id}`, body),
  );
  return mapLostItemDetail(data);
}

export async function updateLostItemStatus(
  id: string,
  status: LostFrontendStatus,
): Promise<LostItemDetail> {
  const data = await unwrap<any>(
    apiService.patch<ApiEnvelope<any>>(`/api/v1/lost-articles/${id}/status`, {
      status: mapLostStatusToBackend(status),
    }),
  );
  return mapLostItemDetail(data);
}

export async function fetchLostItemNotes(id: string): Promise<ItemNote[]> {
  const data = await unwrap<any[]>(
    apiService.get<ApiEnvelope<any[]>>(`/api/v1/notes/resource/${id}`, {
      params: { resourceType: "lost-article" },
    }),
  );
  return (Array.isArray(data) ? data : []).map(mapNote);
}

export async function addLostItemNote(
  id: string,
  subject: string,
  content: string,
): Promise<ItemNote> {
  const data = await unwrap<any>(
    apiService.post<ApiEnvelope<any>>(`/api/v1/notes/resource/${id}`, {
      subject,
      content,
    }, {
      params: { resourceType: "lost-article" },
    }),
  );
  return mapNote(data);
}

export type FoundItemPostPayload = {
  name: string;
  description?: string;
  model?: string;
  serial?: string;
  color?: string;
  branch: string;
  latitude?: number;
  longitude?: number;
  status?: LostFrontendStatus;
};

export async function createFoundItem(
  payload: FoundItemPostPayload,
): Promise<LostItemDetail> {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("description", payload.description ?? "");
  if (payload.serial) form.append("serial_number", payload.serial);
  if (payload.color) form.append("color", payload.color);
  if (payload.model) form.append("model", payload.model);
  form.append("longitude", String(payload.longitude ?? 0));
  form.append("latitude", String(payload.latitude ?? 0));
  form.append(
    "status",
    mapLostStatusToBackend(payload.status ?? "Returned"),
  );
  form.append("branch", payload.branch);

  const data = await unwrap<any>(
    apiService.post<ApiEnvelope<any>>("/api/v1/lost-articles", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );

  return mapLostItemDetail(data);
}
