// Service worker tests (Phase 4 M12). The real docs/sw.js runs in a Node
// sandbox (vm) with a pretend browser around it: a fake cache store, and a
// fake network that serves the files from disk. That checks the parts that
// matter most: the JavaScript hash agrees with tools/build_sw.py on every
// file, and an install is all-or-nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const DOCS = join(here, "../../docs");
const SOURCE = readFileSync(join(DOCS, "sw.js"), "utf8");
const ORIGIN = "http://localhost:5093";

// A pretend browser: fake caches, a fake network, the real crypto.
function sandbox({ network } = {}) {
  const stores = new Map();                  // cache name -> Map(url -> Response)
  const handlers = {};
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async put(url, response) { store.set(String(url), response); },
        async match(url) { return store.get(String(url)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const requests = [];
  class FakeRequest { constructor(url, init = {}) { this.url = url; this.cache = init.cache; } }
  async function fetch(request) {
    const url = typeof request === "string" ? request : request.url;
    requests.push(request);
    const path = url.slice((ORIGIN + "/").length);
    const custom = network && network(path);
    if (custom) return custom;
    try {
      return new Response(readFileSync(join(DOCS, path)), { status: 200 });
    } catch {
      return new Response("missing", { status: 404 });
    }
  }
  const self = {
    location: new URL(ORIGIN + "/sw.js"),
    addEventListener(type, fn) { handlers[type] = fn; },
    clients: { async claim() {} },
  };
  const context = vm.createContext({ self, caches, fetch, crypto: globalThis.crypto,
                                      Request: FakeRequest, Response, URL, Uint8Array });
  vm.runInContext(SOURCE + "\n;globalThis.__sw = { VERSION, FILES, CACHE };", context);
  return { context, stores, handlers, requests, sw: context.__sw };
}

test("the worker's hash matches build_sw.py on every listed file, and ignores CRLF", async () => {
  const { context, sw } = sandbox();
  const paths = Object.keys(sw.FILES);
  assert.ok(paths.length >= 20, "sw.js lists the site's files");
  for (const path of paths) {
    const bytes = readFileSync(join(DOCS, path));
    assert.equal(await context.contentHash(bytes), sw.FILES[path], `${path} hash`);
  }
  const lf = Buffer.from("a\nb\n"), crlf = Buffer.from("a\r\nb\r\n");
  assert.equal(await context.contentHash(lf), await context.contentHash(crlf));
});

test("a clean install stores every file, fetched straight from the server", async () => {
  const { context, stores, requests, sw } = sandbox();
  await context.precache();
  const store = stores.get(sw.CACHE);
  assert.equal(store.size, Object.keys(sw.FILES).length);
  assert.ok(requests.every(r => r.cache === "reload"), "never from the browser's own cache");
});

test("one stale file throws the whole install away", async () => {
  const { context, stores } = sandbox({
    network: (path) => path === "data/exceptions.json" ? new Response("[]", { status: 200 }) : null,
  });
  await assert.rejects(context.precache(), /does not match version/);
  assert.equal(stores.size, 0, "nothing stored: the old version keeps serving");
});

test("one missing file throws the whole install away", async () => {
  const { context, stores } = sandbox({
    network: (path) => path === "js/ui.js" ? new Response("gone", { status: 404 }) : null,
  });
  await assert.rejects(context.precache(), /HTTP 404/);
  assert.equal(stores.size, 0);
});

test("the folder answers with index.html; activate deletes only older trend-duel copies", async () => {
  const { context, stores, handlers, sw } = sandbox();
  await context.precache();
  const index = await context.fromCache({ url: ORIGIN + "/" });
  assert.equal(await index.text(), readFileSync(join(DOCS, "index.html"), "utf8"));
  stores.set("trend-duel-oldver1", new Map());
  stores.set("someone-else", new Map());
  let done;
  handlers.activate({ waitUntil(p) { done = p; } });
  await done;
  assert.deepEqual([...stores.keys()].sort(), [sw.CACHE, "someone-else"].sort());
});
