import { useState } from 'react';
import Modal from '../../components/Modal';
import { Button, Checkbox, Field, TextArea } from '../../components/Form';
import { useUserRoles } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';

/**
 * Grant or revoke staff roles (listgem-platform#542) — the replacement for
 * running UPDATE against production by hand.
 *
 * Two things worth knowing, both enforced server-side and surfaced here:
 *  - The last admin cannot be demoted (409). The portal is admin-only, so zero
 *    admins locks everyone out with no recovery short of raw SQL.
 *  - Demoting yourself succeeds while another admin remains, but your current
 *    session keeps working: `is_admin` is a claim baked into the JWT at login,
 *    so the change bites at next sign-in. The response's `self` flag is what
 *    tells us to say so.
 */
export default function RolesModal({ open, user, onClose, onDone }) {
  const [isAdmin, setIsAdmin] = useState(!!user?.is_admin);
  const [isModerator, setIsModerator] = useState(!!user?.is_moderator);
  const [reason, setReason] = useState('');
  const [apiError, setApiError] = useState(null);
  const roles = useUserRoles();

  // Re-seed when a different row is opened.
  const [seen, setSeen] = useState(user);
  if (user !== seen) {
    setSeen(user);
    setIsAdmin(!!user?.is_admin);
    setIsModerator(!!user?.is_moderator);
    setReason('');
    setApiError(null);
  }

  const label = user?.display_name || user?.username || user?.email;
  const unchanged = !!user?.is_admin === isAdmin && !!user?.is_moderator === isModerator;
  const losingOwnAdmin = user?.is_admin && !isAdmin;

  function close() {
    setReason('');
    setApiError(null);
    onClose?.();
  }

  async function submit() {
    setApiError(null);
    try {
      const data = await roles.mutateAsync({
        userId: user.user_id,
        is_admin: isAdmin,
        is_moderator: isModerator,
        reason: reason.trim(),
      });
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
      title="Staff roles"
      description={label}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant={losingOwnAdmin ? 'danger' : 'primary'}
            onClick={submit}
            disabled={roles.isPending || unchanged || !reason.trim()}
          >
            {roles.isPending ? 'Saving…' : 'Save roles'}
          </Button>
        </>
      }
    >
      {apiError && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{apiError}</div>}

      <Checkbox
        id="role_is_admin"
        label="Admin"
        hint="Full portal access — moderation, verification, concierge, takedowns. The only role that can sign in."
        checked={isAdmin}
        onChange={e => setIsAdmin(e.target.checked)}
      />
      <Checkbox
        id="role_is_moderator"
        label="Moderator"
        hint="Cannot sign into the portal today. Assignable on the concierge board."
        checked={isModerator}
        onChange={e => setIsModerator(e.target.checked)}
      />

      {losingOwnAdmin && (
        <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
          Removing admin. If this is your own account you'll keep working until you sign out — the flag is read
          into your session at login — and you won't be able to sign back in.
        </p>
      )}

      <Field
        label="Reason"
        required
        hint="Recorded in the audit trail, so an offboarding is answerable later."
        htmlFor="role_reason"
      >
        <TextArea
          id="role_reason"
          rows={2}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Onboarding Susan for concierge outreach."
        />
      </Field>
    </Modal>
  );
}
