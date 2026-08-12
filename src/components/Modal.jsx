import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/**
 * The repo's one modal. Escape + backdrop close, focus lands inside on open,
 * body scroll locked. `footer` is where the confirm/cancel pair goes so every
 * dialog in the portal lands its buttons in the same place.
 */
export default function Modal({ open, title, description, onClose, children, footer, size = 'md' }) {
  const panelRef = useRef(null);

  // Keep the latest onClose in a ref so the listener below binds once. Callers
  // pass an inline arrow, which changes identity on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current?.();
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Focus the first control ONCE per opening — never on subsequent renders.
  // Sharing an effect with the listener above (and keying it on `onClose`) meant
  // this re-ran on every keystroke and yanked the caret back to the first field.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector('input, textarea, select, button')?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 py-10"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${SIZES[size] || SIZES.md} flex max-h-[85vh] flex-col rounded-lg bg-white shadow-lg`}
      >
        <div className="border-b border-gray-100 px-5 pt-4 pb-3">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
