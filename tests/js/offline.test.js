// offline.js tests (Phase 4 M13). The real docs/js/offline.js runs in a Node
// sandbox (vm) inside a pretend page: a tiny document, a window, and a fake
// navigator.serviceWorker whose events the test fires by hand. That lets a
// test play out an update step by step and check the rules that matter:
// the update line appears only for a real update, and the page reloads only
// after the player's click AND the new worker taking charge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(here, "../../docs/js/offline.js"), "utf8");

// Something you can addEventListener on, and fire events at from the test.
function emitter(extra = {}) {
  const handlers = {};
  return Object.assign({
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    fire(type, event = {}) { for (const fn of handlers[type] || []) fn(event); },
  }, extra);
}

// Messages are stored as JSON text: objects made inside the sandbox have a
// different Object type, so a strict compare against the test's own objects
// would fail even when the contents match.
function fakeWorker(state = "installed") {
  return emitter({ state, sent: [], postMessage(msg) { this.sent.push(JSON.parse(JSON.stringify(msg))); } });
}

// A pretend page. `controller` is the worker serving it (null = none);
// `waiting` is a worker already installed and waiting at load.
function page({ controller = null, waiting = null, supported = true, onLine = true } = {}) {
  const elements = {};
  const versionLine = { id: "version-line", textContent: "" };
  elements["version-line"] = versionLine;
  function makeElement(tag) {
    const el = emitter({ tag, children: [], textContent: "", attrs: {}, disabled: false,
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(child) { this.children.push(child); if (child.id) elements[child.id] = child; return child; },
      click() { this.fire("click"); } });
    return el;
  }
  const body = makeElement("body");
  const document = emitter({
    body,
    getElementById: (id) => elements[id] || null,
    createElement: makeElement,
    createTextNode: (text) => ({ text }),
  });
  let reloads = 0;
  const registration = emitter({ waiting, installing: null, updates: 0,
                                 update() { this.updates++; return Promise.resolve(this); } });
  const sw = emitter({
    controller,
    register: () => Promise.resolve(registration),
    startMessages() {},
  });
  const navigator = { onLine };
  if (supported) navigator.serviceWorker = sw;
  const window = emitter({ location: { reload() { reloads++; } } });
  const timers = [];                                  // [fn, ms] from setInterval
  const setInterval = (fn, ms) => timers.push([fn, ms]);
  vm.runInContext(SOURCE, vm.createContext({ document, navigator, window, Promise, setInterval }));
  return {
    sw, registration, document, navigator, window, versionLine, timers,
    reloads: () => reloads,
    updateLine: () => elements["update-line"] || null,
    reloadButton: () => elements["update-line"].children.find(c => c.tag === "button"),
    settle: () => new Promise(r => setImmediate(r)),     // let register() resolve
  };
}

test("no service worker support: says not saved, never throws", () => {
  const p = page({ supported: false });
  assert.equal(p.versionLine.textContent, "Not saved for offline on this device");
});

test("returning visit: asks the worker, shows the version, checks for an update", async () => {
  const controller = fakeWorker("activated");
  const p = page({ controller });
  await p.settle();
  p.document.fire("DOMContentLoaded");
  assert.deepEqual(controller.sent.at(-1), { type: "version" });
  p.sw.fire("message", { data: { type: "version", version: "abc1234" } });
  assert.equal(p.versionLine.textContent, "Version abc1234 · saved for offline");
  assert.equal(p.registration.updates, 1, "registration.update() on every load");
  assert.deepEqual(p.timers.map(([, ms]) => ms), [5 * 60 * 1000], "and every 5 minutes");
  p.timers[0][0]();
  assert.equal(p.registration.updates, 2);
  p.document.visibilityState = "hidden";
  p.document.fire("visibilitychange");
  assert.equal(p.registration.updates, 2, "not while the tab is hidden");
  p.document.visibilityState = "visible";
  p.document.fire("visibilitychange");
  assert.equal(p.registration.updates, 3, "and when the tab comes back into view");
  assert.equal(p.updateLine(), null, "nothing waiting, no update line");
});

test("offline wording follows the browser's online/offline events", async () => {
  const p = page({ controller: fakeWorker("activated") });
  await p.settle();
  p.sw.fire("message", { data: { type: "version", version: "abc1234" } });
  p.navigator.onLine = false;
  p.window.fire("offline");
  assert.equal(p.versionLine.textContent, "Offline — playing saved version abc1234");
  p.navigator.onLine = true;
  p.window.fire("online");
  assert.equal(p.versionLine.textContent, "Version abc1234 · saved for offline");
});

test("first visit: the first save is not an update, and nothing reloads", async () => {
  const p = page();                                   // no controller yet
  await p.settle();
  const worker = fakeWorker("installing");
  p.registration.installing = worker;
  p.registration.fire("updatefound");
  worker.state = "installed";
  worker.fire("statechange");
  assert.equal(p.updateLine(), null, "no line on the first save");
  p.sw.controller = fakeWorker("activated");          // clients.claim() takes the page
  p.sw.fire("controllerchange");
  assert.deepEqual(p.sw.controller.sent.at(-1), { type: "version" }, "asks the new worker");
  assert.equal(p.reloads(), 0);
});

test("an update arriving mid-game shows the line; Reload switches, then reloads once", async () => {
  const p = page({ controller: fakeWorker("activated") });
  await p.settle();
  const fresh = fakeWorker("installing");
  p.registration.installing = fresh;
  p.registration.fire("updatefound");
  assert.equal(p.updateLine(), null, "not while it is still downloading");
  fresh.state = "installed";                          // every file passed its hash check
  p.registration.waiting = fresh;
  fresh.fire("statechange");
  assert.ok(p.updateLine(), "the update line appears");
  assert.equal(p.reloads(), 0, "the game carries on untouched");

  p.reloadButton().click();
  assert.deepEqual(fresh.sent, [{ type: "skip-waiting" }], "Reload asks the waiting worker to take over");
  assert.equal(p.reloads(), 0, "no reload until the new worker is in charge");
  p.sw.fire("controllerchange");
  assert.equal(p.reloads(), 1, "then exactly one reload");
});

test("a version already waiting at load is offered straight away", async () => {
  const waiting = fakeWorker("installed");
  const p = page({ controller: fakeWorker("activated"), waiting });
  await p.settle();
  assert.ok(p.updateLine());
  p.reloadButton().click();
  assert.deepEqual(waiting.sent, [{ type: "skip-waiting" }]);
});

test("Reload clicked in another tab: this page is offered the switch, never forced", async () => {
  const p = page({ controller: fakeWorker("activated") });
  await p.settle();
  p.sw.fire("controllerchange");
  assert.equal(p.reloads(), 0, "no automatic reload");
  assert.ok(p.updateLine(), "the line appears instead");
  p.reloadButton().click();
  assert.equal(p.reloads(), 1);
});
