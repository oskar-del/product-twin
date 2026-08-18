import assert from "node:assert/strict";
import {deriveLiveContextView, localHorizontalToWgs84, sweref99TmFromWgs84} from "../prototype/svartinge-neighbourhood/geographic-alignment.mjs";

const officialExample = sweref99TmFromWgs84([17.132577526, 60.666369395]);
assert.ok(Math.abs(officialExample[0] - 616536) < 0.002, "official Lantmäteriet SWEREF 99 TM easting example drifted");
assert.ok(Math.abs(officialExample[1] - 6727518) < 0.002, "official Lantmäteriet SWEREF 99 TM northing example drifted");

const origin = [16.0317063331, 58.6522414431];
const projectedOrigin = sweref99TmFromWgs84(origin);
assert.ok(projectedOrigin[0] > 559000 && projectedOrigin[0] < 560000, "plot origin left terrain tile eastern kilometre");
assert.ok(projectedOrigin[1] > 6501000 && projectedOrigin[1] < 6503000, "plot origin left terrain tile northing guard");

const unchanged = localHorizontalToWgs84({originWgs84: origin, localEastNorthM: [0, 0]});
assert.deepEqual(unchanged, origin, "zero local offset changed the geographic origin");

const view = deriveLiveContextView({originWgs84: origin, camera: [-76, 3.1, -62], target: [0, 1.4, -5], zoom: 19.2});
assert.equal(view.synchronization, "LOCAL_EAST_UP_NORTH_STAGE_REFERENCE");
assert.equal(view.evidence_effect, "NONE");
assert.ok(view.bearing > 50 && view.bearing < 55, "Street Room bearing no longer follows the Twin camera");
assert.ok(view.pitch > 80 && view.pitch <= 85, "Street Room pitch no longer follows the Twin camera");
assert.ok(view.center_wgs84[1] < origin[1], "negative local north did not move the live reference south");

for (const invalid of [[0, 0], [16, 95], ["16", 58]]) assert.throws(() => sweref99TmFromWgs84(invalid));
assert.throws(() => deriveLiveContextView({originWgs84: origin, camera: [0, 0], target: [0, 0, 0], zoom: 18}));
assert.throws(() => deriveLiveContextView({originWgs84: origin, camera: [0, 0, 0], target: [0, 0, 0], zoom: Number.NaN}));

console.log(`Svärtinge geographic alignment PASS (official SWEREF control, origin ${projectedOrigin.map(value=>value.toFixed(3)).join(", ")}, stage camera guards)`);
