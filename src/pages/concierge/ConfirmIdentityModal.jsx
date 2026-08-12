import { useState } from 'react';
import Modal from '../../components/Modal';
import { Button, Field, Select, TextArea } from '../../components/Form';
import { usePitchMutations } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import { confirmIdentityErrors, hasErrors } from './pitchRules';

/**
 * Confirm identity — only reachable once the pitch is `provisioned`.
 *
 * Evidence is mandatory and not a nicety: a concierge grant has no
 * machine-checkable proof, so this note is the only thing standing behind the
 * badge. The API 400s without it; the button stays disabled without it.
 */
export default function ConfirmIdentityModal({ open, pitch, onClose, onConfirmed }) {
  const [type, setType] = useState('individual');
  const [evidence, setEvidence] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState(null);
  const { confirmIdentity } = usePitchMutations(pitch?.pitch_id);

  const errors = confirmIdentityErrors({ evidence, type });

  function close() {
    setEvidence('');
    setType('individual');
    setSubmitted(false);
    setApiError(null);
    onClose?.();
  }

  async function submit() {
    setSubmitted(true);
    setApiError(null);
    if (hasErrors(errors)) return;
    try {
      const data = await confirmIdentity.mutateAsync({ evidence: evidence.trim(), type });
      close();
      onConfirmed?.(data);
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Confirm identity"
      description={`Grants the verified badge to the account that claimed ${pitch?.target_name || 'this draft'}.`}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={confirmIdentity.isPending || !evidence.trim()}
          >
            {confirmIdentity.isPending ? 'Confirming…' : 'Confirm identity'}
          </Button>
        </>
      }
    >
      {apiError && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{apiError}</div>}

      <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
        The invite is a capability, not proof — an assistant or manager may have clicked it. Confirm only what
        you have actually checked about the person behind the claiming account.
      </p>

      <Field label="Type" required error={submitted ? errors.type : undefined} htmlFor="identity_type">
        <Select
          id="identity_type"
          value={type}
          onChange={e => setType(e.target.value)}
          options={[
            { value: 'individual', label: 'Individual' },
            { value: 'organization', label: 'Organization' },
          ]}
        />
      </Field>

      <Field
        label="Evidence"
        required
        error={submitted ? errors.evidence : undefined}
        hint="Internal, never published. What did you check — a reply from a known address, a call, a signed contract?"
        htmlFor="identity_evidence"
      >
        <TextArea
          id="identity_evidence"
          rows={4}
          value={evidence}
          onChange={e => setEvidence(e.target.value)}
          placeholder="e.g. Replied from the address on their institutional staff page, confirmed the claim on a call 2026-08-11."
        />
      </Field>
    </Modal>
  );
}
