import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const port=Number(process.env.PORT||4173);
const mime={".html":"text/html; charset=utf-8",".json":"application/json; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".geojson":"application/geo+json"};

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/runtime/norrkoping-aerial"){
    const upstream=new URL("https://kartdata.norrkoping.se/wms?servicename=kartor&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=EPSG%3A3010&BBOX=6503500%2C122300%2C6504500%2C123300&WIDTH=1024&HEIGHT=1024&FORMAT=image%2Fpng&LAYERS=ortofoto_orter_lm");
    try{
      const response=await fetch(upstream,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`Municipal WMS returned ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      res.writeHead(200,{"content-type":response.headers.get("content-type")||"image/png","cache-control":"no-store","x-evidence-effect":"NONE","x-pixel-persistence":"MEMORY_ONLY"});res.end(bytes);
    }catch(error){console.error(`Live municipal aerial unavailable: ${error.message}`);res.writeHead(502,{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"});res.end(`Live municipal aerial unavailable: ${error.message}`);}
    return;
  }
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
