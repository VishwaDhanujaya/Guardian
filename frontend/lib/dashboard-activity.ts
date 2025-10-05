import type { ComponentType } from 'react';

import {
  AlertTriangle,
  BellRing,
  FileText,
  Megaphone,
  PackageSearch,
  SunMedium,
} from 'lucide-react-native';

import { formatRelativeTime, type AlertRow, type LostItemDetail, type ReportSummary } from '@/lib/api';

export type IconType = ComponentType<{ size?: number; color?: string }>;
export type Tone = 'primary' | 'ring' | 'accent' | 'destructive' | 'foreground';

export type ActivityItem = {
  id: string;
  title: string;
  meta?: string;
  icon: IconType;
  tone: Tone;
  occurredAt: number;
};

export type BuildActivityFeedOptions = {
  /** Maximum number of combined items to return. */
  limit?: number;
  /** How many items to take from each source before merging (default: 2). */
  perSourceLimit?: number;
};

function toTimestamp(value?: string | null): number {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return 0;
  }
  return time;
}

function normaliseLimit(limit: number | undefined, defaultLimit: number): number | undefined {
  if (limit == null) {
    return defaultLimit;
  }
  if (limit <= 0) {
    return 0;
  }
  if (!Number.isFinite(limit)) {
    return undefined;
  }
  return Math.floor(limit);
}

/** Human readable label for alert categories. */
export function formatAlertCategory(type?: string): string {
  if (!type) return 'General';
  return type
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** Tone for alert list items based on category. */
export function resolveAlertListTone(type?: string): Tone {
  if (!type) return 'ring';
  const key = type.toLowerCase();
  if (key.includes('emergency') || key.includes('urgent') || key.includes('critical')) {
    return 'destructive';
  }
  if (key.includes('weather') || key.includes('storm') || key.includes('rain')) {
    return 'primary';
  }
  if (key.includes('maintenance') || key.includes('power') || key.includes('utility')) {
    return 'accent';
  }
  return 'ring';
}

/** Icon used for alerts in activity feeds. */
export function alertIconForType(type?: string): IconType {
  const key = type?.toLowerCase() ?? '';
  if (key.includes('emergency') || key.includes('critical')) {
    return AlertTriangle;
  }
  if (key.includes('weather') || key.includes('storm') || key.includes('rain')) {
    return BellRing;
  }
  if (key.includes('power') || key.includes('maintenance') || key.includes('utility')) {
    return SunMedium;
  }
  return Megaphone;
}

/**
 * Create a merged, chronologically sorted activity feed using the dashboard data sources.
 */
export function buildActivityFeed(
  reports: ReportSummary[],
  lostItems: LostItemDetail[],
  alerts: AlertRow[],
  options: BuildActivityFeedOptions = {},
): ActivityItem[] {
  const perSourceLimit = normaliseLimit(options.perSourceLimit, 2);

  const limitPerSource = <T>(items: T[]): T[] => {
    if (perSourceLimit === 0) {
      return [];
    }
    if (perSourceLimit == null) {
      return items;
    }
    return items.slice(0, perSourceLimit);
  };

  const sortedReports = [...reports].sort(
    (a, b) => toTimestamp(b.createdAt ?? null) - toTimestamp(a.createdAt ?? null),
  );
  const sortedLost = [...lostItems].sort(
    (a, b) => toTimestamp(b.createdAt ?? null) - toTimestamp(a.createdAt ?? null),
  );
  const sortedAlerts = [...alerts].sort(
    (a, b) => toTimestamp(b.createdAt ?? null) - toTimestamp(a.createdAt ?? null),
  );

  const reportItems: ActivityItem[] = limitPerSource(sortedReports).map((report) => {
    const occurredAt = toTimestamp(report.createdAt ?? null);
    const relative =
      report.createdAt != null ? formatRelativeTime(report.createdAt) : report.reportedAgo;
    const metaParts = [report.status, relative ?? report.reportedAgo].filter(Boolean);
    const tone: Tone =
      report.status === 'Resolved'
        ? 'accent'
        : report.status === 'New' || report.status === 'In Review'
        ? 'primary'
        : 'ring';
    return {
      id: `report-${report.id}`,
      title: `Report update: ${report.title}`,
      meta: metaParts.join(' · '),
      icon: FileText,
      tone,
      occurredAt,
    };
  });

  const lostItemsEntries: ActivityItem[] = limitPerSource(sortedLost).map((item) => {
    const occurredAt = toTimestamp(item.createdAt ?? null);
    const relative = formatRelativeTime(item.createdAt ?? null);
    const statusLabel = item.status ?? 'In Review';
    const tone: Tone = statusLabel === 'Returned' ? 'accent' : 'primary';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const displayName = name.length > 0 ? name : 'Lost item report';
    const prefix = statusLabel === 'Returned' ? 'Item returned' : 'Lost item';
    return {
      id: `lost-${item.id}`,
      title: `${prefix}: ${displayName}`,
      meta: [statusLabel, relative].filter(Boolean).join(' · '),
      icon: PackageSearch,
      tone,
      occurredAt,
    };
  });

  const alertEntries: ActivityItem[] = limitPerSource(sortedAlerts).map((alert) => {
    const occurredAt = toTimestamp(alert.createdAt ?? null);
    const relative = formatRelativeTime(alert.createdAt ?? null);
    const category = formatAlertCategory(alert.type);
    return {
      id: `alert-${alert.id}`,
      title: alert.title?.trim() ? alert.title : 'Safety alert',
      meta: [category, relative].filter(Boolean).join(' · '),
      icon: alertIconForType(alert.type),
      tone: resolveAlertListTone(alert.type),
      occurredAt,
    };
  });

  const merged = [...reportItems, ...lostItemsEntries, ...alertEntries].sort(
    (a, b) => b.occurredAt - a.occurredAt,
  );

  const overallLimit = normaliseLimit(options.limit, merged.length);
  if (overallLimit === 0) {
    return [];
  }
  if (overallLimit == null) {
    return merged;
  }
  return merged.slice(0, overallLimit);
}

