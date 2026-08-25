import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const port=Number(process.env.PORT||4173);
const mime={".html":"text/html; charset=utf-8",".json":"application/json; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".geojson":"application/geo+json"};

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  let requested=url.pathname==="/"?"/prototype/svartinge-neighbourhood/index.html":decodeURIComponent(url.pathname);
  if(requested.endsWith("/"))requested+="index.html";
  const target=path.resolve(root,`.${requested}`);
  if(!target.startsWith(`${root}${path.sep}`)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
    res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});res.end("Not found");return;
  }
  res.writeHead(200,{"content-type":mime[path.extname(target).toLowerCase()]||"application/octet-stream","cache-control":"no-store"});
  fs.createReadStream(target).pipe(res);
});

server.listen(port,"127.0.0.1",()=>console.log(`Svärtinge prototype: http://127.0.0.1:${port}/prototype/svartinge-neighbourhood/`));
