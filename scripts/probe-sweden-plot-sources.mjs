import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "data/sites/sweden/source-registry-v0.1.json"), "utf8"));
const writeReceipt = process.argv.slice(2).includes("--write");
const unknown = process.argv.slice(2).filter((arg) => arg !== "--write");
if (unknown.length) {
  console.error(`Unknown argument: ${unknown.join(" ")}`);
  process.exit(2);
}

async function probe(source) {
  const started = Date.now();
  try {
    const response = await fetch(source.probe_url, {
      headers: {"user-agent": "Product-Twin-Sweden-Source-Probe/0.1"},
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    await response.body?.cancel();
    return {
      source_id: source.source_id,
      requested_url: source.probe_url,
      final_url: response.url,
      status: response.status,
      ok: response.ok,
      content_type: response.headers.get("content-type"),
      elapsed_ms: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return {
      source_id: source.source_id,
      requested_url: source.probe_url,
      final_url: null,
      status: null,
      ok: false,
      content_type: null,
      elapsed_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const probeable = registry.sources.filter((source) => source.probe_url !== null);
const checkedAt = new Date().toISOString();
const results = await Promise.all(probeable.map(probe));
const receipt = {
  schema_version: "0.1",
  entity_type: "SwedenSourceAvailabilityReceipt",
  registry_id: registry.registry_id,
  checked_at: checkedAt,
  purpose: "Landing/service availability only; no plot lookup, external case or evidence promotion.",
  result_count: results.length,
  ok_count: results.filter((result) => result.ok).length,
  results,
};

for (const result of results) {
  const state = result.ok ? "OK" : "FAIL";
  console.log(`${state.padEnd(4)} ${String(result.status ?? "-").padStart(3)} ${result.source_id} ${result.elapsed_ms}ms`);
}
console.log(`Checked ${receipt.result_count} public sources: ${receipt.ok_count} available, ${receipt.result_count - receipt.ok_count} unavailable.`);

if (writeReceipt) {
  const runtimeDir = path.join(ROOT, ".runtime/sites/sweden");
  fs.mkdirSync(runtimeDir, {recursive: true});
  const timestamp = checkedAt.replaceAll(":", "-");
  const output = path.join(runtimeDir, `source-availability-${timestamp}.json`);
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(path.relative(ROOT, output));
}

if (receipt.ok_count !== receipt.result_count) process.exitCode = 1;
