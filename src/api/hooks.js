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
    queryFn: () => client.get('/ingestion/queue-stats').then(r => r.data),
    refetchInterval: 15_000,
  });
}
