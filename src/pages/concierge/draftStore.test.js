import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, readDraft, saveDraft } from './draftStore';

const rows = [{ raw_text: 'Persona (1966)', thing_id: null, status: 'unresolved' }];

describe('draft store', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips an in-progress build', () => {
    saveDraft('p_1', rows);
    expect(readDraft('p_1').rows).toEqual(rows);
  });

  it('keeps drafts separate per pitch', () => {
    saveDraft('p_1', rows);
    expect(readDraft('p_2')).toBeNull();
  });

  it('ignores an empty or malformed draft rather than restoring nothing over real rows', () => {
    saveDraft('p_1', []);
    expect(readDraft('p_1')).toBeNull();
    sessionStorage.setItem('pitchDraft:p_2', '{not json');
    expect(readDraft('p_2')).toBeNull();
    sessionStorage.setItem('pitchDraft:p_3', JSON.stringify({ v: 99, rows }));
    expect(readDraft('p_3')).toBeNull();
  });

  it('clears once the work is saved', () => {
    saveDraft('p_1', rows);
    clearDraft('p_1');
    expect(readDraft('p_1')).toBeNull();
  });

  it('survives storage being unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } },
    });
    expect(() => saveDraft('p_1', rows)).not.toThrow();
    expect(readDraft('p_1')).toBeNull();
    Object.defineProperty(window, 'sessionStorage', original);
  });
});
