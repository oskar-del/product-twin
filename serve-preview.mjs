import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 3847;

const MIME = { '.html': 'text/html', '.glb': 'model/gltf-binary', '.js': 'text/javascript', '.json': 'application/json' };

const GLB_DIRS = [
  path.join(ROOT, 'data/geometry/avatars'),
  path.join(ROOT, 'data/geometry/meshy-test'),
];

http.createServer((req, res) => {
  if (req.url === '/compare') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(ROOT, 'compare-meshy.html'), 'utf8'));
    return;
  }
  if (req.url === '/' || req.url === '/gallery') {
    const picks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/geometry/meshy-test/room-picks.json'), 'utf8'));
    const items = [
      { id: '60667', name: 'Moderno soffa aveiro sand', brand: 'Eichholtz', price: 215495, cat: 'FFE.SEATING.SOFA', glb: 'moderno-soffa-meshy.glb' },
      ...picks.map(p => ({ ...p, glb: `${p.id}-meshy.glb` }))
    ];
    const html = fs.readFileSync(path.join(ROOT, 'gallery-meshy.html'), 'utf8')
      .replace('ITEMS_PLACEHOLDER', JSON.stringify(items));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  if (req.url.startsWith('/glb/')) {
    const basename = path.basename(req.url);
    for (const dir of GLB_DIRS) {
      const file = path.join(dir, basename);
      if (fs.existsSync(file)) {
        res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'public, max-age=3600' });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404); res.end('not found');
    return;
  }
  res.writeHead(404); res.end('not found');
}).listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`));
