// ── theme.js — early theme bootstrap (anti-FOUC) ──
// Loaded synchronously in <head> BEFORE first paint to prevent the
// "white flash → dark" flicker. Reads sd_theme from localStorage and
// applies data-theme to <html>.
(function () {
  var effective;
  try {
    var stored = localStorage.getItem('sd_theme') || 'dark';
    effective = stored;
    if (stored === 'auto') {
      effective = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-preference', stored);
  } catch (_) {
    effective = 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // ── Mobile safe-area + status bar tint ──
  // Without these, iPhone notch/home-indicator areas render in the system
  // default (white) instead of the page background, breaking dark theme.
  function applyMobileMeta(theme) {
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;

    // theme-color → tints iOS Safari status bar + Android system bar
    var color = theme === 'dark' ? '#050507' : '#f8fafc';
    var tc = head.querySelector('meta[name="theme-color"]');
    if (!tc) {
      tc = document.createElement('meta');
      tc.setAttribute('name', 'theme-color');
      head.appendChild(tc);
    }
    tc.setAttribute('content', color);

    // viewport-fit=cover → extends body bg under notch / home indicator
    var vp = head.querySelector('meta[name="viewport"]');
    if (vp) {
      var content = vp.getAttribute('content') || '';
      if (content.indexOf('viewport-fit') === -1) {
        vp.setAttribute('content', content.replace(/\s*$/, '') + (content ? ', ' : '') + 'viewport-fit=cover');
      }
    } else {
      vp = document.createElement('meta');
      vp.setAttribute('name', 'viewport');
      vp.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
      head.appendChild(vp);
    }

    // iOS standalone (Add to Home Screen) status bar style
    var ios = head.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!ios) {
      ios = document.createElement('meta');
      ios.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      head.appendChild(ios);
    }
    ios.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  }

  // Run as early as possible; if <head> children haven't parsed yet, also
  // re-run at DOMContentLoaded so we catch the viewport meta wherever it sits.
  applyMobileMeta(effective);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyMobileMeta(effective); });
  }

  // Public API to switch theme at runtime, used by /configuracion.html
  window.SDTheme = {
    get: function () { return localStorage.getItem('sd_theme') || 'dark'; },
    set: function (pref) {
      try { localStorage.setItem('sd_theme', pref); } catch (_) {}
      var eff = pref;
      if (pref === 'auto') {
        eff = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', eff);
      document.documentElement.setAttribute('data-theme-preference', pref);
      applyMobileMeta(eff);
      window.dispatchEvent(new CustomEvent('sd-theme-change', { detail: { preference: pref, effective: eff } }));
    }
  };

  // Track system theme changes when in auto mode
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if ((localStorage.getItem('sd_theme') || 'dark') === 'auto') {
        var eff = mq.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', eff);
        applyMobileMeta(eff);
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
