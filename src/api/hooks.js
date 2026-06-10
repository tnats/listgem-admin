import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
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

// --- ER / KG scorecard (epic #395) ---
export function useDeduplicationEffectiveness() {
  return useQuery({
    queryKey: ['metrics', 'deduplication-effectiveness'],
    queryFn: () => client.get('/metrics/deduplication/effectiveness').then(r => r.data),
    staleTime: 60_000,
  });
}

export function useQualityTrends() {
  return useQuery({
    queryKey: ['metrics', 'quality-trends'],
    queryFn: () => client.get('/metrics/quality-trends').then(r => r.data),
    staleTime: 60_000,
  });
}

export function useWorkRollup() {
  return useQuery({
    queryKey: ['metrics', 'work-rollup'],
    queryFn: () => client.get('/metrics/work-rollup').then(r => r.data),
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

// --- Email ---
export function useEmailTemplates() {
  return useQuery({
    queryKey: ['admin', 'email', 'templates'],
    queryFn: () => client.get('/admin/email/templates').then(r => r.data),
    staleTime: 300_000,
  });
}

// --- Image Quality ---
export function useImageQuality() {
  return useQuery({
    queryKey: ['admin', 'image-quality'],
    queryFn: () => client.get('/admin/analytics/image-quality').then(r => r.data),
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

// --- Golden-set labeling (#404 / #421) ---
// Cursor-paginated so the labeler can reach the full pool (not just page 1) —
// the diverse `random`/`different` pairs sort last and were otherwise unreachable.
export function useCandidatePairs({ limit = 100 } = {}) {
  return useInfiniteQuery({
    queryKey: ['er', 'candidate-pairs', limit],
    queryFn: ({ pageParam }) =>
      client.get('/admin/er/candidate-pairs', { params: { limit, cursor: pageParam } }).then(r => r.data),
    initialPageParam: 0,
    getNextPageParam: (last) => (last?.next_cursor != null ? Number(last.next_cursor) : undefined),
    staleTime: 5 * 60_000,
    retry: false, // fail fast so the page falls back to the seeded sample
  });
}

export function useSaveGoldenLabel() {
  return useMutation({
    mutationFn: (label) => client.post('/admin/er/golden-labels', label).then(r => r.data),
  });
}
// --- Entity browser / Works (#405) ---
export function useWorks({ limit = 50, search = '' } = {}) {
  return useQuery({
    queryKey: ['works', 'list', limit, search],
    queryFn: () => client.get('/works', { params: { limit, q: search || undefined } }).then(r => r.data),
    staleTime: 60_000,
    retry: false, // fall back to the seeded sample when the endpoint isn't reachable
  });
}

export function useWork(workId) {
  return useQuery({
    queryKey: ['works', 'detail', workId],
    queryFn: () => client.get(`/works/${workId}`).then(r => r.data),
    enabled: !!workId,
    retry: false,
  });
}

export function useErQueue(status = 'pending') {
  return useQuery({
    queryKey: ['works', 'er-queue', status],
    queryFn: () => client.get('/admin/works/er-queue', { params: { status } }).then(r => r.data),
    staleTime: 30_000,
    retry: false,
  });
}

export function useWorkMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['works'] });
  return {
    merge: useMutation({ mutationFn: (body) => client.post('/admin/works/merge', body).then(r => r.data), onSuccess: invalidate }),
    split: useMutation({ mutationFn: ({ workId, ...body }) => client.post(`/admin/works/${workId}/split`, body).then(r => r.data), onSuccess: invalidate }),
    setPrimary: useMutation({ mutationFn: ({ workId, ...body }) => client.patch(`/admin/works/${workId}/primary`, body).then(r => r.data), onSuccess: invalidate }),
    dissolve: useMutation({ mutationFn: (workId) => client.delete(`/admin/works/${workId}`).then(r => r.data), onSuccess: invalidate }),
  };
}

export function useErQueueMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['works', 'er-queue'] });
  return {
    approve: useMutation({ mutationFn: (id) => client.post(`/admin/works/er-queue/${id}/approve`).then(r => r.data), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: (id) => client.post(`/admin/works/er-queue/${id}/reject`).then(r => r.data), onSuccess: invalidate }),
  };
}

// --- Extraction triage (#407) ---
export function useLowQualityThings({ limit = 200, minQuality = 0.5 } = {}) {
  return useQuery({
    queryKey: ['metrics', 'low-quality-things', limit, minQuality],
    queryFn: () => client.get('/metrics/low-quality-things', { params: { limit, minQuality } }).then(r => r.data),
    staleTime: 60_000,
    retry: false, // fall back to the seeded sample when unreachable
  });
}

export function useReEnrich() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (thingId) => client.post(`/admin/re-enrich/${thingId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metrics', 'low-quality-things'] }),
  });
}

// --- Search-quality inspector (#406) ---
export function useHybridSearch(query, limit = 20) {
  return useQuery({
    queryKey: ['search', 'hybrid', query, limit],
    queryFn: () => client.get('/search/hybrid', { params: { q: query, limit } }).then(r => r.data),
    enabled: !!query,
    retry: false,
    staleTime: 60_000,
  });
}
