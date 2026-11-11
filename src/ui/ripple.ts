// Material ripple from the touch point on any element with class "rp".
// One delegated listener for the whole app; the pressed state layer is plain CSS (.rp:active::after).

export function installRipple(root: Document = document) {
  root.addEventListener('pointerdown', e => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('.rp');
    if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const d = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
    const s = document.createElement('span');
    s.className = 'ripple';
    Object.assign(s.style, { width: `${d}px`, height: `${d}px`, left: `${x - d / 2}px`, top: `${y - d / 2}px` });
    el.appendChild(s);

    // Fade once the finger lifts and the grow animation has finished, whichever is later.
    let grown = false, released = false;
    const fade = () => { if (!grown || !released) return; s.classList.add('ripple-out'); setTimeout(() => s.remove(), 300); };
    s.addEventListener('animationend', () => { grown = true; fade(); }, { once: true });
    const up = () => { released = true; fade(); root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up); };
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
  }, { passive: true });
}
