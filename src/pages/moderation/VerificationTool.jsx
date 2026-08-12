import { useState } from 'react';
import DataTable from '../../components/DataTable';
import VerifiedBadge from '../../components/VerifiedBadge';
import { Button, Select } from '../../components/Form';
import { useVerificationHistory, useVerifiedUsers } from '../../api/hooks';
import { VERIFICATION_TYPES } from './verificationRules';
import { MOCK_VERIFIED, mockVerificationHistory } from './mockVerification';
import VerifyModal from './VerifyModal';

function fmt(iso) {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

/**
 * Internal-only panel. `method` is admin-visible here and nowhere else:
 * publishing `method = concierge` would announce that we recruited someone.
 */
function HistoryPanel({ userId, onUnverify }) {
  const query = useVerificationHistory(userId);
  const data = query.data || mockVerificationHistory(userId);
  const usingSample = !query.data;

  if (!data) return <div className="text-xs text-gray-400">No history for this account.</div>;
  const internal = data.internal || {};

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Current</span>
        <VerifiedBadge verified={data.verified} />
        {!data.verified?.type && <span className="text-xs text-gray-400">not verified</span>}
        {data.verified?.proof && <span className="text-xs text-gray-500">proof: {data.verified.proof}</span>}
        {data.verified?.type && (
          <span className="text-xs text-gray-500">
            {data.verified.type} · since {fmt(data.verified.since)}
          </span>
        )}
        {data.verified?.type && (
          <Button size="sm" variant="danger" className="ml-auto" onClick={onUnverify}>
            Remove
          </Button>
        )}
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-2">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-amber-800">
          Internal — never publish
        </div>
        <dl className="space-y-0.5 text-xs text-amber-900">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-amber-700">method</dt>
            <dd>{internal.method || '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-amber-700">evidence</dt>
            <dd className="min-w-0">{internal.evidence || '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-amber-700">revoked reason</dt>
            <dd>{internal.revoked_reason || '—'}</dd>
          </div>
        </dl>
      </div>

      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-gray-400">
          Audit trail{usingSample ? ' (sample)' : ''}
        </div>
        <ol className="space-y-1">
          {(data.history || []).map((h, i) => (
            <li key={i} className="flex gap-3 border-t border-gray-100 pt-1 text-xs first:border-0">
              <span className="w-40 shrink-0 tabular-nums text-gray-400">{fmt(h.at || h.created_at)}</span>
              <span className="w-24 shrink-0 font-medium text-gray-600">{h.action || h.event || '—'}</span>
              <span className="min-w-0 flex-1 text-gray-700">
                {[h.type, h.method, h.reason].filter(Boolean).join(' · ')}
              </span>
              <span className="shrink-0 text-gray-400">{h.actor || ''}</span>
            </li>
          ))}
          {(data.history || []).length === 0 && <li className="text-xs text-gray-400">No entries.</li>}
        </ol>
      </div>
    </div>
  );
}

export default function VerificationTool() {
  const [type, setType] = useState('');
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null); // { mode, user }
  const [note, setNote] = useState(null);

  const query = useVerifiedUsers({ type, limit: 100 });
  // As on the outreach board: an in-flight request is not a missing endpoint, so
  // no fictional verified accounts while we wait.
  const live = query.data?.users || query.data?.verified;
  const usingSample = !query.isLoading && !live;
  const rows = (live || (usingSample ? MOCK_VERIFIED : [])).filter(u => !type || u.verified?.type === type);

  const columns = [
    {
      key: 'user',
      header: 'Account',
      render: u => (
        <div className="min-w-0">
          <div className="truncate font-medium text-gray-800">{u.display_name || u.username}</div>
          <div className="truncate text-xs text-gray-400">{u.username || u.user_id}</div>
        </div>
      ),
    },
    { key: 'badge', header: 'Badge', width: 'w-24', render: u => <VerifiedBadge verified={u.verified} /> },
    { key: 'type', header: 'Type', width: 'w-28', className: 'text-gray-600', render: u => u.verified?.type || '—' },
    {
      key: 'proof',
      header: 'Proof',
      className: 'text-gray-600',
      render: u => u.verified?.proof || <span className="text-gray-300">— (nothing public to show)</span>,
    },
    { key: 'since', header: 'Since', width: 'w-28', className: 'text-gray-500', render: u => fmt(u.verified?.since) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-40',
      render: u => (
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => setSelected(selected === u.user_id ? null : u.user_id)}>
            {selected === u.user_id ? 'Hide' : 'History'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setModal({ mode: 'unverify', user: u })}>
            Unverify
          </Button>
        </div>
      ),
    },
  ];

  const selectedUser = rows.find(u => u.user_id === selected);

  return (
    <>
      <div
        className={`mb-4 rounded border p-3 text-xs ${
          query.isLoading
            ? 'border-gray-200 bg-gray-50 text-gray-500'
            : usingSample
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-indigo-100 bg-indigo-50 text-indigo-800'
        }`}
      >
        {query.isLoading ? (
          <>Loading the live registry from <code>/verification</code>…</>
        ) : usingSample ? (
          <>
            Seeded sample — live <code>/verification</code> not reachable from here.
          </>
        ) : (
          <>
            Live from <code>/verification</code>. Display-only trust: the badge has zero effect on ranking.
          </>
        )}
      </div>

      {note && <div className="mb-3 rounded bg-green-50 p-2 text-xs text-green-700">{note}</div>}

      <div className="mb-3 flex items-center gap-2">
        <Select
          value={type}
          onChange={e => setType(e.target.value)}
          placeholder="All types"
          options={VERIFICATION_TYPES}
          className="w-48"
        />
        <span className="ml-auto text-xs tabular-nums text-gray-400">{rows.length} verified</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={u => u.user_id}
          loading={query.isLoading}
          empty="No verified accounts."
          isRowActive={u => u.user_id === selected}
        />
      </div>

      {selected && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
          <HistoryPanel
            userId={selected}
            onUnverify={() => setModal({ mode: 'unverify', user: selectedUser || { user_id: selected } })}
          />
        </div>
      )}

      <VerifyModal
        open={!!modal}
        mode={modal?.mode}
        user={modal?.user}
        onClose={() => setModal(null)}
        onDone={(_data, mode) => {
          setNote(mode === 'verify' ? 'Account verified.' : 'Verification removed.');
          query.refetch();
        }}
      />
    </>
  );
}
