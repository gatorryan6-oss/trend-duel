// offline.js — a plain (non-module) script every page loads, after
// startup_guard.js (Phase 4). It registers the service worker (sw.js) that
// keeps the offline copy, and fills the page's version line, if it has one:
//   "Version 4dfe84a · saved for offline"   a worker is serving this page
//   "Not saved for offline on this device"  no worker: unsupported, blocked
//                                           by policy, or a force-refresh
// If service workers are missing or registration fails, nothing else
// happens: the game runs exactly as it always has. Touches no localStorage.
(function () {
  function setLine(text) {
    var el = document.getElementById("version-line");
    if (el) el.textContent = text;
  }

  var NOT_SAVED = "Not saved for offline on this device";
  if (!("serviceWorker" in navigator)) {
    setLine(NOT_SAVED);
    return;
  }
  var sw = navigator.serviceWorker;

  // Ask the worker that controls this page which version it is serving; its
  // answer arrives as a "message" event (sw.js replies to the asking page).
  function ask() {
    if (sw.controller) sw.controller.postMessage({ type: "version" });
    else setLine(NOT_SAVED);
  }
  sw.addEventListener("message", function (event) {
    if (event.data && event.data.type === "version") {
      setLine("Version " + event.data.version + " · saved for offline");
    }
  });
  // Replies can wait in a queue until the page opts in; opt in now.
  if (sw.startMessages) sw.startMessages();
  // First visit: the worker takes charge once its copy is saved.
  sw.addEventListener("controllerchange", ask);

  sw.register("sw.js").catch(function () { setLine(NOT_SAVED); });
  document.addEventListener("DOMContentLoaded", ask);
})();
