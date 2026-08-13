import { useState } from 'react';
import Modal from '../../components/Modal';
import { Button, Field, TextArea, TextInput } from '../../components/Form';
import { usePitchMutations } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import AssigneeSelect from './AssigneeSelect';

// PATCH /pitches/:id takes editable fields only — status and tokens have their
// own endpoints and are deliberately absent here.
//
// Grouped exactly as intake is, and for the same reason: the second group is
// copied onto the target's list when they claim the draft, so those fields are
// written for them. Editing them after a claim does nothing — the API freezes a
// provisioned pitch — so this dialog is for the window before that.
const INTERNAL = [
  { key: 'target_name', label: 'Target name', hint: 'The person or organisation, not the list.' },
  { key: 'target_org', label: 'Organisation' },
  { key: 'target_contact', label: 'Contact', hint: 'Purged in full by takedown.' },
  { key: 'notes', label: 'Notes', multiline: true },
];

const INHERITED = [
  { key: 'proposed_title', label: 'Proposed title', hint: "The list's name, as they'll see it." },
  { key: 'proposed_description', label: 'Proposed description', multiline: true },
  { key: 'category', label: 'Category', hint: 'Free text. Copied onto their list.' },
  { key: 'source_url', label: 'Source URL', hint: "The exact page you're rebuilding." },
  { key: 'source_attribution', label: 'Source attribution', hint: 'Credit line on their list.' },
];

const FIELDS = [...INTERNAL, ...INHERITED, { key: 'assigned_to', label: 'Assigned to' }];

function Section({ title, note }) {
  return (
    <div className="mt-1 mb-3 border-b border-gray-100 pb-1.5">
      <h4 className="text-xs font-semibold tracking-wide text-gray-700 uppercase">{title}</h4>
      <p className="mt-0.5 text-xs text-gray-400">{note}</p>
    </div>
  );
}

export default function EditDetailsModal({ open, pitch, onClose, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(f => [f.key, pitch?.[f.key] ?? ''])));
  const [apiError, setApiError] = useState(null);
  const { update } = usePitchMutations(pitch?.pitch_id);

  // Re-seed when a different pitch (or a fresher copy) arrives.
  const [seen, setSeen] = useState(pitch);
  if (pitch !== seen) {
    setSeen(pitch);
    setForm(Object.fromEntries(FIELDS.map(f => [f.key, pitch?.[f.key] ?? ''])));
  }

  const set = (key, value) => setForm(s => ({ ...s, [key]: value }));

  async function submit() {
    setApiError(null);
    try {
      const body = Object.fromEntries(FIELDS.map(f => [f.key, form[f.key]?.trim() || null]));
      const data = await update.mutateAsync(body);
      onSaved?.(data);
      onClose?.();
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  }

  const renderField = f => (
    <Field key={f.key} label={f.label} hint={f.hint} htmlFor={`edit_${f.key}`}>
      {f.multiline ? (
        <TextArea
          id={`edit_${f.key}`}
          rows={2}
          value={form[f.key] || ''}
          onChange={e => set(f.key, e.target.value)}
        />
      ) : (
        <TextInput
          id={`edit_${f.key}`}
          value={form[f.key] || ''}
          onChange={e => set(f.key, e.target.value)}
        />
      )}
    </Field>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit pitch details"
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </>
      }
    >
      {apiError && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{apiError}</div>}

      <Section title="Who you're pitching to" note="Internal. Never shown to the target." />
      {INTERNAL.map(renderField)}
      <Field label="Assigned to" hint="Who's chasing this one." htmlFor="edit_assigned_to">
        <AssigneeSelect
          id="edit_assigned_to"
          value={form.assigned_to}
          onChange={e => set('assigned_to', e.target.value)}
        />
      </Field>

      <Section
        title="The list they'll receive"
        note="Copied into their account when they claim the draft — write it for them, not for us."
      />
      {INHERITED.map(renderField)}
    </Modal>
  );
}
