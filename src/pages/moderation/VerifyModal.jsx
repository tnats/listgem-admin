import { useState } from 'react';
import Modal from '../../components/Modal';
import { Button, Field, Select, TextArea, TextInput } from '../../components/Form';
import { useVerificationMutations } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import {
  VERIFICATION_METHODS,
  VERIFICATION_TYPES,
  methodSpec,
  requiresEvidence,
  requiresProof,
  unverifyErrors,
  verifyErrors,
  verifyPayload,
} from './verificationRules';

const EMPTY = { type: 'individual', method: 'manual', proof: '', evidence: '' };

/**
 * Grant or revoke the verified badge. Verification is display-only trust: never
 * self-asserted, always revocable, and with zero effect on ranking.
 */
export default function VerifyModal({ open, mode = 'verify', user, onClose, onDone }) {
  const [form, setForm] = useState(EMPTY);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState(null);
  const { verify, unverify } = useVerificationMutations();

  const isVerifyMode = mode === 'verify';
  const errors = isVerifyMode ? verifyErrors(form) : unverifyErrors({ reason });
  const pending = isVerifyMode ? verify.isPending : unverify.isPending;
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  function close() {
    setForm(EMPTY);
    setReason('');
    setSubmitted(false);
    setApiError(null);
    onClose?.();
  }

  async function submit() {
    setSubmitted(true);
    setApiError(null);
    if (Object.keys(errors).length > 0) return;
    try {
      const data = isVerifyMode
        ? await verify.mutateAsync({ userId: user.user_id, ...verifyPayload(form) })
        : await unverify.mutateAsync({ userId: user.user_id, reason: reason.trim() });
      close();
      onDone?.(data, mode);
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  }

  const spec = methodSpec(form.method);
  const label = user?.display_name || user?.username || user?.user_id;

  return (
    <Modal
      open={open}
      onClose={close}
      title={isVerifyMode ? 'Verify account' : 'Remove verification'}
      description={label}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant={isVerifyMode ? 'primary' : 'danger'}
            onClick={submit}
            disabled={pending || Object.keys(errors).length > 0}
          >
            {pending ? 'Saving…' : isVerifyMode ? 'Verify' : 'Remove verification'}
          </Button>
        </>
      }
    >
      {apiError && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{apiError}</div>}

      {isVerifyMode ? (
        <>
          <Field label="Type" required error={submitted ? errors.type : undefined} htmlFor="verify_type">
            <Select
              id="verify_type"
              value={form.type}
              onChange={e => set('type', e.target.value)}
              options={VERIFICATION_TYPES}
            />
          </Field>

          <Field
            label="Method"
            required
            error={submitted ? errors.method : undefined}
            hint={spec?.hint}
            htmlFor="verify_method"
          >
            <Select
              id="verify_method"
              value={form.method}
              onChange={e => set('method', e.target.value)}
              options={VERIFICATION_METHODS}
            />
          </Field>

          {requiresProof(form.method) && (
            <Field
              label="Proof"
              required
              error={submitted ? errors.proof : undefined}
              hint="Published with the badge — the proven domain or handle."
              htmlFor="verify_proof"
            >
              <TextInput
                id="verify_proof"
                value={form.proof}
                onChange={e => set('proof', e.target.value)}
                placeholder="nytimes.com"
              />
            </Field>
          )}

          <Field
            label="Evidence"
            required={requiresEvidence(form.method)}
            error={submitted ? errors.evidence : undefined}
            hint="Internal, never published. What was actually checked."
            htmlFor="verify_evidence"
          >
            <TextArea
              id="verify_evidence"
              rows={3}
              value={form.evidence}
              onChange={e => set('evidence', e.target.value)}
            />
          </Field>

          <p className="rounded bg-gray-50 p-2 text-[11px] text-gray-500">
            One badge, no tiers: `individual` and `organization` render identically, and the method never
            appears anywhere public.
          </p>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-700">
            The badge disappears entirely — revoked reads the same as never-verified, with no tombstone.
          </p>
          <Field label="Reason" required error={submitted ? errors.reason : undefined} htmlFor="unverify_reason">
            <TextArea
              id="unverify_reason"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Domain no longer resolves to the org."
            />
          </Field>
        </>
      )}
    </Modal>
  );
}
