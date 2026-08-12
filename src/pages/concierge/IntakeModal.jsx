import { useState } from 'react';
import Modal from '../../components/Modal';
import { Button, Field, Select, TextArea, TextInput } from '../../components/Form';
import { usePitchMutations, useThingTypes } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import { RETIRED_THING_TYPES } from '../../taxonomy';
import { FALLBACK_THING_TYPES, hasErrors, intakeErrors } from './pitchRules';

/**
 * Options from the canonical vocabulary, retired types removed, deepest first —
 * `count` is registry depth, which is a fair proxy for how well a type will
 * actually resolve in the builder.
 */
function typeOptions(live) {
  const usable = (live || []).filter(t => t?.type && !RETIRED_THING_TYPES.includes(t.type));
  if (usable.length === 0) {
    return { options: FALLBACK_THING_TYPES.map(t => ({ value: t, label: t })), offline: true };
  }
  const options = [...usable]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .map(t => ({
      value: t.type,
      label: `${t.icon ? `${t.icon} ` : ''}${t.display_name || t.type}${
        t.count ? ` · ${t.count.toLocaleString()}` : ''
      }`,
    }));
  return { options, offline: false };
}

const EMPTY = {
  target_name: '',
  target_org: '',
  target_contact: '',
  source_url: '',
  source_attribution: '',
  proposed_title: '',
  proposed_description: '',
  thing_type: '',
  category: '',
  assigned_to: '',
  notes: '',
};

export default function IntakeModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState(null);
  const { create } = usePitchMutations();
  const { data: typesData } = useThingTypes();
  const { options: typeOpts, offline: typesOffline } = typeOptions(typesData?.types);

  const errors = intakeErrors(form);
  const show = key => (submitted ? errors[key] : undefined);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  function close() {
    setForm(EMPTY);
    setSubmitted(false);
    setApiError(null);
    onClose?.();
  }

  async function submit() {
    setSubmitted(true);
    setApiError(null);
    if (hasErrors(errors)) return;
    const body = Object.fromEntries(
      Object.entries(form)
        .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
        .filter(([, v]) => v !== ''),
    );
    try {
      const data = await create.mutateAsync(body);
      const pitch = data?.pitch || data;
      close();
      onCreated?.(pitch);
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New concierge target"
      description="Creates a private draft. Nothing here is visible to anyone outside the portal until the target claims it."
      size="lg"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create draft'}
          </Button>
        </>
      }
    >
      {apiError && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{apiError}</div>}

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Target name" required error={show('target_name')} htmlFor="target_name">
          <TextInput
            id="target_name"
            value={form.target_name}
            onChange={e => set('target_name', e.target.value)}
            placeholder="Who we're rebuilding the list for"
          />
        </Field>
        <Field label="Organisation" htmlFor="target_org">
          <TextInput id="target_org" value={form.target_org} onChange={e => set('target_org', e.target.value)} />
        </Field>
      </div>

      <Field
        label="Contact"
        hint="Purged in full by takedown. Keep it to what outreach needs."
        htmlFor="target_contact"
      >
        <TextInput
          id="target_contact"
          value={form.target_contact}
          onChange={e => set('target_contact', e.target.value)}
          placeholder="email or handle"
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Source URL" hint="The public list we're rebuilding." htmlFor="source_url">
          <TextInput id="source_url" value={form.source_url} onChange={e => set('source_url', e.target.value)} />
        </Field>
        <Field label="Source attribution" hint="Credit line shown on the draft." htmlFor="source_attribution">
          <TextInput
            id="source_attribution"
            value={form.source_attribution}
            onChange={e => set('source_attribution', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Proposed title" required error={show('proposed_title')} htmlFor="proposed_title">
        <TextInput
          id="proposed_title"
          value={form.proposed_title}
          onChange={e => set('proposed_title', e.target.value)}
        />
      </Field>

      <Field label="Proposed description" htmlFor="proposed_description">
        <TextArea
          id="proposed_description"
          rows={2}
          value={form.proposed_description}
          onChange={e => set('proposed_description', e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Thing type" required error={show('thing_type')} htmlFor="thing_type">
          {/* No free-text escape hatch: with the live vocabulary, anything not on
              this list can only produce a 400. */}
          <Select
            id="thing_type"
            value={form.thing_type}
            placeholder="Select a type…"
            options={typeOpts}
            onChange={e => set('thing_type', e.target.value)}
          />
          {typesOffline && (
            <p className="mt-1 text-xs text-amber-700">
              <code>/types</code> unreachable — showing a short offline list.
            </p>
          )}
        </Field>
        <Field label="Category" htmlFor="category">
          <TextInput id="category" value={form.category} onChange={e => set('category', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Assigned to" htmlFor="assigned_to">
          <TextInput id="assigned_to" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <TextInput id="notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
