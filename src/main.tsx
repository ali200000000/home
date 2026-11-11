import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const updateAppViewportHeight = () => {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
};

updateAppViewportHeight();
window.addEventListener('resize', updateAppViewportHeight);
window.visualViewport?.addEventListener('resize', updateAppViewportHeight);

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
