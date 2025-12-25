(function () {
  function isExternal(a) {
    try { return a.hostname && a.hostname !== location.hostname; }
    catch { return false; }
  }

  // Outbound link logging
  document.addEventListener("click", function (e) {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || !isExternal(a)) return;
    if (window.clicky && window.clicky.log) {
      const title = (a.textContent || a.title || a.href).trim();
      window.clicky.log(a.href, title, "outbound");
    }
  }, true);
})();
