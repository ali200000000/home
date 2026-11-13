import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  });
}

// VORÜBERGEHEND: Messwerte für die iPhone-Web-App. Dreimal schnell auf die Überschrift tippen.
// Wieder entfernen, sobald die untere Leiste geklärt ist.
let titleTaps: number[] = [];
document.addEventListener('click', event => {
  if (!(event.target as HTMLElement).closest('#title')) return;
  const now = Date.now();
  titleTaps = [...titleTaps.filter(time => now - time < 800), now];
  if (titleTaps.length < 3) return;
  titleTaps = [];
  const existing = document.getElementById('mealy-diagnose');
  if (existing) { existing.remove(); return; }
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const insets = getComputedStyle(probe);
  const rect = (selector: string) => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box ? `${Math.round(box.top)}–${Math.round(box.bottom)}` : '–'; };
  const values = [
    ['Modus', matchMedia('(display-mode: standalone)').matches ? 'Web-App' : 'Browser', (navigator as Navigator & { standalone?: boolean }).standalone ? '(iOS standalone)' : ''],
    ['Bildschirm', `${screen.width}×${screen.height}`],
    ['Fenster', `${innerWidth}×${innerHeight}`],
    ['Sichtbar', `${Math.round(visualViewport?.width ?? 0)}×${Math.round(visualViewport?.height ?? 0)}`],
    ['html', `${document.documentElement.clientHeight}`],
    ['Ränder o/u', `${insets.paddingTop} / ${insets.paddingBottom}`],
    ['shell', rect('.shell')],
    ['Dock', rect('.mobile-nav')],
  ];
  probe.remove();
  const panel = document.createElement('pre');
  panel.id = 'mealy-diagnose';
  panel.style.cssText = 'position:fixed;z-index:9999;left:12px;right:12px;top:40%;margin:0;padding:14px;border-radius:14px;background:#111;color:#fff;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap';
  panel.textContent = values.map(row => row.join(' ')).join('\n');
  panel.addEventListener('click', () => panel.remove());
  document.body.appendChild(panel);
});
