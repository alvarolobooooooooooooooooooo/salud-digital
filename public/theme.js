// ── theme.js — early theme bootstrap (anti-FOUC) ──
// Loaded synchronously in <head> BEFORE first paint to prevent the
// "white flash → dark" flicker. Reads sd_theme from localStorage and
// applies data-theme to <html>.
(function () {
  try {
    var stored = localStorage.getItem('sd_theme') || 'light';
    var effective = stored;
    if (stored === 'auto') {
      effective = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-preference', stored);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Public API to switch theme at runtime, used by /configuracion.html
  window.SDTheme = {
    get: function () { return localStorage.getItem('sd_theme') || 'light'; },
    set: function (pref) {
      try { localStorage.setItem('sd_theme', pref); } catch (_) {}
      var effective = pref;
      if (pref === 'auto') {
        effective = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', effective);
      document.documentElement.setAttribute('data-theme-preference', pref);
      window.dispatchEvent(new CustomEvent('sd-theme-change', { detail: { preference: pref, effective: effective } }));
    }
  };

  // Track system theme changes when in auto mode
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if ((localStorage.getItem('sd_theme') || 'light') === 'auto') {
        document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
