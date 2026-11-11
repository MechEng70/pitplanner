import type { ComponentChildren } from 'preact';
import { Close } from './icons.tsx';
import { useBack } from './back.ts';

/** Material bottom sheet: scrim, drag handle, title, close. Body scrolls; footer stays put. */
export function Sheet({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: ComponentChildren; footer?: ComponentChildren;
}) {
  useBack(onClose);
  return (
    <div class="scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-handle" />
        <header class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" aria-label="Close" onClick={onClose}><Close /></button>
        </header>
        <div class="sheet-body">{children}</div>
        {footer && <div class="sheet-foot">{footer}</div>}
      </section>
    </div>
  );
}
