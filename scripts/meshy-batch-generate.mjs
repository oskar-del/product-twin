import fs from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.MESHY_API_KEY;
if (!API_KEY) { console.error('Set MESHY_API_KEY'); process.exit(1); }

const ROOT = path.resolve(import.meta.dirname, '..');
const picks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/geometry/meshy-test/room-picks.json'), 'utf8'));
const IMG_DIR = path.join(ROOT, 'data/geometry/meshy-test/source-images');
const OUT_DIR = path.join(ROOT, 'data/geometry/meshy-test');
const STATE_FILE = path.join(OUT_DIR, 'meshy-tasks.json');

const BASE = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const headers = { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

let state = {};
if (fs.existsSync(STATE_FILE)) state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

async function submitTask(item) {
  const imgPath = path.join(IMG_DIR, `${item.id}.jpg`);
  const b64 = fs.readFileSync(imgPath).toString('base64');
  const dataUri = `data:image/jpeg;base64,${b64}`;

  const res = await fetch(BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      image_url: dataUri,
      should_texture: true,
      enable_pbr: true,
      target_formats: ['glb'],
      auto_size: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Submit failed for ${item.id}: ${res.status} ${err}`);
  }
  const { result } = await res.json();
  console.log(`  Submitted ${item.id} (${item.name}) → task ${result}`);
  return result;
}

async function pollTask(taskId) {
  while (true) {
    const res = await fetch(`${BASE}/${taskId}`, { headers: { 'Authorization': `Bearer ${API_KEY}` } });
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
    const task = await res.json();
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED') throw new Error(`Task ${taskId} failed: ${task.task_error?.message}`);
    process.stdout.write(`  ${taskId.slice(0,8)}… ${task.progress}% ${task.status}\r`);
    await new Promise(r => setTimeout(r, 10000));
  }
}

async function downloadGlb(task, itemId) {
  const url = task.model_urls?.glb;
  if (!url) { console.error(`  No GLB URL for ${itemId}`); return; }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(OUT_DIR, `${itemId}-meshy.glb`);
  fs.writeFileSync(outPath, buf);
  console.log(`  Downloaded ${outPath} (${(buf.length / 1e6).toFixed(1)} MB)`);
}

console.log(`=== Meshy Batch: ${picks.length} items ===\n`);

// Phase 1: Submit all tasks
for (const item of picks) {
  if (state[item.id]?.taskId) {
    console.log(`  Skip ${item.id} — already submitted (${state[item.id].taskId})`);
    continue;
  }
  try {
    const taskId = await submitTask(item);
    state[item.id] = { taskId, status: 'SUBMITTED', name: item.name };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error(`  ERROR ${item.id}: ${e.message}`);
    state[item.id] = { error: e.message };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }
  // Small delay between submissions
  await new Promise(r => setTimeout(r, 2000));
}

console.log('\n=== Phase 2: Poll & Download ===\n');

for (const item of picks) {
  const s = state[item.id];
  if (!s?.taskId) continue;
  if (s.status === 'DONE') { console.log(`  Skip ${item.id} — already done`); continue; }

  try {
    console.log(`  Polling ${item.id} (${item.name})…`);
    const task = await pollTask(s.taskId);
    console.log(`  ${item.id} SUCCEEDED (${task.consumed_credits} credits)`);
    await downloadGlb(task, item.id);
    state[item.id].status = 'DONE';
    state[item.id].credits = task.consumed_credits;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error(`  ERROR polling ${item.id}: ${e.message}`);
    state[item.id].status = 'ERROR';
    state[item.id].error = e.message;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }
}

console.log('\n=== Summary ===');
let totalCredits = 0;
for (const [id, s] of Object.entries(state)) {
  const icon = s.status === 'DONE' ? '✓' : s.status === 'ERROR' ? '✗' : '…';
  console.log(`  ${icon} ${id}: ${s.name || '?'} — ${s.status} ${s.credits ? `(${s.credits} credits)` : ''}`);
  if (s.credits) totalCredits += s.credits;
}
console.log(`\nTotal credits used: ${totalCredits}`);
