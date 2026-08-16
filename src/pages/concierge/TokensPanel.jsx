import { useState } from 'react';
import { Button } from '../../components/Form';
import { usePitchMutations } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import { canIssueTokens, inviteUrl, isExpired, previewUrl, tokenIssueBlockedReason } from './pitchRules';

function CopyRow({ label, url, hint }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  return (
    <div className="rounded border border-gray-200 p-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
        <Button
          size="sm"
          className="ml-auto"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <a href={url} target="_blank" rel="noreferrer" className="block truncate text-xs text-indigo-600 hover:underline">
        {url}
      </a>
    </div>
  );
}

function fmt(iso) {
  return iso ? new Date(iso).toLocaleString() : '—';
}

/**
 * Preview + invite generation. The invite is a *capability*: whoever holds the
 * link can claim the draft, which is why identity is confirmed after the claim
 * and never here.
 */
export default function TokensPanel({ pitch }) {
  const { issueTokens } = usePitchMutations(pitch.pitch_id);
  const [note, setNote] = useState(null);
  const [issued, setIssued] = useState(null);

  const blocked = tokenIssueBlockedReason(pitch);
  const invite = issued?.invite_token || pitch.invite_token;
  const preview = issued?.preview_token || pitch.preview_token;
  const expiresAt = issued?.invite_expires_at || pitch.invite_expires_at;
  const expired = isExpired(expiresAt);

  /**
   * An expired invite on a pitch still in play means one thing: the 30-day TTL
   * lapsed on a pitch nobody answered. Only two paths write invite_expires_at —
   * issuing tokens sets the TTL, takedown NULLs it — and nothing sets it into
   * the past, so there is no such thing as a deliberately held invite.
   *
   * Re-issuing is therefore the right move, and this says so rather than
   * standing in its way.
   */
  const inPlay = pitch.status === 'pitched' || pitch.status === 'accepted';
  const lapsed = expired && inPlay && !pitch.invite_used_at;

  async function issue() {
    setNote(null);
    try {
      const data = await issueTokens.mutateAsync({});
      setIssued(data);
      setNote({ ok: true, text: `Tokens issued — invite valid ${data?.invite_ttl_days ?? 30} days.` });
    } catch (err) {
      setNote({ ok: false, text: `Token issue failed — ${apiErrorMessage(err)}` });
    }
  }

  return (
    <div className="space-y-3">
      {note && (
        <div className={`rounded p-2 text-xs ${note.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {note.text}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Preview + invite links</h3>
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            disabled={!canIssueTokens(pitch) || issueTokens.isPending}
            onClick={issue}
          >
            {issueTokens.isPending ? 'Issuing…' : invite ? 'Re-issue tokens' : 'Generate tokens'}
          </Button>
        </div>

        {blocked && <div className="mb-3 rounded bg-gray-50 p-2 text-xs text-gray-600">{blocked}</div>}

        {lapsed && (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <span className="font-medium">The 30-day invite has lapsed.</span> Re-issue to send a fresh link —
            that's the normal next step on a pitch nobody has answered. It replaces both tokens, so any link
            already sent stops working.
          </div>
        )}

        <div className="space-y-2">
          <CopyRow label="Preview" url={previewUrl(preview)} hint="Read-only page for the target. Public, no auth." />
          <CopyRow
            label="Invite"
            url={inviteUrl(invite)}
            hint="Anyone holding this can claim the draft — send it to the target only."
          />
          {!preview && !invite && (
            <div className="rounded border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
              No tokens issued yet.
            </div>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between border-t border-gray-100 pt-1">
            <dt className="text-gray-500">Invite expires</dt>
            <dd className={expired ? 'text-red-600' : 'text-gray-700'}>
              {fmt(expiresAt)}
              {expired && ' · expired'}
            </dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-1">
            <dt className="text-gray-500">Claimed</dt>
            <dd className="text-gray-700">{fmt(pitch.invite_used_at)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-[11px] text-gray-400">
          A claim proves someone held the link, not that they are the target — assistants and managers click
          these on a principal's behalf. Confirm identity on the Identity tab after the claim lands.
        </p>
      </div>
    </div>
  );
}
