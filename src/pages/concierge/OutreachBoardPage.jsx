import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { Button, Select } from '../../components/Form';
import { usePitches, usePitchMutations } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import { BOARD_COLUMNS, STATUS_LABEL, canRepitch } from './pitchRules';
import { MOCK_PITCHES } from './mockPitches';
import IntakeModal from './IntakeModal';
import AssigneeSelect from './AssigneeSelect';

function relativeDays(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return null;
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

function PitchCard({ pitch, onRepitch, busy }) {
  const repitchable = canRepitch(pitch);
  const age = relativeDays(pitch.pitched_at || pitch.updated_at || pitch.created_at);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <Link to={`/concierge/${pitch.pitch_id}`} className="block">
        <div className="truncate text-sm font-semibold text-gray-900">{pitch.target_name}</div>
        {pitch.target_org && <div className="truncate text-xs text-gray-500">{pitch.target_org}</div>}
        <div className="mt-1.5 truncate text-xs text-gray-600">{pitch.proposed_title}</div>
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
        {pitch.thing_type && <span className="rounded bg-gray-100 px-1.5 py-0.5">{pitch.thing_type}</span>}
        <span className="tabular-nums">
          {pitch.resolved_count ?? 0}/{pitch.item_count ?? 0} resolved
        </span>
        {age && <span className="text-gray-400">· {age}</span>}
      </div>

      <div className="mt-2 space-y-0.5 text-[11px]">
        <div className="truncate text-gray-500">
          {pitch.target_contact ||
            (pitch.contact_purged_at ? (
              <span className="text-gray-400">contact purged</span>
            ) : (
              <span className="text-gray-300">no contact</span>
            ))}
        </div>
        {pitch.assigned_to && <div className="truncate text-gray-400">→ {pitch.assigned_to}</div>}
        {pitch.notes && <div className="line-clamp-2 text-gray-400">{pitch.notes}</div>}
      </div>

      {/* Re-pitch is offered from the server's can_repitch flag only. `declined`
          is terminal and must never show this button. */}
      {repitchable && (
        <Button size="sm" className="mt-2 w-full" disabled={busy} onClick={() => onRepitch(pitch)}>
          {busy ? 'Re-pitching…' : 'Re-pitch'}
        </Button>
      )}
      {pitch.status === 'declined' && (
        <div className="mt-2 rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
          Declined — terminal. Archive only.
        </div>
      )}
    </div>
  );
}

export default function OutreachBoardPage() {
  const navigate = useNavigate();
  const [assignedTo, setAssignedTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [note, setNote] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Unfiltered on purpose: filtering happens below, so the assignee list always
  // offers every value present on the board rather than just the selected one.
  const query = usePitches();
  const { setStatus } = usePitchMutations();

  // Don't paint the sample while the request is still in flight: for that beat
  // the board would show seven invented people, with example.* contacts, in the
  // place staff read as "who we contact next". Empty until we know.
  const live = query.data?.pitches;
  const usingSample = !query.isLoading && !live;
  const all = live || (usingSample ? MOCK_PITCHES : []);
  const pitches = all.filter(
    p => (!statusFilter || p.status === statusFilter) && (!assignedTo || p.assigned_to === assignedTo),
  );
  const knownAssignees = [...new Set(all.map(p => p.assigned_to).filter(Boolean))];

  const columns = BOARD_COLUMNS.map(col => ({
    ...col,
    cards: pitches.filter(p => p.status === col.status),
  }));

  async function repitch(pitch) {
    setBusyId(pitch.pitch_id);
    setNote(null);
    try {
      await setStatus.mutateAsync({ pitchId: pitch.pitch_id, status: 'pitched', detail: 'Re-pitched from the board' });
      setNote({ ok: true, text: `${pitch.target_name} moved back to pitched.` });
    } catch (err) {
      setNote({ ok: false, text: `Re-pitch failed — ${apiErrorMessage(err)}` });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Concierge Outreach"
        description="Pitch drafts we build on a target's behalf (#434). Drafts stay private until the target claims and publishes them."
      />

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
          <>Loading the live board from <code>/pitches</code>…</>
        ) : usingSample ? (
          <>
            Seeded sample — live <code>/pitches</code> not reachable from here. Actions POST best-effort and
            report what the API said. No real contact details are in the sample.
          </>
        ) : (
          <>
            Live board from <code>/pitches</code> — {all.length} target(s). Contact details are
            <span className="font-medium"> no-store</span>: don't paste them elsewhere.
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => setIntakeOpen(true)}>
          New target
        </Button>
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          placeholder="All statuses"
          options={BOARD_COLUMNS.map(c => ({ value: c.status, label: STATUS_LABEL[c.status] }))}
          className="w-44"
        />
        <div className="w-56">
          <AssigneeSelect
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            extra={knownAssignees}
            placeholder="All assignees"
          />
        </div>
        {assignedTo && (
          <Button variant="ghost" onClick={() => setAssignedTo('')}>
            Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-gray-400 tabular-nums">
          {pitches.length} shown{query.isFetching ? ' · refreshing…' : ''}
        </span>
      </div>

      {note && (
        <div
          className={`mb-4 rounded p-2 text-xs ${
            note.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {note.text}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map(col => (
          <div key={col.status} className="w-64 shrink-0">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{col.label}</span>
              <span className="text-xs tabular-nums text-gray-400">{col.cards.length}</span>
            </div>
            <div className="mb-2 px-1 text-[11px] text-gray-400">{col.hint}</div>
            <div className="space-y-2">
              {col.cards.map(p => (
                <PitchCard key={p.pitch_id} pitch={p} onRepitch={repitch} busy={busyId === p.pitch_id} />
              ))}
              {col.cards.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-[11px] text-gray-400">
                  empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <IntakeModal
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onCreated={pitch => {
          setIntakeOpen(false);
          if (pitch?.pitch_id) navigate(`/concierge/${pitch.pitch_id}`);
          else setNote({ ok: true, text: 'Draft created.' });
        }}
      />
    </>
  );
}
