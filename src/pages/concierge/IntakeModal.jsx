import { useState } from 'react';
import Modal from '../../components/Modal';
import { Button, Field, Select, TextArea, TextInput } from '../../components/Form';
import { usePitchMutations, useThingTypes } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import { RETIRED_THING_TYPES } from '../../taxonomy';
import AssigneeSelect from './AssigneeSelect';
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

/**
 * Marks a field whose value is rendered on the public preview page.
 *
 * Every one of these reaches anyone the preview link is forwarded to. It was
 * not visible from the form: a source attribution typed as "ew" — shorthand
 * for the operator, a credit line to the target — went out reading
 * "Compiled from ew."
 */
function Public() {
  return (
    <span
      className="ml-1 rounded bg-indigo-50 px-1 py-0.5 align-middle text-[10px] font-medium text-indigo-700"
      title="Rendered on the preview page the target sees"
    >
      target sees this
    </span>
  );
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

function Section({ title, note }) {
  return (
    <div className="mt-1 mb-3 border-b border-gray-100 pb-1.5">
      <h4 className="text-xs font-semibold tracking-wide text-gray-700 uppercase">{title}</h4>
      <p className="mt-0.5 text-xs text-gray-400">{note}</p>
    </div>
  );
}

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

      {/* Two groups, because the fields split cleanly in two and the split is
          not guessable: half stay internal, half are copied onto the list the
          target receives when they claim it (pitchLists.js provisioning). */}
      <Section title="Who you're pitching to" note="Internal. Never shown to the target." />

      <div className="grid grid-cols-2 gap-x-4">
        <Field
          label={<>Target name<Public /></>}
          required
          error={show('target_name')}
          hint="The person or organisation, not the list."
          htmlFor="target_name"
        >
          <TextInput
            id="target_name"
            value={form.target_name}
            onChange={e => set('target_name', e.target.value)}
            placeholder="e.g. Ava Lindqvist"
          />
        </Field>
        <Field label={<>Organisation<Public /></>} hint="Where they do this, if relevant." htmlFor="target_org">
          <TextInput
            id="target_org"
            value={form.target_org}
            onChange={e => set('target_org', e.target.value)}
            placeholder="e.g. Nordic Film Institute"
          />
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
        <Field label="Assigned to" hint="Who's chasing this one. Optional." htmlFor="assigned_to">
          <AssigneeSelect
            id="assigned_to"
            value={form.assigned_to}
            onChange={e => set('assigned_to', e.target.value)}
          />
        </Field>
        <Field label="Notes" hint="Anything the next person needs to know." htmlFor="notes">
          <TextInput id="notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
      </div>

      <Section
        title="The list they'll receive"
        note="Copied into their account when they claim the draft — write it for them, not for us."
      />

      <Field
        label={<>Proposed title<Public /></>}
        required
        error={show('proposed_title')}
        hint="The list's name, as they'll see it."
        htmlFor="proposed_title"
      >
        <TextInput
          id="proposed_title"
          value={form.proposed_title}
          onChange={e => set('proposed_title', e.target.value)}
          placeholder="e.g. Essential Nordic Noir"
        />
      </Field>

      <Field label={<>Proposed description<Public /></>} hint="Optional. Sits under the title." htmlFor="proposed_description">
        <TextArea
          id="proposed_description"
          rows={2}
          value={form.proposed_description}
          onChange={e => set('proposed_description', e.target.value)}
          placeholder="e.g. Twenty-four films that built the genre, in the order Ava lists them."
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        <Field
          label="Thing type"
          required
          error={show('thing_type')}
          hint="One type per list. A mixed source list needs two pitches."
          htmlFor="thing_type"
        >
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
        <Field label={<>Category<Public /></>} hint="Free text. Copied onto their list." htmlFor="category">
          <TextInput
            id="category"
            value={form.category}
            onChange={e => set('category', e.target.value)}
            placeholder="e.g. crime"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        <Field
          label={<>Source URL<Public /></>}
          hint="The exact page you're rebuilding — not the site's home page."
          htmlFor="source_url"
        >
          <TextInput
            id="source_url"
            value={form.source_url}
            onChange={e => set('source_url', e.target.value)}
            placeholder="https://example.org/their-list"
          />
        </Field>
        <Field
          label={<>Source attribution<Public /></>}
          hint="Credit line as it will read: “Compiled from …”. Write it as the source would — a name, not shorthand."
          htmlFor="source_attribution"
        >
          <TextInput
            id="source_attribution"
            value={form.source_attribution}
            onChange={e => set('source_attribution', e.target.value)}
            placeholder="e.g. Nordic Film Institute, staff picks"
          />
        </Field>
      </div>
    </Modal>
  );
}
