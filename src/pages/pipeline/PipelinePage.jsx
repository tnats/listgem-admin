import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useCrawlAnalytics, useRegistrySearch, useResolutionMetrics, useTypeRules, useQueueStats } from '../../api/hooks';
import client from '../../api/client';

export default function PipelinePage() {
  const { data: crawls } = useCrawlAnalytics();
  const { data: registry } = useRegistrySearch();
  const { data: resolution } = useResolutionMetrics();
  const { data: typeRulesData } = useTypeRules();
  const { data: queue } = useQueueStats();

  // Re-crawl form
  const [recrawlUrl, setRecrawlUrl] = useState('');
  const [recrawlMsg, setRecrawlMsg] = useState('');
  const [recrawlLoading, setRecrawlLoading] = useState(false);

  const crawlSummary = crawls?.summary || {};
  const crawlDaily = crawls?.daily || [];
  const crawlDomains = crawls?.domains || [];
  const stages = registry?.stage_breakdown || [];
  const timing = registry?.timing || [];
  const typeBreakdown = registry?.type_breakdown || [];
  const resolutionByMethod = resolution?.by_method || [];
  const resolutionByPipeline = resolution?.by_pipeline || [];
  const typeRules = typeRulesData?.rules || [];

  const byStatus = crawlSummary.byStatus || [];

  async function handleRecrawl(e) {
    e.preventDefault();
    if (!recrawlUrl.trim()) return;
    setRecrawlLoading(true);
    setRecrawlMsg('');
    try {
      const { data } = await client.post('/admin/recrawl', { url: recrawlUrl.trim() });
      setRecrawlMsg(data.message);
      setRecrawlUrl('');
    } catch (err) {
      setRecrawlMsg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setRecrawlLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Pipeline Monitor" description="Crawl jobs, entity resolution, and type detection" />

      {/* Crawl Overview */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Crawl Jobs" value={crawlSummary.totalJobs?.toLocaleString() || '—'} />
        <StatCard label="Success Rate" value={crawlSummary.successRate || '—'} />
        <StatCard label="Queue Waiting" value={queue?.waiting ?? '—'} />
        <StatCard label="Queue Active" value={queue?.active ?? '—'} />
        <StatCard label="Queue Failed" value={queue?.failed?.toLocaleString() ?? '—'} />
      </div>

      {/* Re-crawl */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Re-crawl URL</h2>
        <form onSubmit={handleRecrawl} className="flex gap-2">
          <input
            type="url"
            value={recrawlUrl}
            onChange={e => setRecrawlUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={recrawlLoading || !recrawlUrl.trim()}
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {recrawlLoading ? 'Queuing...' : 'Re-crawl'}
          </button>
        </form>
        {recrawlMsg && (
          <div className={`mt-2 text-sm ${recrawlMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {recrawlMsg}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Crawl Status Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Jobs by Status</h2>
          {byStatus.length === 0 ? (
            <div className="text-xs text-gray-400">No data</div>
          ) : (
            <div className="space-y-2">
              {byStatus.map(s => {
                const total = parseInt(crawlSummary.totalJobs) || 1;
                const count = parseInt(s.count);
                const pct = ((count / total) * 100).toFixed(1);
                return (
                  <div key={s.status} className="flex items-center text-sm">
                    <span className="w-24"><StatusBadge status={s.status} /></span>
                    <div className="flex-1 mx-2 h-3 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 text-right text-gray-500 tabular-nums text-xs">{count}</span>
                    <span className="w-12 text-right text-gray-400 text-xs">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily Crawl Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Daily Activity</h2>
          {crawlDaily.length === 0 ? (
            <div className="text-xs text-gray-400">No data</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-right pb-2">Total</th>
                  <th className="text-right pb-2">Success</th>
                  <th className="text-right pb-2">Failed</th>
                </tr>
              </thead>
              <tbody>
                {crawlDaily.map((d, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-1 text-gray-600">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="py-1 text-right text-gray-500 tabular-nums">{d.total}</td>
                    <td className="py-1 text-right text-green-600 tabular-nums">{d.succeeded}</td>
                    <td className="py-1 text-right text-red-500 tabular-nums">{d.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Registry Search Stages */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Registry Search — Stage Breakdown</h2>
          {stages.length === 0 ? (
            <div className="text-xs text-gray-400">No resolution data yet</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase">
                  <th className="text-left pb-2">Stage</th>
                  <th className="text-right pb-2">Count</th>
                  <th className="text-right pb-2">Avg ms</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-1 text-gray-600">{s.stage || s.resolution_stage}</td>
                    <td className="py-1 text-right text-gray-500 tabular-nums">{s.count}</td>
                    <td className="py-1 text-right text-gray-500 tabular-nums">{s.avg_ms ? parseFloat(s.avg_ms).toFixed(0) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Crawl Domains */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Top Domains</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Domain</th>
                <th className="text-right pb-2">Jobs</th>
                <th className="text-right pb-2">Success</th>
              </tr>
            </thead>
            <tbody>
              {crawlDomains.slice(0, 12).map((d, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-1 text-gray-600 truncate max-w-[180px]">{d.domain}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{d.total}</td>
                  <td className="py-1 text-right tabular-nums">
                    <span className={parseFloat(d.success_rate) < 50 ? 'text-red-500' : 'text-gray-500'}>
                      {d.success_rate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Type Detection Rules */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Type Detection Rules ({typeRulesData?.count || 0})
        </h2>
        {typeRules.length === 0 ? (
          <div className="text-xs text-gray-400">No custom type rules</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Pattern</th>
                <th className="text-left pb-2">Type</th>
                <th className="text-left pb-2">Source</th>
                <th className="text-right pb-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {typeRules.slice(0, 20).map((r, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-1 text-gray-600 font-mono truncate max-w-[200px]">{r.pattern || r.url_pattern}</td>
                  <td className="py-1 text-gray-600">{r.thing_type || r.type}</td>
                  <td className="py-1 text-gray-400">{r.source}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{r.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
