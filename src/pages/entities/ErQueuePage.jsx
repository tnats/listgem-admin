import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useErQueue, useErQueueMutations } from '../../api/hooks';
import { MOCK_ER_QUEUE } from './mockEntities';

function scoreColor(s) {
  if (s >= 0.55) return 'text-amber-700 bg-amber-50';
  if (s >= 0.5) return 'text-yellow-700 bg-yellow-50';
  return 'text-gray-600 bg-gray-100';
}

function Side({ title, lines }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
      {lines.map((l, i) => <div key={i} className="text-xs text-gray-500 truncate">{l}</div>)}
    </div>
  );
}

export default function ErQueuePage() {
  const query = useErQueue('pending');
  const { approve, reject } = useErQueueMutations();

  const live = query.data?.queue || query.data?.items;
  const usingSample = !live || live.length === 0;
  const source = usingSample ? MOCK_ER_QUEUE : live;
  const [items, setItems] = useState(source);
  const [note, setNote] = useState(null);

  // Re-seed from source when its identity changes (live data arrives) — render-phase, not an effect.
  const [seenSource, setSeenSource] = useState(source);
  if (source !== seenSource) {
    setSeenSource(source);
    setItems(source);
  }

  async function act(item, kind) {
    setItems(list => list.filter(i => i.id !== item.id)); // optimistic remove
    try {
      await (kind === 'approve' ? approve : reject).mutateAsync(item.id);
      setNote({ ok: true, text: `${kind === 'approve' ? 'Approved' : 'Rejected'} ${item.candidate.title} — saved` });
    } catch {
      setNote({ ok: false, text: `${kind === 'approve' ? 'Approved' : 'Rejected'} ${item.candidate.title} — local preview (backend unreachable)` });
    }
  }

  return (
    <>
      <PageHeader
        title="ER Review Queue"
        description="Low-confidence ER near-misses (0.4–0.6) from the live matcher. Approve links the candidate as an edition of the matched Work; reject keeps them separate."
      />

      <div className={`mb-4 p-3 rounded border text-xs ${usingSample ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
        {usingSample
          ? <>Seeded sample — live <code>/admin/works/er-queue</code> not reachable from here. Decisions preview locally and POST best-effort.</>
          : <>Live queue from <code>/admin/works/er-queue</code>.</>}
      </div>

      {note && (
        <div className={`mb-4 p-2 rounded text-xs ${note.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{note.text}</div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">Queue clear — no pending near-misses. 🎉</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded tabular-nums ${scoreColor(item.score)}`}>score {item.score.toFixed(2)}</span>
                <span className="text-[11px] text-gray-400">{item.reason}</span>
              </div>
              <div className="flex items-center gap-4">
                <Side
                  title={item.candidate.title}
                  lines={[`${item.candidate.creator} · ${item.candidate.type} · ${item.candidate.year}`, `${item.candidate.source} · ${Object.entries(item.candidate.ids || {}).map(([k, v]) => `${k}:${v}`).join(' ') || 'no ids'}`]}
                />
                <div className="shrink-0 text-xs text-gray-300">↔ match</div>
                <Side
                  title={item.match_work.title}
                  lines={[`${item.match_work.creator}`, `Work · ${item.match_work.edition_count} edition(s) · rep ${item.match_work.representative_thing_id}`]}
                />
                <div className="shrink-0 flex flex-col gap-1.5">
                  <button onClick={() => act(item, 'approve')} className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">Approve</button>
                  <button onClick={() => act(item, 'reject')} className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
