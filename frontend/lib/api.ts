import type { AxiosResponse } from "axios";

import { apiService } from "@/services/apiService";

type ApiEnvelope<T> = {
  status: "success" | "error";
  data: T;
  message?: string;
};

async function unwrap<T>(
  promise: Promise<AxiosResponse<ApiEnvelope<T>>>,
): Promise<T> {
  const response = await promise;
  if (response.data.status !== "success") {
    throw new Error(response.data.message ?? "Request failed");
  }
  return response.data.data;
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

function mapNote(note: any): Note {
  const created = note?.created_at ?? note?.createdAt;
  return {
    id: toStringId(note?.id),
    text: note?.content ?? "",
    at: formatRelative(created ?? null),
    by: note?.subject?.trim?.() ? note.subject : "Officer",
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
  witnesses?: any[];
  rawStatus: BackendReportStatus;
};

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
    witnesses: report.witnesses ?? [],
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
  status?: string;
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
    status: item?.status ?? "",
    createdAt: item?.created_at ?? null,
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
  return {
    ...mapLostItem(data),
    reportedBy: data?.user_id ? `Citizen #${data.user_id}` : undefined,
  };
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
