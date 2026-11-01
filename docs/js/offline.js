// offline.js — a plain (non-module) script every page loads, after
// startup_guard.js (Phase 4). It registers the service worker (sw.js) that
// keeps the offline copy, and fills the page's version line, if it has one:
//   "Version 4dfe84a · saved for offline"     a worker is serving this page
//   "Offline — playing saved version 4dfe84a" the same, with the network gone
//   "Not saved for offline on this device"    no worker: unsupported, blocked
//                                             by policy, or a force-refresh
// It also checks for an update on load, every 5 minutes, and when the tab
// comes back into view. When a new version has
// downloaded and passed its hash check, it waits, and this script shows one
// line: "A new version of Trend Duel is ready — Reload". Only that click
// reloads the page; nothing here ever reloads on its own.
// If service workers are missing or registration fails, nothing else
// happens: the game runs exactly as it always has. Touches no localStorage.
(function () {
  function setLine(text) {
    var el = document.getElementById("version-line");
    if (el) el.textContent = text;
  }

  var NOT_SAVED = "Not saved for offline on this device";
  var CHECK_EVERY_MS = 5 * 60 * 1000;   // update check while a page stays open
  if (!("serviceWorker" in navigator)) {
    setLine(NOT_SAVED);
    return;
  }
  var sw = navigator.serviceWorker;
  var version = null;        // the version serving this page, once the worker says
  var reloading = false;     // true only after the player clicks Reload
  // Was a worker already serving this page when it opened? Then a later
  // change of worker is an update (from another tab), not the first save.
  var hadController = !!sw.controller;

  // The version line. navigator.onLine is only a hint (a network with no
  // internet still counts as "online"), so it changes words, never behaviour.
  function render() {
    if (!version) setLine(NOT_SAVED);
    else if (navigator.onLine === false) setLine("Offline — playing saved version " + version);
    else setLine("Version " + version + " · saved for offline");
  }
  window.addEventListener("online", render);
  window.addEventListener("offline", render);

  // Ask the worker that controls this page which version it is serving; its
  // answer arrives as a "message" event (sw.js replies to the asking page).
  function ask() {
    if (sw.controller) sw.controller.postMessage({ type: "version" });
    else render();
  }
  sw.addEventListener("message", function (event) {
    if (event.data && event.data.type === "version") {
      version = event.data.version;
      render();
    }
  });
  // Replies can wait in a queue until the page opts in; opt in now.
  if (sw.startMessages) sw.startMessages();

  // The update line, shown at most once. onClick runs when Reload is pressed.
  function offerReload(onClick) {
    if (document.getElementById("update-line")) return;
    var line = document.createElement("p");
    line.id = "update-line";
    line.className = "update-line";
    line.setAttribute("role", "status");
    line.appendChild(document.createTextNode("A new version of Trend Duel is ready — "));
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Reload";
    button.addEventListener("click", function () {
      button.disabled = true;
      onClick();
    });
    line.appendChild(button);
    document.body.appendChild(line);
  }

  // A new version is installed and waiting. Reload tells it to take over;
  // the page reloads once it is in charge (the controllerchange below).
  function offerWaiting(registration) {
    offerReload(function () {
      reloading = true;
      if (registration.waiting) registration.waiting.postMessage({ type: "skip-waiting" });
    });
  }

  function watch(registration) {
    // Downloaded on an earlier visit and still waiting.
    if (registration.waiting && sw.controller) offerWaiting(registration);
    // Downloading now: offer it once it has installed (all files checked).
    // With no controller this is the very first save, not an update.
    registration.addEventListener("updatefound", function () {
      var worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", function () {
        if (worker.state === "installed" && sw.controller) offerWaiting(registration);
      });
    });
    // Check for a new version now, every few minutes while a game stays
    // open, and when the tab comes back into view. A check downloads only
    // sw.js; nothing installs unless its bytes changed.
    function check() {
      registration.update().catch(function () {});   // offline: no check, no fuss
    }
    check();
    setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") check();
    });
  }

  sw.addEventListener("controllerchange", function () {
    if (reloading) {
      // The player clicked Reload and the new version is now in charge.
      window.location.reload();
    } else if (hadController) {
      // Reload was clicked in another tab. This page keeps running the code
      // it opened with; offer the switch, never force it.
      offerReload(function () { window.location.reload(); });
    } else {
      // First visit: the worker takes charge once its copy is saved.
      hadController = true;
      ask();
    }
  });

  sw.register("sw.js").then(watch).catch(function () { render(); });
  document.addEventListener("DOMContentLoaded", ask);
})();
