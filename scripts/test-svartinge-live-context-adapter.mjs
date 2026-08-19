import assert from "node:assert/strict";
import fs from "node:fs";
import {createMapboxRuntimeAdapter, liveContextContract} from "../prototype/svartinge-neighbourhood/live-context-adapter.mjs";

const source = fs.readFileSync("prototype/svartinge-neighbourhood/live-context-adapter.mjs", "utf8");
for (const forbidden of ["localStorage", "sessionStorage", "document.cookie", "URLSearchParams", "preserveDrawingBuffer: true"])
  assert.equal(source.includes(forbidden), false, `runtime adapter must not use ${forbidden}`);

assert.equal(liveContextContract.activation, "EXPLICIT_RUNTIME_CONFIG_ONLY");
assert.equal(liveContextContract.credential_persistence, false);
assert.equal(liveContextContract.tile_persistence, false);
assert.equal(liveContextContract.runtime_token_cleared_on_destroy, true);
assert.equal(liveContextContract.evidence_promotion_allowed, false);

const calls = [];
class FakeMap {
  constructor(options) {
    calls.push(["construct", options]);
    this.handlers = new Map();
    this.sources = new Map();
  }
  on(name, handler) { this.handlers.set(name, handler); }
  getSource(name) { return this.sources.get(name); }
  addSource(name, source) { this.sources.set(name, source); calls.push(["source", name, source]); }
  setTerrain(terrain) { calls.push(["terrain", terrain]); }
  jumpTo(camera) { calls.push(["camera", camera]); }
  remove() { calls.push(["remove"]); }
}
const runtime = {Map: FakeMap, accessToken: null};
const states = [];
const adapter = createMapboxRuntimeAdapter({
  mapboxgl: runtime,
  publicToken: "runtime-public-token",
  container: {nodeType: 1},
  originWgs84: [16.0317063331, 58.6522414431],
  onState: state => states.push(state.phase)
});

assert.equal(JSON.stringify(adapter).includes("runtime-public-token"), false, "adapter descriptor leaked the runtime token");
const map = adapter.mount();
assert.equal(runtime.accessToken, "runtime-public-token");
assert.equal(adapter.phase, "LOADING");
map.handlers.get("load")();
assert.equal(adapter.phase, "CONNECTED");
assert.deepEqual(calls.find(call => call[0] === "terrain")?.[1], {source: "mapbox-dem", exaggeration: 1});
adapter.syncStage({
  id: "STREET_ROOM",
  live_context_view: {
    center_wgs84: [16.0317063331, 58.6522414431],
    zoom: 18,
    pitch: 64,
    bearing: 22,
    synchronization: "LOCAL_EAST_UP_NORTH_STAGE_REFERENCE",
    evidence_effect: "NONE"
  }
});
assert.deepEqual(calls.find(call => call[0] === "camera")?.[1].center, [16.0317063331, 58.6522414431]);
adapter.destroy();
assert.equal(adapter.phase, "DESTROYED");
assert.equal(runtime.accessToken, "", "runtime token was not forgotten on destroy");
assert.deepEqual(states, ["LOADING", "CONNECTED", "DESTROYED"]);

for (const mutate of [
  () => createMapboxRuntimeAdapter({mapboxgl: runtime, publicToken: "", container: {}, originWgs84: [16, 58]}),
  () => createMapboxRuntimeAdapter({mapboxgl: runtime, publicToken: "runtime-public-token", container: {}, originWgs84: [181, 58]}),
  () => createMapboxRuntimeAdapter({mapboxgl: {}, publicToken: "runtime-public-token", container: {}, originWgs84: [16, 58]}),
  () => adapter.syncStage({live_context_view: {evidence_effect: "RECORDED"}})
]) assert.throws(mutate);

console.log("Svärtinge live-context adapter PASS (runtime-only token, live-only tiles, attribution retained, evidence promotion blocked)");
