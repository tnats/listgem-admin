import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Modal from './Modal';

/**
 * Mirrors how every dialog in the portal uses Modal: local state, and an inline
 * arrow for onClose that changes identity on each render. That combination is
 * what made the focus effect re-run on every keystroke.
 */
function Host() {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  return (
    <Modal open title="Test dialog" onClose={() => {}}>
      <input aria-label="first" value={first} onChange={e => setFirst(e.target.value)} />
      <input aria-label="second" value={second} onChange={e => setSecond(e.target.value)} />
    </Modal>
  );
}

describe('Modal focus', () => {
  it('focuses the first control when it opens', () => {
    render(<Host />);
    expect(document.activeElement).toBe(screen.getByLabelText('first'));
  });

  it('does not steal focus back on re-render', () => {
    render(<Host />);
    const second = screen.getByLabelText('second');
    second.focus();
    fireEvent.change(second, { target: { value: 'typing here' } });

    // Regression: the focus effect was keyed on [open, onClose], so an inline
    // onClose re-ran it every render and yanked the caret to the first field.
    expect(document.activeElement).toBe(second);
  });

  it('keeps focus across several keystrokes', () => {
    render(<Host />);
    const second = screen.getByLabelText('second');
    second.focus();
    for (const value of ['a', 'ab', 'abc']) {
      fireEvent.change(second, { target: { value } });
      expect(document.activeElement).toBe(second);
    }
    expect(second.value).toBe('abc');
  });
});
