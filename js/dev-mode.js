
(() => {
  'use strict';

  const STORAGE_KEY = 'sing-for-joy-dev-mode';
  const button = document.getElementById('devButton');

  function readPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  function isEnabled() {
    return document.body.classList.contains('dev-mode');
  }

  function setEnabled(enabled) {
    document.body.classList.toggle('dev-mode', enabled);

    button.setAttribute('aria-pressed', String(enabled));

    button.title = enabled
      ? 'Disable developer mode'
      : 'Enable developer mode';

    button.setAttribute(
      'aria-label',
      button.title
    );

    try {
      localStorage.setItem(
        STORAGE_KEY,
        String(enabled)
      );
    } catch {
      // Browsers may restrict localStorage.
      // The toggle still works for this session.
    }

    document.dispatchEvent(
      new CustomEvent('devmodechange', {
        detail: { enabled }
      })
    );
  }

  button.addEventListener('click', () => {
    setEnabled(!isEnabled());
  });

  // Apply saved preference immediately.
  setEnabled(readPreference());

  // Expose controls to other application scripts.
  window.DevMode = {
    isEnabled,
    setEnabled
  };
})();
