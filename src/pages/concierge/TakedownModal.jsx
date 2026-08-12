import { useState } from 'react';
import Modal from '../../components/Modal';
import { Button, Field, TextArea } from '../../components/Form';
import { usePitchMutations } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';

/**
 * Takedown is one action, on purpose: it purges contact details, revokes both
 * tokens (so links already sent stop working) and archives the pitch. Splitting
 * it into steps would let an operator half-complete it and leave contact data
 * behind a dead link.
 */
export default function TakedownModal({ open, pitch, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [apiError, setApiError] = useState(null);
  const { takedown } = usePitchMutations(pitch?.pitch_id);

  function close() {
    setReason('');
    setApiError(null);
    onClose?.();
  }

  async function submit() {
    setApiError(null);
    try {
      const data = await takedown.mutateAsync({ reason: reason.trim() });
      close();
      onDone?.(data);
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Take down this pitch"
      description={pitch?.target_name}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" onClick={submit} disabled={takedown.isPending}>
            {takedown.isPending ? 'Taking down…' : 'Take down'}
          </Button>
        </>
      }
    >
      {apiError && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{apiError}</div>}

      <p className="mb-2 text-sm text-gray-700">One action, all three effects, not reversible:</p>
      <ul className="mb-3 space-y-1 text-sm text-gray-600">
        <li>· Contact details are purged from the record.</li>
        <li>· Both tokens are revoked — preview and invite links already sent stop working.</li>
        <li>· The pitch is archived.</li>
      </ul>

      <Field label="Reason" hint="Optional, kept on the audit trail." htmlFor="takedown_reason">
        <TextArea
          id="takedown_reason"
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Source site requested removal."
        />
      </Field>
    </Modal>
  );
}
