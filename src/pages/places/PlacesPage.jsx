import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePlacesEntityKind } from '../../api/hooks';
import { MOCK_PLACES } from './mockPlaces';

const KIND_META = {
  destination: { label: 'Destination', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  brand: { label: 'Brand', bar: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700' },
  chain: { label: 'Chain', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  unclassified: { label: 'Unclassified', bar: 'bg-gray-300', chip: 'bg-gray-100 text-gray-500' },
};
const kindMeta = k => KIND_META[k] || KIND_META.unclassified;
const KIND_ORDER = ['destination', 'brand', 'chain'];

const fmtInt = n => (n == null ? '—' : Number(n).toLocaleString());
const rawPct = (n, total) => (total > 0 ? (n / total) * 100 : 0);
function fmtPct(n, total) {
  const p = rawPct(n, total);
  if (p === 0) return '0%';
  if (p < 0.1) return `${p.toFixed(2)}%`;
  if (p < 10) return `${p.toFixed(1)}%`;
  return `${p.toFixed(0)}%`;
}

export default function PlacesPage() {
  const query = usePlacesEntityKind();
  const live = query.data && Array.isArray(query.data.by_entity_kind) ? query.data : null;
  const usingSample = !live;
  const data = live || MOCK_PLACES;

  const byKind = [...(data.by_entity_kind || [])].sort((a, b) => (b.count || 0) - (a.count || 0));
  const total = data.places_total ?? byKind.reduce((s, r) => s + (r.count || 0), 0);
  const kindCount = k => byKind.find(r => r.entity_kind === k)?.count ?? 0;

  const byTypeKind = data.by_type_kind || [];
  const types = [...new Set(byTypeKind.map(r => r.type))];
  const typeRows = types
    .map(type => {
      const rows = byTypeKind.filter(r => r.type === type);
      return {
        type,
        totalForType: rows.reduce((s, r) => s + (r.count || 0), 0),
        kinds: Object.fromEntries(rows.map(r => [r.entity_kind, r.count])),
      };
    })
    .sort((a, b) => b.totalForType - a.totalForType);

  const candidates = data.chain_location_candidates || { total: 0, by_type: [], sample: [] };
  const candidateTotal = candidates.total || 0;

  return (
    <>
      <PageHeader
        title="Places Monitor"
        description="Place-Thing entity_kind distribution (chain · brand · destination) and the #462 chain-location pollution signal — the observability behind “curation, not directory” (#456)."
      />

      <div className={`mb-4 p-3 rounded border text-xs ${usingSample ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
        {usingSample
          ? <>Seeded sample — live <code>/metrics/places/entity-kind</code> needs an authed session.</>
          : <>Live from <code>/metrics/places/entity-kind</code>.</>}
      </div>

      <div className="mb-6 p-3 rounded border border-gray-200 bg-gray-50 text-xs text-gray-600 leading-relaxed">
        <span className="font-medium text-gray-700">entity_kind is derived, not persisted.</span>{' '}
        <code>brandClassifier.js</code> classifies at ingest (Redis-cached); the seeded Wikidata catalog
        never ran it, so these figures are derived from metadata markers —
        <span className="text-amber-700"> chain</span> = <code>is_chain='true'</code>,
        <span className="text-indigo-700"> brand</span> = <code>thing_level='brand'</code>,
        <span className="text-emerald-700"> destination</span> = default. A live re-classified
        distribution would need a backfill (out of scope for the read-only #470).
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Place Things" value={fmtInt(total)} />
        <StatCard label="Destinations" value={fmtInt(kindCount('destination'))} detail={`${fmtPct(kindCount('destination'), total)} of places`} />
        <StatCard label="Brands" value={fmtInt(kindCount('brand'))} detail={fmtPct(kindCount('brand'), total)} />
        <StatCard label="Chains" value={fmtInt(kindCount('chain'))} detail={fmtPct(kindCount('chain'), total)} />
      </div>

      {/* entity_kind distribution */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-sm font-medium text-gray-700 mb-3">entity_kind distribution</div>
        <div className="flex h-3 rounded overflow-hidden bg-gray-100">
          {byKind.map(r => (
            <div
              key={r.entity_kind}
              className={kindMeta(r.entity_kind).bar}
              style={{ width: `${rawPct(r.count, total)}%` }}
              title={`${kindMeta(r.entity_kind).label}: ${fmtInt(r.count)} (${fmtPct(r.count, total)})`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {byKind.map(r => (
            <div key={r.entity_kind} className="flex items-center gap-1.5 text-xs">
              <span className={`w-2.5 h-2.5 rounded-sm ${kindMeta(r.entity_kind).bar}`} />
              <span className="text-gray-700 font-medium">{kindMeta(r.entity_kind).label}</span>
              <span className="text-gray-400 tabular-nums">{fmtInt(r.count)} · {fmtPct(r.count, total)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          A destination-dominant catalog is the “curation, not directory” thesis (#456) holding —
          notable places worth an opinion, not franchise access-points.
        </p>
      </div>

      {/* by type */}
      {typeRows.length > 0 && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-700 mb-3">By type</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase text-left">
                <th className="py-1.5 font-medium">Type</th>
                {KIND_ORDER.map(k => (
                  <th key={k} className="py-1.5 font-medium text-right">{kindMeta(k).label}</th>
                ))}
                <th className="py-1.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {typeRows.map(row => (
                <tr key={row.type} className="border-t border-gray-100">
                  <td className="py-1.5 text-gray-700 font-medium">{row.type}</td>
                  {KIND_ORDER.map(k => (
                    <td key={k} className="py-1.5 text-right tabular-nums text-gray-600">
                      {row.kinds[k] ? fmtInt(row.kinds[k]) : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                  <td className="py-1.5 text-right tabular-nums text-gray-900 font-medium">{fmtInt(row.totalForType)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* chain-location pollution (#462) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-gray-700">
            Chain-location pollution <span className="text-gray-400 font-normal">· #462</span>
          </div>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${candidateTotal === 0 ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
            {fmtInt(candidateTotal)} candidate{candidateTotal === 1 ? '' : 's'}
          </span>
        </div>

        {candidateTotal === 0 ? (
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">
            No Restaurant/Hotel Things carry a <code>google_place_id</code> + chain flag — there is no
            chain-location pollution, so the #462 prune stays deferred with data behind it. Under #459
            chains no longer acquire a <code>place_id</code>, so this only tracks legacy pollution.
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              Restaurant/Hotel Things carrying a <code>google_place_id</code> + a recognized chain brand —
              merge-into-brand candidates (#456 migration notes / #462).
            </p>
            {(candidates.by_type || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {candidates.by_type.map(t => (
                  <span key={t.type} className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                    {t.type} · <span className="tabular-nums">{fmtInt(t.count)}</span>
                  </span>
                ))}
              </div>
            )}
            {(candidates.sample || []).length > 0 && (
              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-gray-400 uppercase text-left">
                    <th className="py-1.5 font-medium">Title</th>
                    <th className="py-1.5 font-medium">Type</th>
                    <th className="py-1.5 font-medium">Chain brand</th>
                    <th className="py-1.5 font-medium">Place ID</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.sample.map(s => (
                    <tr key={s.thing_id} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700 font-medium">{s.title || <span className="text-gray-300">—</span>}</td>
                      <td className="py-1.5 text-gray-500">{s.type}</td>
                      <td className="py-1.5 text-gray-500">{s.chain_brand || '—'}</td>
                      <td className="py-1.5 text-gray-400 font-mono text-[11px]">{s.google_place_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  );
}
