import { useQuery } from '@tanstack/react-query';
import client from './client';

// --- Admin ---
export function useAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => client.get('/admin/analytics').then(r => r.data),
    staleTime: 60_000,
  });
}

export function useWorkerHealth() {
  return useQuery({
    queryKey: ['admin', 'worker-health'],
    queryFn: () => client.get('/admin/worker/health').then(r => r.data),
    refetchInterval: 30_000,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: () => client.get('/admin/alerts').then(r => r.data),
    staleTime: 30_000,
  });
}

export function useCrawlAnalytics() {
  return useQuery({
    queryKey: ['admin', 'crawl-analytics'],
    queryFn: () => client.get('/admin/analytics/crawls').then(r => r.data),
    staleTime: 60_000,
  });
}

// --- Metrics ---
export function useQualitySummary() {
  return useQuery({
    queryKey: ['metrics', 'quality-summary'],
    queryFn: () => client.get('/metrics/quality-summary').then(r => r.data),
    staleTime: 60_000,
  });
}

export function useMetricsDashboard() {
  return useQuery({
    queryKey: ['metrics', 'dashboard'],
    queryFn: () => client.get('/metrics/dashboard').then(r => r.data),
    staleTime: 60_000,
  });
}

export function useRegistrySearch() {
  return useQuery({
    queryKey: ['metrics', 'registry-search'],
    queryFn: () => client.get('/metrics/registry-search').then(r => r.data),
    staleTime: 60_000,
  });
}

// --- Moderation ---
export function useModerationQueue(status = 'pending') {
  return useQuery({
    queryKey: ['moderation', 'queue', status],
    queryFn: () => client.get('/moderation/queue', { params: { status } }).then(r => r.data),
    staleTime: 15_000,
  });
}

export function useModerationStats() {
  return useQuery({
    queryKey: ['moderation', 'stats'],
    queryFn: () => client.get('/moderation/stats').then(r => r.data),
    staleTime: 30_000,
  });
}

// --- Queue ---
export function useQueueStats() {
  return useQuery({
    queryKey: ['ingestion', 'queue-stats'],
    queryFn: () => client.get('/queue-stats').then(r => r.data),
    refetchInterval: 15_000,
  });
}

// --- Users ---
export function useAdminUsers({ search = '', limit = 20, offset = 0 } = {}) {
  return useQuery({
    queryKey: ['admin', 'users', search, limit, offset],
    queryFn: () => client.get('/admin/users', { params: { search, limit, offset } }).then(r => r.data),
    staleTime: 30_000,
  });
}

// --- Featured ---
export function useFeaturedList() {
  return useQuery({
    queryKey: ['feed', 'featured'],
    queryFn: () => client.get('/feed/featured').then(r => r.data),
    staleTime: 30_000,
  });
}

// --- APIs ---
export function useApiStatus() {
  return useQuery({
    queryKey: ['admin', 'apis'],
    queryFn: () => client.get('/admin/apis').then(r => r.data),
    staleTime: 30_000,
  });
}

export function useApiUsage(name, period = '24h') {
  return useQuery({
    queryKey: ['admin', 'apis', name, 'usage', period],
    queryFn: () => client.get(`/admin/apis/${name}/usage`, { params: { period } }).then(r => r.data),
    staleTime: 30_000,
    enabled: !!name,
  });
}

// --- User Analytics ---
export function useUserAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'users'],
    queryFn: () => client.get('/admin/analytics/users').then(r => r.data),
    staleTime: 60_000,
  });
}

// --- Consensus ---
export function useConsensusAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'consensus'],
    queryFn: () => client.get('/admin/analytics/consensus').then(r => r.data),
    staleTime: 60_000,
  });
}

// --- Audit ---
export function useAuditLog({ limit = 50, offset = 0, actionType = '' } = {}) {
  return useQuery({
    queryKey: ['admin', 'audit-log', limit, offset, actionType],
    queryFn: () => client.get('/admin/audit-log', { params: { limit, offset, action_type: actionType || undefined } }).then(r => r.data),
    staleTime: 15_000,
  });
}

// --- System ---
export function useSystemStatus() {
  return useQuery({
    queryKey: ['admin', 'system-status'],
    queryFn: () => client.get('/admin/system/status').then(r => r.data),
    staleTime: 30_000,
  });
}

// --- Quality ---
export function useQualityByType() {
  return useQuery({
    queryKey: ['metrics', 'quality-by-type'],
    queryFn: () => client.get('/metrics/quality-by-type').then(r => r.data),
    staleTime: 60_000,
  });
}

export function useImageAnalytics() {
  return useQuery({
    queryKey: ['admin', 'image-analytics'],
    queryFn: () => client.get('/admin/analytics/images').then(r => r.data),
    staleTime: 60_000,
  });
}

// --- Resolution ---
export function useResolutionMetrics() {
  return useQuery({
    queryKey: ['metrics', 'resolution'],
    queryFn: () => client.get('/metrics/resolution').then(r => r.data),
    staleTime: 60_000,
  });
}

// --- Type Rules ---
export function useTypeRules() {
  return useQuery({
    queryKey: ['admin', 'type-rules'],
    queryFn: () => client.get('/admin/type-rules').then(r => r.data),
    staleTime: 60_000,
  });
}

// --- Seeding ---
export function useSeedStatus() {
  return useQuery({
    queryKey: ['admin', 'seed', 'status'],
    queryFn: () => client.get('/admin/seed/registry/status').then(r => r.data),
    staleTime: 30_000,
  });
}

export function useSeedHistory(limit = 20) {
  return useQuery({
    queryKey: ['admin', 'seed', 'history', limit],
    queryFn: () => client.get('/admin/seed/registry/history', { params: { limit } }).then(r => r.data),
    staleTime: 15_000,
  });
}
