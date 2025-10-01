// app/home.tsx
import { router, useLocalSearchParams } from 'expo-router';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FC,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppCard, AppScreen, Pill, SectionHeader, ScreenHeader } from '@/components/app/shell';
import { toast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { fetchAlerts, fetchLostItems, fetchReports, formatRelativeTime, type AlertRow, type LostItemDetail, type ReportSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AuthContext } from '@/context/AuthContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';


import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PackageSearch,
  Shield,
  ShieldPlus,
  SunMedium,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react-native';

type Role = 'citizen' | 'officer';
type IconType = ComponentType<{ size?: number; color?: string }>;
type Tone = 'primary' | 'ring' | 'accent' | 'destructive' | 'foreground';

/** Tailwind tone → class maps (BG/Text variants and faint BG) */
const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary',
  ring: 'bg-ring',
  accent: 'bg-accent',
  destructive: 'bg-destructive',
  foreground: 'bg-foreground',
};
const TONE_TEXT: Record<Tone, string> = {
  primary: 'text-primary',
  ring: 'text-ring',
  accent: 'text-accent',
  destructive: 'text-destructive',
  foreground: 'text-foreground',
};
const TONE_BG_FAINT: Record<Tone, string> = {
  primary: 'bg-primary/10',
  ring: 'bg-ring/10',
  accent: 'bg-accent/10',
  destructive: 'bg-destructive/10',
  foreground: 'bg-foreground/10',
};

/**
 * Role-aware dashboard screen.
 * - Renders citizen/officer home with mock data and subtle entrance animations.
 * - Provides quick navigation to incidents flows and common actions.
 * - Pulls authenticated profile details to personalise the greeting.
 */
export default function Home() {
  const params = useLocalSearchParams<{ role?: string }>();
  const {
    session,
    isOfficer: officerFromContext,
    profile,
    profileLoading,
    refreshProfile,
  } = useContext(AuthContext);
  const layout = useResponsiveLayout();

  const role = useMemo<Role>(() => {
    if (params.role === 'officer') return 'officer';
    if (params.role === 'citizen') return 'citizen';
    if (profile?.isOfficer) return 'officer';
    return officerFromContext ? 'officer' : 'citizen';
  }, [officerFromContext, params.role, profile?.isOfficer]);

  const roleLabel = role === 'officer' ? 'Officer' : 'Citizen';

  // Greeting + date (local)
  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const displayName = useMemo(() => {
    if (!profile) return 'neighbor';
    return profile.name?.trim?.() || profile.username || 'neighbor';
  }, [profile]);

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [lostItems, setLostItems] = useState<LostItemDetail[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!session) {
      setReports([]);
      setAlerts([]);
      setLostItems([]);
      return;
    }

    setDataLoading(true);
    setDataError(null);

    const [reportsResult, alertsResult, lostResult] = await Promise.allSettled([
      fetchReports(),
      fetchAlerts(),
      fetchLostItems(),
    ]);

    const failures: string[] = [];

    if (reportsResult.status === 'fulfilled') {
      setReports(reportsResult.value);
    } else {
      failures.push('reports');
    }

    if (alertsResult.status === 'fulfilled') {
      setAlerts(alertsResult.value);
    } else {
      failures.push('alerts');
    }

    if (lostResult.status === 'fulfilled') {
      setLostItems(lostResult.value);
    } else {
      failures.push('lost & found');
    }

    if (failures.length > 0) {
      const message = `Failed to load ${failures.join(', ')} data`;
      setDataError(message);
      toast.error(message);
    }

    setDataLoading(false);
  }, [session]);

  const pendingReports = useMemo(
    () => reports.filter((report) => report.status === 'New' || report.status === 'In Review'),
    [reports],
  );
  const ongoingReports = useMemo(
    () =>
      reports.filter((report) =>
        report.status === 'Approved' ||
        report.status === 'Assigned' ||
        report.status === 'Ongoing',
      ),
    [reports],
  );

  const overview = useMemo(
    () => ({
      pendingReports: pendingReports.length,
      ongoingReports: ongoingReports.length,
    }),
    [pendingReports.length, ongoingReports.length],
  );

  const openLostItems = useMemo(
    () => lostItems.filter((item) => item.status !== 'Returned'),
    [lostItems],
  );

  const officerCounts = useMemo(
    () => ({
      incidents: reports.length,
      lostFound: openLostItems.length,
      alerts: alerts.length,
    }),
    [reports.length, openLostItems.length, alerts.length],
  );

  const citizenCounts = useMemo(
    () => ({
      lostFound: lostItems.length,
      myReports: reports.length,
      alerts: alerts.length,
    }),
    [lostItems.length, reports.length, alerts.length],
  );

  const citizenAlerts = useMemo<ListItem[]>(
    () =>
      alerts.slice(0, 4).map((alert) => ({
        id: alert.id,
        title: alert.title || 'Safety alert',
        meta: [
          formatAlertCategory(alert.type),
          formatRelativeTime(alert.createdAt ?? null),
        ]
          .filter(Boolean)
          .join(' · '),
        icon: alertIconForType(alert.type),
        tone: resolveAlertListTone(alert.type),
      })),
    [alerts],
  );

  const citizenRecent = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    reports.slice(0, 2).forEach((report) => {
      items.push({
        id: `report-${report.id}`,
        title: `Reported: ${report.title}`,
        meta: `${report.status} · ${report.reportedAgo}`,
        icon: FileText,
        tone:
          report.status === 'Resolved'
            ? 'accent'
            : report.status === 'New' || report.status === 'In Review'
            ? 'primary'
            : 'ring',
      });
    });

    if (lostItems.length > 0) {
      const first = lostItems[0];
      items.push({
        id: `lost-${first.id}`,
        title: `Lost item: ${first.name}`,
        meta: [first.status ?? 'New', formatRelativeTime(first.createdAt ?? null)]
          .filter(Boolean)
          .join(' · '),
        icon: PackageSearch,
        tone: 'accent',
      });
    }

    if (alerts.length > 0) {
      const firstAlert = alerts[0];
      items.push({
        id: `alert-${firstAlert.id}`,
        title: `Alert viewed: ${firstAlert.title}`,
        meta: formatRelativeTime(firstAlert.createdAt ?? null),
        icon: BellRing,
        tone: 'ring',
      });
    }

    return items.slice(0, 4);
  }, [reports, lostItems, alerts]);

  const officerQueue = useMemo<ListItem[]>(
    () =>
      reports
        .filter((report) => report.status === 'New' || report.status === 'In Review')
        .slice(0, 4)
        .map((report) => ({
          id: report.id,
          title: report.title,
          meta: `${report.suggestedPriority} · ${report.reportedAgo}`,
          icon: report.suggestedPriority === 'Urgent' ? AlertTriangle : FileText,
          tone: report.suggestedPriority === 'Urgent' ? 'destructive' : 'primary',
        })),
    [reports],
  );

  const safetyAlertsPreviewAll = useMemo<ListItem[]>(
    () =>
      alerts.slice(0, 4).map((alert) => ({
        id: alert.id,
        title: alert.title || 'Safety alert',
        meta: formatRelativeTime(alert.createdAt ?? null),
        icon: Megaphone,
        tone: resolveAlertListTone(alert.type),
      })),
    [alerts],
  );

  // Conditional alert banner
  const showBanner =
    role === 'officer'
      ? officerQueue.some((i) => i.tone === 'destructive')
      : citizenAlerts.some((i) => i.tone === 'destructive');

  // Chatbot (citizen only)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');

  // Pull-to-refresh (refresh profile and surface subtle motion)
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    if (!session) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    Promise.all([
      refreshProfile().catch(() => {
        toast.error('Failed to refresh profile');
      }),
      loadDashboardData().catch(() => {}),
    ]).finally(() => {
      setRefreshing(false);
    });
  }, [session, refreshProfile, loadDashboardData]);

  const onSignOut = () => router.replace('/login');

  useEffect(() => {
    if (profile || profileLoading) return;
    refreshProfile().catch(() => {
      toast.error('Failed to load profile');
    });
  }, [profile, profileLoading, refreshProfile]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, role]);

  // KPI trends (simple counts mapped to up-trend chips when data exists)
  const trends = useMemo(
    () => ({
      pendingReports:
        pendingReports.length > 0
          ? { dir: 'up' as const, pct: pendingReports.length, tone: 'primary' as Tone }
          : undefined,
      ongoingReports:
        ongoingReports.length > 0
          ? { dir: 'up' as const, pct: ongoingReports.length, tone: 'ring' as Tone }
          : undefined,
    }),
    [pendingReports.length, ongoingReports.length],
  );

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0.9)).current;
  const sectionAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.9))).current;

  useEffect(() => {
    Animated.spring(headerAnim, {
      toValue: 1,
      damping: 14,
      stiffness: 160,
      mass: 0.6,
      useNativeDriver: true,
    }).start();

    Animated.stagger(
      90,
      sectionAnims.map((a) =>
        Animated.spring(a, {
          toValue: 1,
          damping: 14,
          stiffness: 160,
          mass: 0.6,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [headerAnim, sectionAnims]);

  const animStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  });

  // Navigation helpers
  const goIncidentsIndex = () => router.push({ pathname: '/incidents', params: { role } }); // Citizen: report flow index
  const goManageIncidentsPending = () =>
    router.push({ pathname: '/incidents/manage-incidents', params: { role, tab: 'pending' } }); // Officer: land on Pending

  // Lost & Found routes
  const goLostFoundCitizen = () =>
    router.push({ pathname: '/lost-found/citizen', params: { role, tab: 'found' } });

  const goOfficerLostPending = () =>
    router.push({ pathname: '/lost-found/officer-lost', params: { role, tab: 'pending' } });

  const goOfficerFound = () =>
    router.push({ pathname: '/lost-found/officer-found', params: { role } });

  // Safety alerts routes
  const goCitizenAlerts = () => router.push({ pathname: '/alerts/citizen', params: { role } });

  const goManageAlerts = () => router.push({ pathname: '/alerts/manage', params: { role } });

  const goMyReports = () => router.push({ pathname: '/incidents/my-reports', params: { role } });

  return (
    <AppScreen
      scrollViewProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
        keyboardShouldPersistTaps: 'handled',
      }}
      contentClassName="flex-1 gap-6"
      floatingAction={
        role === 'citizen' ? (
          <ChatbotWidget
            open={chatOpen}
            onToggle={() => setChatOpen((v) => !v)}
            message={chatMessage}
            setMessage={setChatMessage}
          />
        ) : undefined
      }
    >
      {/* Header + hero */}
      <Animated.View style={animStyle(headerAnim)} className="gap-4">
          <ScreenHeader
            title="Dashboard"
            subtitle={dateStr}
            icon={LayoutDashboard}
            action={<Pill tone="primary" label={roleLabel} />}
          />

              {showBanner ? (
                <AppCard
                  className={cn(
                    'flex-row flex-wrap items-center gap-3 border border-destructive/40',
                    layout.isCozy && 'flex-col items-start text-left',
                  )}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle size={18} color="#B91C1C" />
                  </View>
                  <Text
                    className={cn(
                      'text-[13px] text-destructive',
                      layout.isCozy ? 'text-left' : 'flex-1',
                    )}
                  >
                    If this is an emergency, please call 119 immediately.
                  </Text>
                </AppCard>
              ) : null}

              {dataError ? (
                <AppCard
                  className={cn(
                    'flex-row flex-wrap items-center gap-3 border border-destructive/40 bg-destructive/10 p-4',
                    layout.isCozy && 'flex-col items-start text-left',
                  )}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle size={16} color="#B91C1C" />
                  </View>
                  <View className={cn('gap-1', layout.isCozy ? 'w-full' : 'flex-1')}>
                    <Text className="text-sm font-semibold text-destructive">Some data failed to load</Text>
                    <Text className="text-xs text-destructive/80" numberOfLines={2}>
                      {dataError}
                    </Text>
                  </View>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={loadDashboardData}
                    className={cn('h-9 rounded-full px-3', layout.isCozy && 'w-full justify-center')}
                    disabled={dataLoading}
                  >
                    <Text className="text-[12px] text-foreground">Retry</Text>
                  </Button>
                </AppCard>
              ) : null}

              <AppCard className="gap-4">
                <SectionHeader
                  eyebrow="Today"
                  title={`${greeting}, ${displayName}`}
                  description="Here’s what’s happening around your community."
                  trailing={
                    <View className="flex-row items-center gap-2">
                      {profileLoading ? <ActivityIndicator size="small" color="#0F172A" /> : null}
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <SunMedium size={20} color="#0F172A" />
                      </View>
                    </View>
                  }
                />

                <View className="flex-row items-center gap-2 rounded-full bg-muted px-3 py-1">
                  <CalendarDays size={14} color="#0F172A" />
                  <Text className="text-xs font-medium text-muted-foreground">{dateStr}</Text>
                </View>

                <Text className="text-sm text-muted-foreground">
                  Your dashboard adapts for the {roleLabel.toLowerCase()} experience.
                </Text>
              </AppCard>
      </Animated.View>

      {/* Main sections */}
      <View className="gap-6">
          {role === 'officer' ? (
            <>
              <Animated.View style={animStyle(sectionAnims[0])}>
                <Card>
                  <CardHeader title="Overview" tone="ring" />
                      <View
                        className={cn(
                          'mt-3 gap-3',
                          layout.isCozy ? 'flex-col' : 'flex-row',
                        )}
                      >
                        <Kpi
                          label="Pending reports"
                          value={overview.pendingReports}
                          tone="primary"
                          trend={trends.pendingReports}
                        />
                        <Kpi
                          label="Ongoing reports"
                          value={overview.ongoingReports}
                          tone="ring"
                          trend={trends.ongoingReports}
                        />
                      </View>
                    </Card>
                  </Animated.View>

                  <Animated.View style={animStyle(sectionAnims[1])}>
                    <Card>
                      <CardHeader title="Manage" tone="primary" />
                      {/* Order controls left/right columns:
                          0 (left), 1 (right), 2 (left), 3 (right) */}
                      <TileGrid
                        tiles={[
                          {
                            label: 'Manage incidents',
                            icon: Shield,
                            onPress: goManageIncidentsPending,
                            count: officerCounts.incidents,
                          }, // left row 1
                          {
                            label: 'Lost items',
                            icon: PackageSearch,
                            onPress: goOfficerLostPending,
                            variant: 'secondary',
                            count: officerCounts.lostFound,
                          }, // right row 1
                          {
                            label: 'Safety alerts',
                            icon: BellRing,
                            onPress: goManageAlerts,
                            count: officerCounts.alerts,
                          }, // left row 2
                          {
                            label: 'Found items',
                            icon: PackageSearch,
                            onPress: goOfficerFound,
                            variant: 'secondary',
                          }, // right row 2
                        ]}
                      />
                    </Card>
                  </Animated.View>

                  <Animated.View style={animStyle(sectionAnims[2])}>
                    <Card>
                      <CardHeader
                        title="Incoming queue"
                        tone="accent"
                        actionLabel="See all"
                        onAction={goManageIncidentsPending}
                      />
                      <List
                        items={officerQueue}
                        className="mt-2"
                        emptyTitle={dataLoading ? 'Loading queue…' : 'No items in the queue'}
                        emptySubtitle={
                          dataLoading
                            ? 'Syncing the latest incident reports.'
                            : 'You’re all caught up. New reports will appear here.'
                        }
                        emptyIcon={dataLoading ? Clock : Inbox}
                        emptyTone="ring"
                        onItemPress={goManageIncidentsPending}
                      />
                    </Card>
                  </Animated.View>

                  <Animated.View style={animStyle(sectionAnims[3])}>
                    <Card>
                      <CardHeader
                        title="Manage safety alerts"
                        tone="ring"
                        actionLabel="Manage"
                        onAction={goManageAlerts}
                      />
                      <List
                        items={safetyAlertsPreviewAll}
                        className="mt-2"
                        emptyTitle={dataLoading ? 'Loading alerts…' : 'No safety alerts'}
                        emptySubtitle={
                          dataLoading
                            ? 'Retrieving active alerts from the server.'
                            : 'When there’s something new, it’ll show up here.'
                        }
                        emptyIcon={dataLoading ? Clock : Inbox}
                        emptyTone="accent"
                        onItemPress={goManageAlerts}
                      />
                    </Card>
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View style={animStyle(sectionAnims[0])}>
                <Card>
                      <CardHeader title="Quick actions" tone="primary" />
                      <TileGrid
                        tiles={[
                          { label: 'Report Incident', icon: ShieldPlus, onPress: goIncidentsIndex },
                          {
                            label: 'Lost & Found',
                            icon: PackageSearch,
                            onPress: goLostFoundCitizen,
                            variant: 'secondary',
                            count: citizenCounts.lostFound,
                          },
                          {
                            label: 'My Reports',
                            icon: ClipboardList,
                            onPress: goMyReports,
                            count: citizenCounts.myReports,
                          },
                          {
                            label: 'Safety Alerts',
                            icon: BellRing,
                            onPress: goCitizenAlerts,
                            variant: 'secondary',
                            count: citizenCounts.alerts,
                          },
                        ]}
                      />
                    </Card>
                  </Animated.View>

                  <Animated.View style={animStyle(sectionAnims[1])}>
                    <Card>
                      <CardHeader
                        title="Safety alerts"
                        tone="destructive"
                        actionLabel="See all"
                        onAction={goCitizenAlerts}
                      />
                      {/* Categories removed from preview for a cleaner lis */}
                      <List
                        items={citizenAlerts}
                        className="mt-2"
                        emptyTitle={dataLoading ? 'Loading alerts…' : 'No nearby alerts'}
                        emptySubtitle={
                          dataLoading
                            ? 'Fetching the latest safety notifications.'
                            : 'Great news — nothing urgent in your area.'
                        }
                        emptyIcon={dataLoading ? Clock : Inbox}
                        emptyTone={dataLoading ? 'ring' : 'primary'}
                      />
                    </Card>
                  </Animated.View>

                  <Animated.View style={animStyle(sectionAnims[2])}>
                    <Card>
                      <CardHeader
                        title="Recent activity"
                        tone="ring"
                        actionLabel="View all"
                        onAction={() => {}}
                      />
                      <Timeline
                        items={citizenRecent}
                        className="mt-3"
                        emptyTitle={dataLoading ? 'Loading activity…' : 'No recent activity'}
                        emptySubtitle={
                          dataLoading
                            ? 'Pulling the latest interactions from the server.'
                            : 'Your actions and updates will appear here.'
                        }
                        emptyIcon={dataLoading ? Clock : Inbox}
                        emptyTone="ring"
                      />
                    </Card>
              </Animated.View>
            </>
          )}
      </View>

      <View>
        <Button onPress={onSignOut} size="lg" className="h-12 rounded-xl">
          <Text className="font-semibold text-primary-foreground">Sign out</Text>
        </Button>
      </View>
    </AppScreen>
  );
}

/**
 * Return a local greeting for the given hour.
 * @param hour - 0–23 hour in local time.
 */
function getGreeting(hour: number): 'Good morning' | 'Good afternoon' | 'Good evening' {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatAlertCategory(type?: string): string {
  if (!type) return 'General';
  return type
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function resolveAlertListTone(type?: string): Tone {
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

function alertIconForType(type?: string): IconType {
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

/* -------------------- UI Partials -------------------- */

/** Card container with standard padding, border, and rounded corners. */
const Card: FC<{ children: ReactNode }> = ({ children }) => <AppCard className="gap-4">{children}</AppCard>;

/**
 * Section header with title, optional action, and tone bar.
 */
const CardHeader: FC<{
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: Tone;
  icon?: IconType;
}> = ({ title, subtitle, actionLabel, onAction, tone = 'foreground', icon: IconCmp = Inbox }) => (
  <View className="flex-row items-start justify-between gap-3">
    <View className="flex-row flex-1 items-center gap-3">
      <View className={`h-11 w-11 items-center justify-center rounded-2xl ${TONE_BG_FAINT[tone]}`}>
        <IconCmp size={20} color="#0F172A" />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        {subtitle ? <Text className="text-xs text-muted-foreground">{subtitle}</Text> : null}
      </View>
    </View>
    {actionLabel ? (
      <Pressable
        onPress={onAction}
        className="flex-row items-center gap-1 rounded-full bg-muted px-3 py-1"
        android_ripple={{ color: 'rgba(0,0,0,0.04)' }}>
        <Text className="text-[12px] font-semibold text-primary">{actionLabel}</Text>
        <ChevronRight size={14} color="#2563EB" />
      </Pressable>
    ) : null}
  </View>
);

/** Compact trend chip (up/down + %). */
const TrendChip: FC<{ dir: 'up' | 'down'; pct: number; tone: Tone }> = ({ dir, pct, tone }) => (
  <View className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${TONE_BG_FAINT[tone]}`}>
    {dir === 'up' ? <TrendingUp size={14} color="#0F172A" /> : <TrendingDown size={14} color="#0F172A" />}
    <Text className={`text-[12px] font-medium ${TONE_TEXT[tone]}`}>
      {dir === 'up' ? '+' : '-'}
      {pct}%
    </Text>
  </View>
);

/** KPI block with optional trend and progress bar. */
const Kpi: FC<{
  label: string;
  value: number | string;
  tone?: Tone;
  trend?: { dir: 'up' | 'down'; pct: number; tone: Tone; progress?: number };
}> = ({ label, value, tone = 'foreground', trend }) => {
  const progress = trend?.progress;
  const clamped = progress == null ? null : Math.max(0, Math.min(100, progress));

  return (
    <AppCard className="flex-1 gap-3">
      <View className={`h-1 w-12 rounded-full ${TONE_BG[tone]}`} />
      <View className="flex-row items-end justify-between">
        <Text className="text-3xl font-bold text-foreground">{String(value)}</Text>
        {trend ? <TrendChip dir={trend.dir} pct={trend.pct} tone={trend.tone} /> : null}
      </View>
      <Text className="text-xs text-muted-foreground">{label}</Text>
      {clamped != null ? (
        <View className="gap-1">
          <View className="h-2 overflow-hidden rounded-full bg-muted">
            <View className={`h-2 rounded-full ${TONE_BG[tone]}`} style={{ width: `${clamped}%` }} />
          </View>
          <Text className="text-[11px] text-muted-foreground">{clamped}% complete</Text>
        </View>
      ) : null}
    </AppCard>
  );
};

type Tile = {
  label: string;
  icon: IconType;
  onPress?: () => void;
  variant?: 'default' | 'secondary';
  count?: number;
};

/** Responsive 2-column grid of action tiles. */
const TileGrid: FC<{ tiles: Tile[] }> = ({ tiles }) => {
  const layout = useResponsiveLayout();
  const effectiveWidth = Math.min(layout.maxContentWidth, layout.width);
  const singleColumn = effectiveWidth < 320;

  if (singleColumn) {
    return (
      <View className="mt-4 gap-3">
        {tiles.map((tile, idx) => (
          <View key={`${tile.label}-${idx}`} className="w-full">
            <IconTileButton {...tile} />
          </View>
        ))}
      </View>
    );
  }

  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) {
    rows.push(tiles.slice(i, i + 2));
  }

  return (
    <View className="mt-4 flex-col gap-3">
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          className={cn('flex-row gap-3', layout.isCozy ? 'flex-col' : undefined)}
        >
          {row.map((tile, idx) => (
            <View key={`${tile.label}-${idx}`} className={layout.isCozy ? 'w-full' : 'flex-1'}>
              <IconTileButton {...tile} />
            </View>
          ))}
          {row.length === 1 && !layout.isCozy ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
};

/** Action tile button with optional count badge. */
const IconTileButton: FC<Tile> = ({
  label,
  icon: IconCmp,
  onPress,
  variant = 'default',
  count,
}) => {
  const layout = useResponsiveLayout();
  const isSecondary = variant === 'secondary';
  const iconColor = isSecondary ? '#0F172A' : '#1E3A8A';
  const circleTint = isSecondary ? '#E0F2F1' : '#E0EAFF';
  const hasBadge = typeof count === 'number' && count > 0;
  const cardPadding = layout.isCozy ? 'px-5 py-5' : 'px-6 py-6';
  const minHeight = layout.isCozy ? 136 : 148;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: false }}
      className="w-full active:opacity-95"
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <AppCard
        translucent={isSecondary}
        className={cn('relative items-center justify-center gap-3', cardPadding)}
        style={{ minHeight }}
      >
        {hasBadge ? <Pill label={String(count)} tone="primary" className="absolute right-4 top-4" /> : null}
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: circleTint }}
        >
          <IconCmp size={28} color={iconColor} />
        </View>
        <Text numberOfLines={2} className="text-center text-sm font-semibold leading-tight text-foreground">
          {label}
        </Text>
      </AppCard>
    </Pressable>
  );
};

type ListItem = {
  id: string;
  title: string;
  meta?: string;
  icon: IconType;
  tone: Tone;
  category?: string;
};

/** Empty state block used by list/timeline components. */
const EmptyState: FC<{
  title: string;
  subtitle?: string;
  icon?: IconType;
  tone?: Tone;
}> = ({ title, subtitle, icon: IconCmp = Inbox, tone = 'ring' }) => (
  <View className="items-center justify-center gap-3 py-6">
    <View className={`h-12 w-12 items-center justify-center rounded-full ${TONE_BG_FAINT[tone]}`}>
      <IconCmp size={22} color="#0F172A" />
    </View>
    <Text className="text-sm font-semibold text-foreground">{title}</Text>
    {subtitle ? <Text className="px-4 text-center text-xs text-muted-foreground">{subtitle}</Text> : null}
  </View>
);

/** Generic list with icon, title, and meta; shows empty state when needed, supports onPress per row. */
const List: FC<{
  items: ListItem[];
  className?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyIcon?: IconType;
  emptyTone?: Tone;
  onItemPress?: (item: ListItem) => void;
}> = ({
  items,
  className,
  emptyTitle = 'Nothing yet.',
  emptySubtitle,
  emptyIcon,
  emptyTone = 'ring',
  onItemPress,
}) => {
  const layout = useResponsiveLayout();
  if (!items || items.length === 0) {
    return (
      <AppCard className={cn('mt-3', className)}>
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} icon={emptyIcon} tone={emptyTone} />
      </AppCard>
    );
  }
  return (
    <View className={cn('mt-3 gap-3', className)}>
      {items.map((it) => {
        const RowContent = (
          <View
            className={cn(
              'flex-row flex-wrap items-center gap-3',
              layout.isCozy ? 'justify-start' : 'justify-between',
            )}
          >
            <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-3">
              <View className={`h-10 w-10 items-center justify-center rounded-2xl ${TONE_BG_FAINT[it.tone]}`}>
                <it.icon size={20} color="#0F172A" />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-sm font-medium text-foreground">{it.title}</Text>
                {it.meta ? <Text className={`text-xs ${TONE_TEXT[it.tone]}`}>{it.meta}</Text> : null}
              </View>
            </View>
            <View className="ml-auto flex-row items-center">
              <ChevronRight size={16} color="#94A3B8" />
            </View>
          </View>
        );

        if (onItemPress) {
          return (
            <Pressable
              key={it.id}
              onPress={() => onItemPress(it)}
              android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: false }}
              className="active:opacity-95"
            >
              <AppCard className="py-4">
                {RowContent}
              </AppCard>
            </Pressable>
          );
        }

        return (
          <AppCard key={it.id} className="py-4">
            {RowContent}
          </AppCard>
        );
      })}
    </View>
  );
};

/** Vertical timeline with bullets and a guiding line; includes empty state. */
const Timeline: FC<{
  items: ListItem[];
  className?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyIcon?: IconType;
  emptyTone?: Tone;
}> = ({
  items,
  className,
  emptyTitle = 'No recent activity',
  emptySubtitle,
  emptyIcon,
  emptyTone = 'ring',
}) => {
  if (!items || items.length === 0) {
    return (
      <AppCard className={cn('mt-3', className)}>
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} icon={emptyIcon} tone={emptyTone} />
      </AppCard>
    );
  }

  return (
    <View className={cn('mt-3', className)}>
      <View className="relative pl-8">
        <View className="absolute bottom-4 left-3.5 top-2 w-[1px] bg-muted" />
        {items.map((it, idx) => (
          <View key={it.id} className="relative mb-4">
            <View className={`absolute left-2.5 top-3 h-3 w-3 rounded-full ${TONE_BG[it.tone]}`} />
            <AppCard className="ml-4 gap-1 py-3">
              <View className="flex-row items-center gap-2">
                <it.icon size={16} color="#0F172A" />
                <Text className="text-sm font-medium text-foreground">{it.title}</Text>
              </View>
              {it.meta ? <Text className={`text-xs ${TONE_TEXT[it.tone]}`}>{it.meta}</Text> : null}
            </AppCard>
            {idx === items.length - 1 ? <View className="absolute bottom-[-16px] left-3.5 h-4 w-[1px] bg-white/0" /> : null}
          </View>
        ))}
      </View>
    </View>
  );
};

/** Floating chatbot widget (citizen only). */
const ChatbotWidget: FC<{
  open: boolean;
  onToggle: () => void;
  message: string;
  setMessage: (v: string) => void;
}> = ({ open, onToggle, message, setMessage }) => {
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.max(screenWidth - 40, 0);
  const desiredWidth = Math.max(280, screenWidth - 48);
  const cardWidth = contentWidth > 0 ? Math.min(420, desiredWidth, contentWidth) : Math.min(420, desiredWidth);

  if (!open) {
    return (
      <Button
        onPress={onToggle}
        size="lg"
        className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-black/20"
      >
        <MessageSquare size={24} color="#FFFFFF" />
      </Button>
    );
  }

  return (
    <AppCard className="max-w-full gap-5 p-6" style={{ width: cardWidth, alignSelf: 'flex-end' }}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare size={20} color="#0F172A" />
          </View>
          <View>
            <Text className="font-semibold text-foreground">Guardian assistant</Text>
            <Text className="text-[11px] text-muted-foreground">Ask about incidents, lost &amp; found, and alerts.</Text>
          </View>
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel="Close chat"
          className="h-9 w-9 items-center justify-center rounded-full border border-border bg-white"
          android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
        >
          <X size={18} color="#0F172A" />
        </Pressable>
      </View>

      <View className="rounded-3xl bg-muted p-5">
        <Text className="text-base leading-relaxed text-muted-foreground">
          Hi! I can help with incidents, lost &amp; found, and safety alerts. Ask me anything.
        </Text>
      </View>

      <View className="flex-row items-center gap-3">
        <Label nativeID="chatInput" className="hidden">
          <Text>Message</Text>
        </Label>
        <Input
          aria-labelledby="chatInput"
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message…"
          className="h-12 flex-1 rounded-full bg-white px-4"
          returnKeyType="send"
          onSubmitEditing={() => setMessage('')}
        />
        <Button onPress={() => setMessage('')} className="h-12 rounded-full px-6">
          <Text className="text-primary-foreground">Send</Text>
        </Button>
      </View>
    </AppCard>
  );
};
