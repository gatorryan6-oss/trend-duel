// startup_guard.js — a plain (non-module) script every page loads first.
//
// If one of the page's modules fails to load or link — most often because
// the browser mixed an old cached file with a new one right after an update —
// the page would otherwise stay blank with no message at all. This turns that
// silent failure into a banner that says what to do. It listens only while
// the page starts up (module scripts run before DOMContentLoaded), so a later
// error during play is never mislabelled as "could not start".
(function () {
  function onError(e) {
    if (document.getElementById("startup-error")) return;
    var what = e.message || (e.target && e.target.src ? "could not load " + e.target.src : "a script failed");
    var banner = document.createElement("div");
    banner.id = "startup-error";
    banner.className = "banner error";
    banner.textContent = "Trend Duel could not start (" + what + "). This usually means the " +
      "site was updated a moment ago. Reload the page (Ctrl+Shift+R); if it still fails, " +
      "wait a few minutes and reload again.";
    (document.querySelector("main") || document.body).prepend(banner);
  }
  // Capture phase, so a script element's own load failure (which does not
  // bubble) is caught as well as a module's link error.
  window.addEventListener("error", onError, true);
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () { window.removeEventListener("error", onError, true); }, 0);
  });
})();
