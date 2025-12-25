// Universal Clicky loader for HU-UK — first-party, resilient outbound logging.
// Place at: /site/scripts/clicky-loader.js

(function () {
  "use strict";

  // ---- Config ----
  const SITE_ID = "101492693";
  const BEACON_PREFIX = "/f2d4c400adb21";   // must match your Worker proxy path
  const HANDOFF_MS = 120;                   // delay to let beacon fire before same-tab navigation
  // Treat these same-host paths as "outbound" (redirectors you own, e.g. /join -> affiliate)
  const INTERNAL_REDIRECT_PATHS = [/^\/join(?:\/|$)/, /^\/go(?:\/|$)/, /^\/out(?:\/|$)/];

  // ---- Heartbeat behavior ----
  // Option A: No heartbeats (online will linger a bit after visitor leaves)
  // window.clicky_custom = window.clicky_custom || {};
  // clicky_custom.ping_disable = 1;

  // Option B: Live "online" with faster drop-off (recommended for accuracy)
  window.clicky_custom = window.clicky_custom || {};
  clicky_custom.ping_disable  = 0;
  clicky_custom.ping_interval = 15; // seconds

  // Force any Clicky URL to first-party
  function rewriteToFirstParty(src) {
    if (typeof src !== "string") return src;
    src = src.replace(/^(?:https?:)?\/\/in\.getclicky\.com/, BEACON_PREFIX);
    if (/^(?:\/)?in\.php(\?|$)/.test(src)) {
      src = BEACON_PREFIX + "/" + src.replace(/^\//, "");
    }
    return src;
  }

  // Patch clicky.inject once Clicky loads (belt & braces)
  (function patchInject() {
    let patched = false;
    function tryPatch() {
      try {
        if (window.clicky && typeof window.clicky.inject === "function" && !patched) {
          const orig = window.clicky.inject;
          window.clicky.inject = function (src, type) {
            return orig.call(this, rewriteToFirstParty(src), type);
          };
          patched = true;
        }
      } catch (_) {}
    }
    tryPatch();
    const iv = setInterval(() => { patched ? clearInterval(iv) : tryPatch(); }, 100);
  })();

  // Load the first-party loader JS
  (function loadClicky() {
    const s = document.createElement("script");
    s.async = true;
    s.dataset.id = SITE_ID;
    s.src = "/a185616fac3e0.js";
    document.head.appendChild(s);
  })();

  // Queue until clicky.log exists
  const Q = [];
  function clog(url, title, type) {
    if (window.clicky && window.clicky.log) {
      try { window.clicky.log(url, title, type); } catch (_) {}
      return true;
    }
    Q.push([url, title, type]);
    return false;
  }
  const qiv = setInterval(() => {
    if (window.clicky && window.clicky.log) {
      clearInterval(qiv);
      while (Q.length) { const e = Q.shift(); try { window.clicky.log(e[0], e[1], e[2]); } catch (_) {} }
    }
  }, 100);

  // Capture gclid → custom_data
  (function gclidCapture() {
    const m = location.search.match(/[?&]gclid=([^&]+)/);
    if (m) {
      window.clicky_custom = window.clicky_custom || {};
      clicky_custom.custom_data = clicky_custom.custom_data || {};
      clicky_custom.custom_data.gclid = decodeURIComponent(m[1]);
    }
  })();

  // Outbound logging (covers external domains AND internal redirector paths)
  (function outbound() {
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
        clog(hrefForLog, title, "outbound");

        let navigated = false;
        const go = () => { if (!navigated) { navigated = true; location.href = a.href; } };
        const tid = setTimeout(go, HANDOFF_MS);
        const onHide = () => { clearTimeout(tid); go(); };
        document.addEventListener("visibilitychange", onHide, { once: true });
        return;
      }

      clog(hrefForLog, title, "outbound");
    }, true);
  })();
})();
