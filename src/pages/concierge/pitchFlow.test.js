import { describe, expect, it } from 'vitest';
import { currentStep, itemCounts, pitchFlow } from './pitchFlow';

const base = {
  pitch_id: 'p1',
  target_name: 'Bob Bob',
  proposed_title: 'Scary movies',
  thing_type: 'Movie',
  status: 'draft',
  can_repitch: false,
  item_count: 0,
  resolved_count: 0,
  preview_token: null,
  invite_token: null,
  invite_used_at: null,
  invite_expires_at: null,
};

const flow = (over = {}, extra = {}) =>
  pitchFlow({ pitch: { ...base, ...over }, previewHref: '/p', inviteHref: '/i', ...extra });
const live = (over = {}, extra = {}) => currentStep(flow(over, extra));
const stateOf = (steps, id) => steps.find(s => s.id === id)?.state;

describe('pitchFlow — one live step, always', () => {
  it('never shows two things to do at once', () => {
    // The rail answers "what now" with one answer or it isn't a rail.
    const cases = [
      {},
      { item_count: 40, resolved_count: 37 },
      { item_count: 40, resolved_count: 40 },
      { item_count: 40, resolved_count: 40, preview_token: 'p', invite_token: 'i' },
      { status: 'pitched', item_count: 40, resolved_count: 40, preview_token: 'p', invite_token: 'i' },
      { status: 'accepted', item_count: 40, resolved_count: 40, preview_token: 'p', invite_token: 'i' },
      { status: 'provisioned', item_count: 40, resolved_count: 40, preview_token: 'p', invite_token: 'i', invite_used_at: '2026-08-26T00:00:00Z' },
    ];
    for (const c of cases) {
      const n = flow(c).filter(s => ['current', 'blocked', 'waiting'].includes(s.state)).length;
      expect(n, JSON.stringify(c)).toBeLessThanOrEqual(1);
    }
  });

  it('returns nothing at all without a pitch', () => {
    expect(pitchFlow({ pitch: null })).toEqual([]);
    expect(currentStep([])).toBeNull();
  });
});

describe('pitchFlow — the order the work actually happens in', () => {
  it('starts at the list, not the links', () => {
    expect(live().label).toMatch(/Build the list/i);
    expect(live().action).toEqual({ kind: 'tab', tab: 'build', label: 'Open the builder' });
  });

  it('counts what is saved, not what is on screen', () => {
    // item_count/resolved_count are the server's numbers. A builder full of
    // unsaved rows must not tick this step.
    const step = live({ item_count: 40, resolved_count: 37 });
    expect(step.label).toMatch(/Build the list/i);
    expect(step.detail).toMatch(/3 of 40/);
  });

  it('offers the links once the list is whole', () => {
    expect(live({ item_count: 40, resolved_count: 40 }).label).toMatch(/Generate the links/i);
  });

  it('offers the preview alongside the links, since that is when you check it', () => {
    const steps = flow({ item_count: 40, resolved_count: 40, preview_token: 'p', invite_token: 'i' });
    expect(steps.find(s => s.id === 'links').extra).toEqual({ kind: 'link', href: '/p', label: 'Open preview' });
  });
});

describe('pitchFlow — the gate that sent a dead invite', () => {
  const built = { item_count: 40, resolved_count: 40, preview_token: 'p', invite_token: 'i' };

  it('puts "mark as pitched" before "send the invite"', () => {
    // The failure this exists for: tokens issued on a draft, invite sent, and
    // the server answered the *target* with 410 not_claimable_from_draft.
    const step = live(built);
    expect(step.label).toMatch(/Mark as pitched/i);
    expect(step.detail).toMatch(/draft cannot be claimed/i);
    expect(step.action).toEqual({ kind: 'status', to: 'pitched', label: 'Mark as pitched' });
  });

  it('holds the invite back while the pitch is a draft', () => {
    expect(stateOf(flow(built), 'send')).toBe('todo');
  });

  it('hands over the invite once it has been pitched', () => {
    const step = live({ ...built, status: 'pitched' });
    expect(step.label).toMatch(/Send the invite/i);
    expect(step.action).toEqual({ kind: 'copy', text: '/i', label: 'Copy invite link' });
  });

  it('does not pretend to know a link was sent', () => {
    expect(live({ ...built, status: 'pitched' }).detail).toMatch(/nothing records a send/i);
  });

  it('offers the preview beside the invite, and says to send it first', () => {
    // The invite page names the list and shows none of it, so an invite sent
    // alone asks someone to create an account for a list they've never seen.
    const step = live({ ...built, status: 'pitched' });
    expect(step.extra).toEqual({ kind: 'copy', text: '/p', label: 'Copy preview link' });
    expect(step.detail).toMatch(/preview first/i);
  });
});

describe('pitchFlow — steps that are not the operator\'s move', () => {
  const sent = { item_count: 40, resolved_count: 40, preview_token: 'p', invite_token: 'i', status: 'pitched' };

  it('waits only once there is evidence the ball is with them', () => {
    // `pitched` means we marked it pitched, not that anyone received anything —
    // calling that "waiting on them" would excuse an outreach nobody made.
    expect(stateOf(flow(sent), 'claim')).toBe('todo');

    // `accepted` is the target answering, so the wait is real.
    const claim = flow({ ...sent, status: 'accepted' }).find(s => s.id === 'claim');
    expect(claim.state).toBe('waiting');
    expect(claim.action).toBeNull();
    expect(claim.detail).toMatch(/accepted and have not claimed/i);
    // Re-sending is the one useful move while waiting.
    expect(claim.extra).toEqual({ kind: 'copy', text: '/i', label: 'Copy invite link' });
  });

  it('sends you to Outreach for an expired invite rather than re-issuing behind your back', () => {
    // Re-issue kills any link already sent; that consequence is spelled out in
    // the panel, so the rail navigates instead of acting.
    const step = live({ ...sent, invite_expires_at: '2020-01-01T00:00:00Z' });
    expect(step.state).toBe('blocked');
    expect(step.action.kind).toBe('tab');
    expect(step.action.label).not.toMatch(/^Re-issue tokens$/);
  });
});

describe('pitchFlow — identity comes after the claim, never before', () => {
  const claimed = {
    item_count: 40, resolved_count: 40, preview_token: 'p', invite_token: 'i',
    invite_used_at: '2026-08-26T00:00:00Z', status: 'provisioned',
  };

  it('asks for identity only once the draft is provisioned', () => {
    const step = live(claimed);
    expect(step.label).toMatch(/Confirm identity/i);
    expect(step.detail).toMatch(/claim alone is not proof/i);
  });

  it('keeps identity out of reach before the claim', () => {
    expect(stateOf(flow({ ...claimed, status: 'pitched', invite_used_at: null }), 'identity')).toBe('todo');
  });

  it('finishes when identity is confirmed', () => {
    const steps = flow(claimed, { confirmed: { user_id: 'u1' } });
    expect(stateOf(steps, 'identity')).toBe('done');
    expect(currentStep(steps)).toBeNull();
  });
});

describe('pitchFlow — pitches that have ended', () => {
  it('offers no next move on an archived pitch', () => {
    const steps = flow({ status: 'archived' });
    expect(steps).toHaveLength(1);
    expect(steps[0].state).toBe('skipped');
    expect(steps[0].detail).toMatch(/taken down/i);
  });

  it('says declined is terminal rather than offering a re-pitch', () => {
    expect(flow({ status: 'declined' })[0].detail).toMatch(/terminal/i);
  });
});

describe('itemCounts — the rows are the truth when we have them', () => {
  const rows = [
    { position: 0, thing_id: 'movie_it_2017' },
    { position: 1, thing_id: 'movie_jaws_1975' },
    { position: 2, thing_id: null },
  ];

  it('counts the rows the detail endpoint returned, not the aggregates it omits', () => {
    // GET /pitches/:id returns items but no item_count/resolved_count, so the
    // rail reported "nothing saved yet" about a finished forty-item list.
    expect(itemCounts({ ...base }, rows)).toEqual({ items: 3, resolved: 2 });
  });

  it('accepts either signal for a resolved row', () => {
    expect(itemCounts({ ...base }, [{ resolved: true }, { thing_id: 'x' }, {}])).toEqual({ items: 3, resolved: 2 });
  });

  it('falls back to the aggregates for a board row, which has no array', () => {
    expect(itemCounts({ ...base, item_count: 40, resolved_count: 37 })).toEqual({ items: 40, resolved: 37 });
  });

  it('reads an empty array as an empty list, not as missing data', () => {
    expect(itemCounts({ ...base, item_count: 40, resolved_count: 40 }, [])).toEqual({ items: 0, resolved: 0 });
  });

  it('drives the rail past the build step on the pitch that was stuck', () => {
    const steps = pitchFlow({
      pitch: { ...base, status: 'draft', preview_token: 'p', invite_token: 'i' },
      items: Array.from({ length: 40 }, (_, i) => ({ position: i, thing_id: `movie_${i}` })),
    });
    expect(steps.find(s => s.id === 'build').state).toBe('done');
    expect(currentStep(steps).label).toMatch(/Mark as pitched/i);
  });
});

describe('pitchFlow — a claimed pitch is not still being built', () => {
  const claimed = {
    status: 'provisioned',
    item_count: 4, resolved_count: 2,
    preview_token: 'p', invite_token: 'i',
    invite_used_at: '2026-08-27T14:10:00Z',
  };

  it('stops asking for a list the API will not accept edits to', () => {
    // It read "Next: Build the list — 2 of 4 rows still unresolved" with a
    // "Finish the list" button, directly above the panel saying the item set
    // is theirs now and edits are rejected.
    const steps = flow(claimed);
    const build = steps.find(s => s.id === 'build');
    expect(build.state).toBe('done');
    expect(build.detail).toMatch(/2 of 4 item\(s\) resolved/);
    expect(build.detail).toMatch(/theirs now/i);
  });

  it('moves on to the step that is actually available', () => {
    const step = live(claimed);
    expect(step.label).toMatch(/Confirm identity/i);
    // Sends you to the tab rather than opening the modal: the claim timestamp
    // and provisioned account are there, and a badge should not be granted
    // without them. It also keeps one "Confirm identity" button per screen.
    expect(step.action).toEqual({ kind: 'tab', tab: 'identity', label: 'Open Identity' });
  });

  it('offers viewing rather than finishing', () => {
    expect(flow(claimed).find(s => s.id === 'build').action)
      .toEqual({ kind: 'tab', tab: 'build', label: 'View the list' });
  });

  it('still holds an editable pitch at the build step', () => {
    // The guard is about editability, not about unresolved rows.
    const open = { ...claimed, status: 'pitched', invite_used_at: null };
    expect(live(open).label).toMatch(/Build the list/i);
  });
});
