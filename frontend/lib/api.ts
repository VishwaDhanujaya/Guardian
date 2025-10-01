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
};

export type Report = {
  id: string;
  title: string;
  category: "Safety" | "Crime" | "Maintenance" | "Other";
  location: string;
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

export type CreateReportPayload = {
  description: string;
  latitude?: number;
  longitude?: number;
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

  const data = await unwrap<any>(
    apiService.post<ApiEnvelope<any>>("/api/v1/reports", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );

  const id = toStringId(data?.id);
  const status = mapReportStatus(data?.status);

  return {
    id,
    title: data?.description ? data.description.slice(0, 80) : `Report #${id}`,
    citizen: data?.user_id ? `Citizen #${data.user_id}` : "Unknown",
    status,
    reportedAgo: formatRelative(data?.createdAt ?? null),
    suggestedPriority: mapPriority(data?.priority),
    rawStatus: (data?.status as BackendReportStatus) ?? "PENDING",
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
    return {
      id,
      title: report.description ? report.description.slice(0, 80) : `Report #${id}`,
      citizen: report.user_id ? `Citizen #${report.user_id}` : "Unknown",
      status,
      reportedAgo: formatRelative(report.createdAt ?? null),
      suggestedPriority: mapPriority(report.priority),
      rawStatus: (report.status as BackendReportStatus) ?? "PENDING",
    };
  });
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
  return {
    id: toStringId(report.id),
    title,
    category: "Safety",
    location: formatLocation(report.latitude, report.longitude),
    reportedBy: report.user_id ? `Citizen #${report.user_id}` : "Unknown",
    reportedAt: formatRelative(report.createdAt ?? null),
    status: mapReportStatus(report.status),
    priority: mapPriority(report.priority),
    description: report.description ?? "",
    notes: Array.isArray(notes) ? notes.map(mapNote) : [],
    images: report.images ?? [],
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
  branch?: string;
  status?: LostFrontendStatus;
  createdAt?: string | null;
};

export type LostItemDetail = FoundItemDetail & {
  reportedBy?: string;
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
  return (Array.isArray(data) ? data : [])
    .filter((item) => item.status === "FOUND")
    .map((item) => ({
      id: toStringId(item.id),
      title: item.name ?? "Unknown item",
      meta: [item.branch, formatRelative(item.created_at ?? null)].filter(Boolean).join(" · "),
    }));
}

function mapLostItem(item: any): FoundItemDetail {
  return {
    id: toStringId(item?.id),
    name: item?.name ?? "",
    description: item?.description ?? "",
    model: item?.model ?? "",
    serial: item?.serial_number ?? "",
    color: item?.color ?? "",
    lastLocation: item?.latitude && item?.longitude ? formatLocation(item.latitude, item.longitude) : item?.last_location ?? "",
    branch: item?.branch ?? "",
    status: mapLostStatusFromBackend(item?.status ?? undefined),
    createdAt: item?.created_at ?? null,
  };
}

function mapLostItemDetail(item: any): LostItemDetail {
  return {
    ...mapLostItem(item),
    reportedBy: item?.user_id ? `Citizen #${item.user_id}` : undefined,
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
