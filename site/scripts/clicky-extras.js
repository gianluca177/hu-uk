// clicky-extras.js — first-party beacons + reliable outbound (incl. internal redirectors)
(function () {
  "use strict";

  // --- CONFIG ---
  const BEACON_PREFIX = "/f2d4c400adb21";     // your Worker prefix
  const INTERNAL_REDIRECT_PATHS = [/^\/join(?:\/|$)/, /^\/go(?:\/|$)/, /^\/out(?:\/|$)/]; // treat these as outbound
  const HANDOFF_MS = 120; // delay before navigating so beacon can fire
  // --------------

  // A) Force any Clicky asset/beacon URLs to first-party
  (function forceFirstPartyBeacons() {
    let patched = false;
    function rewrite(src) {
      if (typeof src !== "string") return src;
      src = src.replace(/^(?:https?:)?\/\/in\.getclicky\.com/, BEACON_PREFIX);
      if (/^(?:\/)?in\.php(\?|$)/.test(src)) src = BEACON_PREFIX + "/" + src.replace(/^\//, "");
      return src;
    }
    function tryPatch() {
      try {
        if (window.clicky && typeof window.clicky.inject === "function" && !patched) {
          const orig = window.clicky.inject;
          window.clicky.inject = function (src, type) { return orig.call(this, rewrite(src), type); };
          patched = true;
        }
      } catch (_) {}
    }
    tryPatch();
    const iv = setInterval(() => { patched ? clearInterval(iv) : tryPatch(); }, 100);
  })();

  // B) Tiny queue until Clicky exists
  const Q = [];
  function log(url, title, type) {
    if (window.clicky && window.clicky.log) {
      try { window.clicky.log(url, title, type); } catch (_) {}
      return true;
    }
    Q.push([url, title, type]);
    return false;
  }
  const iv = setInterval(() => {
    if (window.clicky && window.clicky.log) {
      clearInterval(iv);
      while (Q.length) { const e = Q.shift(); try { window.clicky.log(e[0], e[1], e[2]); } catch (_) {} }
    }
  }, 100);

  // C) Capture gclid → custom_data
  (function gclidCapture() {
    const m = location.search.match(/[?&]gclid=([^&]+)/);
    if (m) {
      window.clicky_custom = window.clicky_custom || {};
      clicky_custom.custom_data = clicky_custom.custom_data || {};
      clicky_custom.custom_data.gclid = decodeURIComponent(m[1]);
    }
  })();

  // D) Outbound logging
  function isExternal(a) {
    try { return a.hostname && a.hostname !== location.hostname; } catch { return false; }
  }
  function isInternalRedirect(a) {
    try { return INTERNAL_REDIRECT_PATHS.some(rx => rx.test(a.pathname || "")); } catch { return false; }
  }
  function sameTab(a, ev) {
    if (a.target && a.target.toLowerCase() === "_blank") return false;
    if (ev && (ev.ctrlKey || ev.shiftKey || ev.metaKey || ev.button === 1)) return false;
    return true;
  }
  function clean(url) {
    return url
      .replace(/(\?|&)_gl=[^&]*/g, "")
      .replace(/(\?|&)(subid|sub_id)=[^&]*/g, "")
      .replace(/[?&]$/, "");
  }

  document.addEventListener("click", function (ev) {
    const a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a) return;

    const treatAsOutbound = isExternal(a) || isInternalRedirect(a);
    if (!treatAsOutbound) return;

    const title = (a.textContent || a.title || a.href).trim() || "Outbound Link";
    const hrefForLog = clean(a.href);

    if (sameTab(a, ev)) {
      ev.preventDefault();
      log(hrefForLog, title, "outbound");

      let navigated = false;
      const go = () => { if (!navigated) { navigated = true; location.href = a.href; } };
      const tid = setTimeout(go, HANDOFF_MS);
      const onHide = () => { clearTimeout(tid); go(); };
      document.addEventListener("visibilitychange", onHide, { once: true });
      return;
    }

    // new-tab clicks
    log(hrefForLog, title, "outbound");
  }, true);
})();
