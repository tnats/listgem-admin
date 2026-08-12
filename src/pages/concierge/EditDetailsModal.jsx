import { useState } from 'react';
import Modal from '../../components/Modal';
import { Button, Field, TextArea, TextInput } from '../../components/Form';
import { usePitchMutations } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';

// PATCH /pitches/:id takes editable fields only — status and tokens have their
// own endpoints and are deliberately absent here.
const FIELDS = [
  { key: 'target_name', label: 'Target name' },
  { key: 'target_org', label: 'Organisation' },
  { key: 'target_contact', label: 'Contact', hint: 'Purged in full by takedown.' },
  { key: 'source_url', label: 'Source URL' },
  { key: 'source_attribution', label: 'Source attribution' },
  { key: 'proposed_title', label: 'Proposed title' },
  { key: 'proposed_description', label: 'Proposed description', multiline: true },
  { key: 'category', label: 'Category' },
  { key: 'assigned_to', label: 'Assigned to' },
  { key: 'notes', label: 'Notes', multiline: true },
];

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
      {FIELDS.map(f => (
        <Field key={f.key} label={f.label} hint={f.hint} htmlFor={`edit_${f.key}`}>
          {f.multiline ? (
            <TextArea
              id={`edit_${f.key}`}
              rows={2}
              value={form[f.key] || ''}
              onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
            />
          ) : (
            <TextInput
              id={`edit_${f.key}`}
              value={form[f.key] || ''}
              onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
            />
          )}
        </Field>
      ))}
    </Modal>
  );
}
