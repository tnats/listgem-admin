import { useState } from 'react';
import { Button } from '../../components/Form';
import { currentStep, pitchFlow } from './pitchFlow';
import { inviteUrl, previewUrl } from './pitchRules';

const MARK = {
  done: { glyph: '✓', cls: 'text-green-600' },
  current: { glyph: '●', cls: 'text-indigo-600' },
  blocked: { glyph: '!', cls: 'text-red-600' },
  waiting: { glyph: '◷', cls: 'text-blue-500' },
  todo: { glyph: '○', cls: 'text-gray-300' },
  skipped: { glyph: '–', cls: 'text-gray-300' },
};

function Crumb({ step, live }) {
  const mark = MARK[step.state] || MARK.todo;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap ${
        live ? 'font-medium text-gray-900' : step.state === 'done' ? 'text-gray-500' : 'text-gray-400'
      }`}
      title={step.detail || undefined}
    >
      <span className={mark.cls} aria-hidden="true">{mark.glyph}</span>
      {step.label}
    </span>
  );
}

/**
 * Where this pitch is, and the one thing to do next.
 *
 * A guide rail rather than a wizard: it sits above the tabs and leaves them
 * alone, so it helps someone who doesn't know the sequence without slowing
 * down someone who does.
 */
export default function PitchFlowRail({ pitch, items, confirmed, onTab, onStatus, onModal, busy }) {
  const [copied, setCopied] = useState(false);
  const steps = pitchFlow({
    pitch,
    items,
    confirmed,
    previewHref: previewUrl(pitch?.preview_token),
    inviteHref: inviteUrl(pitch?.invite_token),
  });
  const live = currentStep(steps);
  if (steps.length === 0) return null;

  async function run(action) {
    if (!action) return;
    if (action.kind === 'tab') onTab?.(action.tab);
    else if (action.kind === 'status') onStatus?.(action.to);
    else if (action.kind === 'modal') onModal?.(action.modal);
    else if (action.kind === 'link') window.open(action.href, '_blank', 'noopener');
    else if (action.kind === 'copy') {
      try {
        await navigator.clipboard.writeText(action.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setCopied(false);
      }
    }
  }

  const ended = steps.length === 1 && steps[0].state === 'skipped';

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-100 px-4 py-2 text-xs">
        {steps.map(s => (
          <Crumb key={s.id} step={s} live={live?.id === s.id} />
        ))}
      </div>

      {live && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-900">
              {ended ? live.label : live.state === 'waiting' ? `Waiting: ${live.label}` : `Next: ${live.label}`}
            </div>
            {live.detail && <div className="mt-0.5 text-xs text-gray-500">{live.detail}</div>}
          </div>
          {live.extra && (
            <Button size="sm" disabled={busy} onClick={() => run(live.extra)}>
              {live.extra.label}
            </Button>
          )}
          {live.action && live.state !== 'waiting' && (
            <Button variant="primary" size="sm" disabled={busy} onClick={() => run(live.action)}>
              {copied && live.action.kind === 'copy' ? 'Copied' : live.action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
