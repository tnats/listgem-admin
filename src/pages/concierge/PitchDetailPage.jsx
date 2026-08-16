import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { Button } from '../../components/Form';
import VerifiedBadge from '../../components/VerifiedBadge';
import { usePitch, usePitchMutations } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import {
  STATUS_LABEL,
  AUTOMATIC_STATUSES,
  canConfirmIdentity,
  canEditItems,
  canRepitch,
  canTakedown,
  offeredTransitions,
} from './pitchRules';
import { mockPitchDetail } from './mockPitches';
import PitchBuilder from './PitchBuilder';
import TokensPanel from './TokensPanel';
import ConfirmIdentityModal from './ConfirmIdentityModal';
import TakedownModal from './TakedownModal';
import EditDetailsModal from './EditDetailsModal';

const TABS = [
  { id: 'build', label: 'Build' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'identity', label: 'Identity' },
  { id: 'audit', label: 'Audit' },
];

function fmt(iso) {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function StatusChip({ status }) {
  return (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="truncate text-sm text-gray-700">{children || <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}

export default function PitchDetailPage() {
  const { pitchId } = useParams();
  const query = usePitch(pitchId);
  const { setStatus } = usePitchMutations(pitchId);

  const [tab, setTab] = useState('build');
  const [note, setNote] = useState(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [takedownOpen, setTakedownOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  const live = query.data?.pitch ? query.data : null;
  const sample = mockPitchDetail(pitchId);
  const data = live || sample;
  const usingSample = !live;

  if (query.isLoading && !data) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }
  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <div className="text-sm text-gray-700">Pitch not found.</div>
        <Link to="/concierge" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
          ← Back to the board
        </Link>
      </div>
    );
  }

  const { pitch, items, events } = data;
  const transitions = offeredTransitions(pitch);

  async function move(next) {
    setNote(null);
    try {
      await setStatus.mutateAsync({ status: next });
      setNote({ ok: true, text: `Status → ${STATUS_LABEL[next] || next}.` });
    } catch (err) {
      setNote({ ok: false, text: apiErrorMessage(err) });
    }
  }

  return (
    <>
      <Link to="/concierge" className="mb-2 inline-block text-xs text-gray-500 hover:text-gray-700">
        ← Outreach board
      </Link>

      <PageHeader title={pitch.target_name} description={pitch.proposed_title} />

      {usingSample && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Seeded sample — live <code>/pitches/{pitchId}</code> not reachable from here. Actions POST best-effort
          and report what the API said.
        </div>
      )}

      {note && (
        <div className={`mb-4 rounded p-2 text-xs ${note.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {note.text}
        </div>
      )}

      {/* Header card */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusChip status={pitch.status} />
          {pitch.thing_type && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{pitch.thing_type}</span>
          )}
          <span className="text-xs tabular-nums text-gray-500">
            {pitch.resolved_count ?? 0}/{pitch.item_count ?? 0} resolved
          </span>
          {pitch.status === 'declined' && (
            <span className="text-xs text-gray-500">Declined is terminal — archive only, never re-pitch.</span>
          )}
          <Button size="sm" className="ml-auto" onClick={() => setEditOpen(true)}>
            Edit details
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Detail label="Organisation">{pitch.target_org}</Detail>
          <Detail label="Contact">
            {pitch.target_contact ||
              (pitch.contact_purged_at ? <span className="text-gray-400">purged</span> : null)}
          </Detail>
          <Detail label="Assigned to">{pitch.assigned_to}</Detail>
          <Detail label="Created by">{pitch.created_by}</Detail>
          <Detail label="Source">
            {pitch.source_url ? (
              <a href={pitch.source_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                {pitch.source_url}
              </a>
            ) : null}
          </Detail>
          <Detail label="Attribution">{pitch.source_attribution}</Detail>
          <Detail label="Pitched">{fmt(pitch.pitched_at)}</Detail>
          <Detail label="Responded">{fmt(pitch.responded_at)}</Detail>
        </dl>

        {pitch.notes && <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">{pitch.notes}</p>}

        {/* Status transitions — the machine's legal set, minus unsanctioned re-pitches */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="text-[11px] uppercase tracking-wider text-gray-400">Move to</span>
          {transitions.length === 0 && <span className="text-xs text-gray-400">Nothing — this status is a sink.</span>}
          {transitions.map(next => (
            <Button
              key={next}
              size="sm"
              variant={next === 'archived' ? 'ghost' : 'secondary'}
              disabled={setStatus.isPending}
              onClick={() => move(next)}
              title={AUTOMATIC_STATUSES.includes(next) ? 'Normally set automatically when the target claims the invite' : undefined}
            >
              {STATUS_LABEL[next] || next}
              {AUTOMATIC_STATUSES.includes(next) ? ' (repair)' : ''}
            </Button>
          ))}
          {pitch.status !== 'draft' && !canRepitch(pitch) && pitch.status !== 'archived' && (
            <span className="text-[11px] text-gray-400">
              Re-pitch unavailable — the server has not marked this target re-pitchable.
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'build' && (
        <PitchBuilder
          pitchId={pitchId}
          thingType={pitch.thing_type}
          items={items}
          readOnly={!canEditItems(pitch)}
          readOnlyReason={
            pitch.status === 'provisioned'
              ? 'The target has claimed this draft — the item set is theirs now and the API rejects edits.'
              : 'This pitch is archived — its item set is frozen.'
          }
        />
      )}

      {tab === 'outreach' && (
        <div className="space-y-4">
          <TokensPanel pitch={pitch} events={events} />

          <div className="rounded-lg border border-red-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Takedown</h3>
            <p className="mt-1 mb-3 text-xs text-gray-500">
              Purges contact details, revokes both tokens and archives — one action, so it can't be
              half-completed.
            </p>
            <Button variant="danger" size="sm" disabled={!canTakedown(pitch)} onClick={() => setTakedownOpen(true)}>
              Take down
            </Button>
            {!canTakedown(pitch) && (
              <span className="ml-2 text-xs text-gray-400">Already archived — contact was purged.</span>
            )}
          </div>
        </div>
      )}

      {tab === 'identity' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Confirm identity</h3>
          <p className="mt-1 text-xs text-gray-500">
            Available once the target has claimed the draft. A claim proves someone held the invite link — not
            that they are the target — so the badge is granted here, after a human check, and never at
            provisioning.
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Detail label="Claimed at">{fmt(pitch.invite_used_at)}</Detail>
            <Detail label="Provisioned user">{pitch.provisioned_user_id}</Detail>
            <Detail label="Provisioned list">{pitch.provisioned_list_id}</Detail>
            <Detail label="Provisioned at">{fmt(pitch.provisioned_at)}</Detail>
          </dl>

          {confirmed && (
            <div className="mt-3 flex items-center gap-2 rounded bg-green-50 p-2 text-xs text-green-700">
              <span>Identity confirmed for {confirmed.user_id}.</span>
              <VerifiedBadge verified={confirmed.verified} />
            </div>
          )}

          <div className="mt-4">
            <Button
              variant="primary"
              size="sm"
              disabled={!canConfirmIdentity(pitch)}
              onClick={() => setIdentityOpen(true)}
            >
              Confirm identity…
            </Button>
            {!canConfirmIdentity(pitch) && (
              <span className="ml-2 text-xs text-gray-400">
                Requires status <span className="font-medium">provisioned</span> — currently{' '}
                {STATUS_LABEL[pitch.status] || pitch.status}.
              </span>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Audit trail</h3>
          {(!events || events.length === 0) && <div className="text-xs text-gray-400">No events recorded.</div>}
          <ol className="space-y-2">
            {(events || []).map((e, i) => (
              <li key={i} className="flex gap-3 border-t border-gray-100 pt-2 text-xs first:border-0 first:pt-0">
                <span className="w-40 shrink-0 tabular-nums text-gray-400">{fmt(e.created_at || e.at)}</span>
                <span className="w-32 shrink-0 font-medium text-gray-600">{e.event_type || e.type || 'event'}</span>
                <span className="min-w-0 flex-1 text-gray-700">{e.detail || e.description || ''}</span>
                <span className="shrink-0 text-gray-400">{e.actor || e.created_by || ''}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <ConfirmIdentityModal
        open={identityOpen}
        pitch={pitch}
        onClose={() => setIdentityOpen(false)}
        onConfirmed={data => {
          setConfirmed(data);
          setNote({ ok: true, text: 'Identity confirmed — badge granted.' });
        }}
      />
      <TakedownModal
        open={takedownOpen}
        pitch={pitch}
        onClose={() => setTakedownOpen(false)}
        onDone={result =>
          setNote({
            ok: true,
            text: `Taken down — contact ${result?.contact_purged ? 'purged' : 'purge unconfirmed'}, tokens ${
              result?.tokens_revoked ? 'revoked' : 'revocation unconfirmed'
            }, pitch archived.`,
          })
        }
      />
      <EditDetailsModal
        open={editOpen}
        pitch={pitch}
        onClose={() => setEditOpen(false)}
        onSaved={() => setNote({ ok: true, text: 'Details saved.' })}
      />
    </>
  );
}
