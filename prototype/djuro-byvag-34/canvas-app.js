(function(){
"use strict";
var COLORS={AUTHORITATIVE:'#176b52',INDICATIVE:'#c18a2d',DERIVED:'#497aa2',REPORTED_UNVERIFIED:'#a65b68',CONCEPT:'#735a9e'};
var data=window.__SCENE__, geomSources=window.__GEOM__;
var byId={}; data.elements.forEach(function(e){byId[e.id]=e;});

var canvas=document.createElement('canvas');
canvas.style.cssText='position:fixed;inset:0;display:block;touch-action:none;cursor:grab';
document.body.prepend(canvas);
var ctx=canvas.getContext('2d');
var W,H,DPR;
function resize(){
  DPR=Math.min(devicePixelRatio||1,2);
  W=innerWidth;H=innerHeight;
  canvas.width=W*DPR;canvas.height=H*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize',resize);resize();

var yaw=-0.55,pitch=0.6,dist=230,target={x:0,y:2,z:0};
var tween=null;

function project(p,cam){
  var y=cam===undefined?{yaw:yaw,pitch:pitch,dist:dist,target:target}:cam;
  var x=p[0]-y.target.x,yy=p[1]-y.target.y,z=p[2]-y.target.z;
  var cx=x*Math.cos(y.yaw)-z*Math.sin(y.yaw);
  var cz=x*Math.sin(y.yaw)+z*Math.cos(y.yaw);
  var cy=yy*Math.cos(y.pitch)-cz*Math.sin(y.pitch);
  var cz2=yy*Math.sin(y.pitch)+cz*Math.cos(y.pitch);
  cz2+=y.dist;
  var bad=cz2<=20||Math.abs(cx/cz2)>1.6||Math.abs(cy/cz2)>1.6; // outside a sane view cone (avoids the fake-perspective blow-up at wide angles)
  if(cz2<20)cz2=20;
  var f=520/cz2;
  return {sx:W/2+cx*f,sy:H/2-cy*f,depth:cz2,bad:bad};
}

var terrainEl=byId['TERRAIN_CONTEXT'];
var HF=terrainEl.geometry;
function vidx(ix,iz){return iz*(HF.segments+1)+ix;}
function groundY(x,z){
  var n=HF.segments,step=HF.size_m/n,half=HF.size_m/2;
  var fx=Math.min(n,Math.max(0,(x+half)/step)),fz=Math.min(n,Math.max(0,(z+half)/step));
  var ix=Math.min(n-1,Math.floor(fx)),iz=Math.min(n-1,Math.floor(fz)),tx=fx-ix,tz=fz-iz;
  function at(cx,cz){return HF.vertices[vidx(cx,cz)][1];}
  return (at(ix,iz)*(1-tx)+at(ix+1,iz)*tx)*(1-tz)+(at(ix,iz+1)*(1-tx)+at(ix+1,iz+1)*tx)*tz;
}

var seaEl=byId['VIEW_SEA'];
var seaLo=seaEl.geometry.azimuth_deg-seaEl.geometry.spread_deg/2;
var seaHi=seaEl.geometry.azimuth_deg+seaEl.geometry.spread_deg/2;
function isSeaAz(az){
  var lo=((seaLo%360)+360)%360,hi=((seaHi%360)+360)%360;
  az=((az%360)+360)%360;
  return lo<=hi?(az>=lo&&az<=hi):(az>=lo||az<=hi);
}

function seededRandom(seed){var x=seed|0;return function(){x=(x*1664525+1013904223)|0;return((x>>>0)/4294967296);};}
function pointInPolygon(x,z,points){
  var inside=false,n=points.length;
  for(var i=0,j=n-1;i<n;j=i++){
    var xi=points[i][0],zi=points[i][1],xj=points[j][0],zj=points[j][1];
    if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))inside=!inside;
  }
  return inside;
}

var plotEl=byId['PLOT_4_147'];
var plotPoints=plotEl.geometry.points_xz;

// ---- decorative REALISTIC-mode scatter (trees/rocks), seeded, computed once ----
var trees=[],rocks=[],shrubs=[];
(function(){
  var rnd=seededRandom(5428);
  for(var i=0;i<130;i++){
    var x=-190+rnd()*380,z=-190+rnd()*380;
    if(Math.abs(x)<62&&Math.abs(z)<55)continue;
    var azHere=(Math.atan2(x,z)*180/Math.PI+360)%360;
    if(isSeaAz(azHere)&&Math.hypot(x,z)>70)continue;
    trees.push({x:x,z:z,scale:.5+rnd()*1.1,birch:rnd()<.54,rot:rnd()*Math.PI});
  }
  var rnd2=seededRandom(147034);
  for(var placed=0,i2=0;i2<260&&placed<40;i2++){
    var x2=-80+rnd2()*120,z2=-60+rnd2()*105;
    if(!pointInPolygon(x2,z2,plotPoints))continue;
    rocks.push({x:x2,z:z2,scale:.12+rnd2()*.4,dark:rnd2()<.4});
    placed++;
  }
  for(var placed2=0,i3=0;i3<160&&placed2<20;i3++){
    var x3=-80+rnd2()*120,z3=-60+rnd2()*105;
    if(!pointInPolygon(x3,z3,plotPoints))continue;
    shrubs.push({x:x3,z:z3,scale:.25+rnd2()*.4});
    placed2++;
  }
})();

var mode='INTELLIGENCE',showTerrain=true,showLabels=true;
var clickables=[]; // rebuilt each frame: {id, screenPoly:[[x,y]...], depth}

function terrainQuads(camL){
  var seg=HF.segments,quads=[];
  var ys=HF.vertices.map(function(v){return v[1];});
  var yMin=Math.min.apply(null,ys),yMax=Math.max.apply(null,ys);
  for(var iz=0;iz<seg;iz++){
    for(var ix=0;ix<seg;ix++){
      var a=HF.vertices[vidx(ix,iz)],b=HF.vertices[vidx(ix+1,iz)],c=HF.vertices[vidx(ix+1,iz+1)],d=HF.vertices[vidx(ix,iz+1)];
      var cx=(a[0]+b[0]+c[0]+d[0])/4,cy=(a[1]+b[1]+c[1]+d[1])/4,cz=(a[2]+b[2]+c[2]+d[2])/4;
      var az=(Math.atan2(cx,cz)*180/Math.PI+360)%360;
      var wet=isSeaAz(az)&&cy<-6.2&&Math.hypot(cx,cz)>18;
      var t=(cy-yMin)/((yMax-yMin)||1);
      var light=0.55+0.4*Math.max(0,Math.cos(pitch-0.5));
      var pa=project(a,camL),pb=project(b,camL),pc=project(c,camL),pd=project(d,camL);
      if(pa.bad||pb.bad||pc.bad||pd.bad)continue; // near-plane cull: avoids exploding quads
      var depth=(pa.depth+pb.depth+pc.depth+pd.depth)/4;
      quads.push({pts:[pa,pb,pc,pd],depth:depth,t:t,wet:wet,light:light});
    }
  }
  return quads;
}

function terrainColor(t,light,wet,realistic){
  var r,g,b;
  if(wet){r=48;g=94;b=118;}
  else if(realistic){r=92+30*t;g=118+34*(1-Math.abs(t-.5));b=70+14*t;}
  else{r=140+20*t;g=150+18*(1-Math.abs(t-.5));b=124+10*t;}
  r*=light;g*=light;b*=light;
  return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')';
}

function drawTerrain(camL,realistic){
  if(!showTerrain)return;
  var quads=terrainQuads(camL);
  quads.sort(function(a,b){return b.depth-a.depth;});
  for(var i=0;i<quads.length;i++){
    var q=quads[i];
    ctx.beginPath();
    ctx.moveTo(q.pts[0].sx,q.pts[0].sy);
    for(var k=1;k<4;k++)ctx.lineTo(q.pts[k].sx,q.pts[k].sy);
    ctx.closePath();
    ctx.fillStyle=terrainColor(q.t,q.light,q.wet,realistic);
    ctx.fill();
  }
}

function drawSeaSector(camL){
  var R=320,segs=48,seaY=-6.5;
  var pts=[[0,seaY,0]];
  for(var i=0;i<=segs;i++){
    var az=(seaLo+(seaHi-seaLo)*i/segs)*Math.PI/180;
    pts.push([Math.sin(az)*R,seaY,Math.cos(az)*R]);
  }
  var proj=pts.map(function(p){return project(p,camL);});
  if(!proj.some(function(pp){return pp.bad;})){
    ctx.beginPath();
    ctx.moveTo(proj[0].sx,proj[0].sy);
    for(var k=1;k<proj.length;k++)ctx.lineTo(proj[k].sx,proj[k].sy);
    ctx.closePath();
    ctx.save();ctx.globalAlpha=.82;ctx.fillStyle='#3f7fa0';ctx.fill();ctx.restore();
  }
  return {id:'VIEW_SEA',screenPoly:proj.map(function(p){return [p.sx,p.sy];}),depth:proj.reduce(function(s,p){return s+p.depth;},0)/proj.length};
}

function localBoundaryScreen(camL,yOffset){
  return plotPoints.map(function(p){return project([p[0],groundY(p[0],p[1])+(yOffset||0.6),p[1]],camL);});
}

function drawBoundary(camL){
  var proj=localBoundaryScreen(camL,0.6);
  ctx.beginPath();
  ctx.moveTo(proj[0].sx,proj[0].sy);
  for(var i=1;i<proj.length;i++)ctx.lineTo(proj[i].sx,proj[i].sy);
  ctx.closePath();
  ctx.strokeStyle='#c68f4a';ctx.lineWidth=2.4;ctx.stroke();
  var depth=proj.reduce(function(s,p){return s+p.depth;},0)/proj.length;
  return {id:'PLOT_4_147',screenPoly:proj.map(function(p){return [p.sx,p.sy];}),depth:depth-2000};
}

function extrudedBuildingItems(item,camL,realistic){
  var pts=item.geometry.points_xz,h=item.geometry.height;
  var cx=pts.reduce(function(s,p){return s+p[0];},0)/pts.length;
  var cz=pts.reduce(function(s,p){return s+p[1];},0)/pts.length;
  var baseY=groundY(cx,cz)+(item.geometry.base_y||0);
  var isMain=item.type==='SITE_BUILDING_MAIN';
  var wallColor,roofColor;
  if(realistic){wallColor=isMain?'#3c5b45':'#cfc6ad';roofColor=isMain?'#28402f':'#8f8877';}
  else{var ec=item.evidence_class;wallColor=COLORS[ec];roofColor=COLORS[ec];}
  var items=[];
  var bot=pts.map(function(p){return [p[0],baseY,p[1]];});
  var top=pts.map(function(p){return [p[0],baseY+h,p[1]];});
  for(var i=0;i<bot.length-1;i++){
    var quad=[bot[i],bot[i+1],top[i+1],top[i]].map(function(p){return project(p,camL);});
    if(quad.some(function(pp){return pp.bad;}))continue;
    var depth=(quad[0].depth+quad[1].depth+quad[2].depth+quad[3].depth)/4;
    items.push({poly:quad,depth:depth,color:wallColor});
  }
  var roofProj=top.map(function(p){return project(p,camL);});
  var roofDepth=roofProj.reduce(function(s,p){return s+p.depth;},0)/roofProj.length;
  if(!roofProj.some(function(pp){return pp.bad;}))items.push({poly:roofProj,depth:roofDepth-0.01,color:roofColor});
  return {drawItems:items,clickable:{id:item.id,screenPoly:roofProj.map(function(p){return [p.sx,p.sy];}),depth:roofDepth-2000}};
}

function boxBuildingItems(item,camL,realistic){
  var g=item.geometry,x=g.position[0],y0=groundY(x,g.position[2]),z=g.position[2];
  var w=g.size[0],h=g.size[1],d=g.size[2];
  var corners=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2]];
  var bot=corners.map(function(c){return [x+c[0],y0,z+c[2]];});
  var top=corners.map(function(c){return [x+c[0],y0+h,z+c[2]];});
  var wallColor=realistic?'#ddd4c5':COLORS[item.evidence_class];
  var roofColor=realistic?'#6d5a46':COLORS[item.evidence_class];
  var items=[];
  for(var i=0;i<4;i++){
    var j=(i+1)%4;
    var quad=[bot[i],bot[j],top[j],top[i]].map(function(p){return project(p,camL);});
    var depth=(quad[0].depth+quad[1].depth+quad[2].depth+quad[3].depth)/4;
    items.push({poly:quad,depth:depth,color:wallColor});
  }
  var roofProj=top.map(function(p){return project(p,camL);});
  var roofDepth=roofProj.reduce(function(s,p){return s+p.depth;},0)/roofProj.length;
  if(!roofProj.some(function(pp){return pp.bad;}))items.push({poly:roofProj,depth:roofDepth-0.01,color:roofColor});
  return {drawItems:items,clickable:{id:item.id,screenPoly:roofProj.map(function(p){return [p.sx,p.sy];}),depth:roofDepth-2000}};
}

function drawBuildingsAndDecor(camL,realistic){
  var allItems=[],clickList=[];
  data.elements.forEach(function(item){
    if(item.geometry.primitive==='EXTRUDED_POLYGON'&&item.id!=='PLOT_4_147'){
      var r=extrudedBuildingItems(item,camL,realistic);
      allItems=allItems.concat(r.drawItems);clickList.push(r.clickable);
    } else if(item.geometry.primitive==='BOX'&&item.type==='CONTEXT_BUILDING'){
      var r2=boxBuildingItems(item,camL,realistic);
      allItems=allItems.concat(r2.drawItems);clickList.push(r2.clickable);
    }
  });
  if(realistic){
    trees.forEach(function(t){
      var base=project([t.x,groundY(t.x,t.z),t.z],camL);
      var h=6*t.scale;
      var top=project([t.x,groundY(t.x,t.z)+h,t.z],camL);
      var crownR=(top.f?top.f:14)*0.9*t.scale;
      allItems.push({drawTree:true,base:base,top:top,scale:t.scale,birch:t.birch,depth:(base.depth+top.depth)/2});
    });
    rocks.forEach(function(r){
      var p=project([r.x,groundY(r.x,r.z)+.2,r.z],camL);
      allItems.push({drawRock:true,p:p,scale:r.scale,dark:r.dark,depth:p.depth});
    });
    shrubs.forEach(function(s){
      var p=project([s.x,groundY(s.x,s.z)+.3,s.z],camL);
      allItems.push({drawShrub:true,p:p,scale:s.scale,depth:p.depth});
    });
  }
  allItems.sort(function(a,b){return b.depth-a.depth;});
  allItems.forEach(function(it){
    if(it.drawTree){
      var s=it.scale*10;
      ctx.strokeStyle=it.birch?'#d8d5c7':'#694b35';ctx.lineWidth=Math.max(1,2*it.scale);
      ctx.beginPath();ctx.moveTo(it.base.sx,it.base.sy);ctx.lineTo(it.top.sx,it.top.sy);ctx.stroke();
      ctx.fillStyle=it.birch?'#7ea364':'#3f6144';
      ctx.beginPath();ctx.arc(it.top.sx,it.top.sy,Math.max(3,9*it.scale),0,7);ctx.fill();
    } else if(it.drawRock){
      ctx.fillStyle=it.dark?'#5c584d':'#87857a';
      ctx.beginPath();ctx.arc(it.p.sx,it.p.sy,Math.max(1.5,6*it.scale),0,7);ctx.fill();
    } else if(it.drawShrub){
      ctx.fillStyle='#5f7a4c';
      ctx.beginPath();ctx.arc(it.p.sx,it.p.sy,Math.max(2,7*it.scale),0,7);ctx.fill();
    } else {
      ctx.beginPath();ctx.moveTo(it.poly[0].sx,it.poly[0].sy);
      for(var k=1;k<it.poly.length;k++)ctx.lineTo(it.poly[k].sx,it.poly[k].sy);
      ctx.closePath();ctx.fillStyle=it.color;ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=.6;ctx.stroke();
    }
  });
  return clickList;
}

function drawLabel(text,x,y){
  ctx.font='600 11px Inter, sans-serif';
  var w=ctx.measureText(text).width+14;
  ctx.fillStyle='rgba(247,244,236,.94)';
  ctx.beginPath();ctx.roundRect(x-w/2,y-11,w,20,10);ctx.fill();
  ctx.fillStyle='#14231d';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(text,x,y-1);
}

function render(camL,offsetX,widthX,realistic){
  ctx.save();
  ctx.beginPath();ctx.rect(offsetX,0,widthX,H);ctx.clip();
  ctx.fillStyle=realistic?'#9fc1cf':'#d9e0db';
  ctx.fillRect(offsetX,0,widthX,H);
  drawTerrain(camL,realistic);
  var seaClick=drawSeaSector(camL);
  var boundaryClick=drawBoundary(camL);
  var buildingClicks=drawBuildingsAndDecor(camL,realistic);
  if(showLabels&&!realistic){
    data.elements.forEach(function(item){
      if(item.geometry.primitive!=='EXTRUDED_POLYGON'||item.id==='PLOT_4_147')return;
      var pts=item.geometry.points_xz;
      var cx=pts.reduce(function(s,p){return s+p[0];},0)/pts.length;
      var cz=pts.reduce(function(s,p){return s+p[1];},0)/pts.length;
      var top=project([cx,groundY(cx,cz)+item.geometry.height+1.6,cz],camL);
      if(top.depth>1&&top.sx>offsetX&&top.sx<offsetX+widthX)drawLabel(item.label,top.sx,top.sy);
    });
  }
  ctx.restore();
  return [seaClick,boundaryClick].concat(buildingClicks);
}

function frame(){
  if(tween){
    var t=Math.min(1,(performance.now()-tween.start)/tween.duration);
    var k=1-Math.pow(1-t,3);
    yaw=tween.fromYaw+(tween.toYaw-tween.fromYaw)*k;
    pitch=tween.fromPitch+(tween.toPitch-tween.fromPitch)*k;
    dist=tween.fromDist+(tween.toDist-tween.fromDist)*k;
    target.x=tween.fromTarget.x+(tween.toTarget.x-tween.fromTarget.x)*k;
    target.y=tween.fromTarget.y+(tween.toTarget.y-tween.fromTarget.y)*k;
    target.z=tween.fromTarget.z+(tween.toTarget.z-tween.fromTarget.z)*k;
    if(t>=1)tween=null;
  }
  ctx.clearRect(0,0,W,H);
  if(mode==='COMPARE'){
    var half=Math.floor(W/2);
    clickables=render({yaw:yaw,pitch:pitch,dist:dist,target:target},0,half,false);
    render({yaw:yaw,pitch:pitch,dist:dist,target:target},half,W-half,true);
  } else {
    clickables=render({yaw:yaw,pitch:pitch,dist:dist,target:target},0,W,mode==='REALISTIC');
  }
  requestAnimationFrame(frame);
}

// ---- pointer orbit controls ----
var dragging=false,lastX=0,lastY=0,downX=0,downY=0;
canvas.addEventListener('pointerdown',function(e){dragging=true;lastX=e.clientX;lastY=e.clientY;downX=e.clientX;downY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',function(e){
  if(!dragging)return;
  var dx=e.clientX-lastX,dy=e.clientY-lastY;
  lastX=e.clientX;lastY=e.clientY;
  yaw+=dx*0.006;
  pitch=Math.max(0.1,Math.min(1.45,pitch+dy*0.005));
});
addEventListener('pointerup',function(e){
  dragging=false;
  if(Math.hypot(e.clientX-downX,e.clientY-downY)<4)handleClick(e.clientX,e.clientY);
});
canvas.addEventListener('wheel',function(e){e.preventDefault();dist=Math.max(50,Math.min(500,dist+e.deltaY*0.15));},{passive:false});

function pointInScreenPoly(x,y,poly){
  var inside=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
    if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function handleClick(cx,cy){
  var best=null;
  clickables.forEach(function(c){
    if(pointInScreenPoly(cx,cy,c.screenPoly)){
      if(!best||c.depth<best.depth)best=c;
    }
  });
  if(best&&byId[best.id])openPanel(byId[best.id]);
}

// ================= UI chrome wiring (ports the Svärtinge panel/steps/tools logic) =================
var panel=document.getElementById('panel'),panelType=document.getElementById('panelType'),panelTitle=document.getElementById('panelTitle'),panelBadge=document.getElementById('panelBadge'),panelBody=document.getElementById('panelBody'),closeButton=document.getElementById('close'),sourcesButton=document.getElementById('sourcesButton'),stepsNav=document.getElementById('steps'),solarTimeEl=document.getElementById('solarTime'),timeLabel=document.getElementById('timeLabel'),terrainToggle=document.getElementById('terrainToggle'),poiToggle=document.getElementById('poiToggle'),labelsToggle=document.getElementById('labelsToggle'),divider=document.getElementById('divider'),leftLabel=document.getElementById('leftLabel'),rightLabel=document.getElementById('rightLabel'),modeCaption=document.getElementById('modeCaption'),loading=document.getElementById('loading');
var livePanel=document.getElementById('livePanel'),liveContextButton=document.getElementById('liveContextButton'),liveClose=document.getElementById('liveClose'),liveConnect=document.getElementById('liveConnect'),liveStatus=document.getElementById('liveStatus');

function openPanel(item){
  panel.classList.add('open');
  panelType.textContent=item.type+' · '+item.id;
  panelTitle.textContent=item.label;
  panelBadge.innerHTML='<span class="badge" style="background:'+COLORS[item.evidence_class]+'">'+item.evidence_class+'</span>';
  var g=JSON.stringify(item.geometry,null,2);
  panelBody.innerHTML='<div class="row"><b>Geometry / method</b><code>'+item.geometry.primitive+'</code></div>'+
    '<div class="row"><b>Source references</b>'+(item.source_refs.length?item.source_refs.join('<br>'):'None')+'</div>'+
    '<div class="row"><b>Limitations</b><ul class="limitations">'+item.limitations.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul></div>'+
    '<div class="row"><b>Scene parameters</b><pre style="white-space:pre-wrap;font-size:9px">'+g+'</pre></div>';
}
closeButton.onclick=function(){panel.classList.remove('open');};

function openSources(){
  livePanel.classList.remove('open');
  panel.classList.add('open');
  panelType.textContent='SOURCE RECEIPTS · CREDENTIAL-SAFE';
  panelTitle.textContent='Djurö byväg 34 · source stack';
  panelBadge.innerHTML='<span class="badge" style="background:#14231d">NO CREDENTIALS OR RAW PROVIDER BYTES COMMITTED</span>';
  var ds=geomSources.datasets;
  function row(d,label){
    return '<div class="provider"><div class="provider-head"><b>'+label+'</b><span class="state CONNECTED">DOWNLOADED &middot; SHA-256 VERIFIED</span></div>'+
      '<div class="row">'+(d.title||'')+' &middot; '+d.horizontal_crs+' &middot; '+(d.asset_size_bytes_downloaded/1e6).toFixed(1)+' MB<br>'+d.asset_sha256+'</div>'+
      '<ul class="limitations"><li>Downloaded '+d.downloaded_at+' under the Geotorget order (kundnr 30056732).</li></ul></div>';
  }
  var denied='';
  if(ds.belagenhetsadresser){
    denied='<div class="provider"><div class="provider-head"><b>Official address point (bel&auml;genhetsadresser)</b><span class="state KEY_REQUIRED">DENIED &middot; HTTP '+ds.belagenhetsadresser.asset_access.http_status+'</span></div><div class="row">'+ds.belagenhetsadresser.asset_access.note+'</div></div>';
  }
  panelBody.innerHTML='<div class="row"><b>What this Twin is built from</b>Every parcel boundary, building footprint and terrain height on screen traces to one of the receipts below &mdash; nothing here is drawn from a listing photo or estimate.</div>'+
    row(ds.property_division,'Property boundary (fastighetsindelning)')+row(ds.buildings,'Building footprints (byggnad)')+denied+
    '<div class="provider"><div class="provider-head"><b>Terrain (1 m DTM)</b><span class="state CONNECTED">DOWNLOADED &middot; SHA-256 VERIFIED</span></div><div class="row">10 tiles, Lantm&auml;teriet mhm-65_7 grid, ~5.0 km &times; 7.5 km mosaic around the address.</div></div>'+
    '<div class="provider"><div class="provider-head"><b>Sea view</b><span class="state RESEARCH_ONLY">DEM HEURISTIC, NOT OFFICIAL HYDROGRAPHY</span></div><div class="row">Official land-cover/hydrography (marktacke) was requested but denied (HTTP 403). Water is instead classified from the same DEM by an elevation/flatness heuristic.</div></div>';
}
sourcesButton.onclick=openSources;

// Camera framing presets tuned for this flat-scale projection (not derived from the
// Three.js perspective-camera vectors in data.navigation, which don't translate 1:1).
var seaYawDeg=180-(seaLo+seaHi)/2;
var STEP_PRESETS={
  NEIGHBOURHOOD_VIEW:{yaw:-0.25,pitch:0.95,dist:230,target:[0,2,0]},
  PARCEL_ORBIT:{yaw:-0.2,pitch:0.9,dist:140,target:[0,2,0]},
  MAIN_HOUSE:{yaw:0.3,pitch:0.85,dist:60,target:[0,3,5]},
  OUTBUILDINGS:{yaw:-0.3,pitch:0.85,dist:80,target:[-33,2,-21]},
  SEA_VIEW:{yaw:0.2,pitch:0.8,dist:160,target:[0,2,0]},
  TERRAIN_SLOPE:{yaw:0.4,pitch:1.0,dist:190,target:[0,-3,0]},
};

var currentStep=0;
function stepTo(i,instant){
  currentStep=i;
  var s=data.navigation[i];
  document.querySelectorAll('.step').forEach(function(b,n){b.classList.toggle('active',n===i);});
  var o=STEP_PRESETS[s.id]||{yaw:yaw,pitch:pitch,dist:dist,target:[target.x,target.y,target.z]};
  var toTarget={x:o.target[0],y:o.target[1],z:o.target[2]};
  if(instant){
    yaw=o.yaw;pitch=o.pitch;dist=o.dist;target.x=toTarget.x;target.y=toTarget.y;target.z=toTarget.z;
  } else {
    tween={fromYaw:yaw,toYaw:o.yaw,fromPitch:pitch,toPitch:o.pitch,fromDist:dist,toDist:o.dist,fromTarget:{x:target.x,y:target.y,z:target.z},toTarget:toTarget,start:performance.now(),duration:850};
  }
  if(s.on_enter_open_element&&byId[s.on_enter_open_element])openPanel(byId[s.on_enter_open_element]);
  else panel.classList.remove('open');
}
function makeSteps(){
  data.navigation.forEach(function(s,i){
    var b=document.createElement('button');
    b.className='step';
    b.textContent=(i+1)+'. '+s.label;
    b.onclick=function(){stepTo(i,false);};
    stepsNav.appendChild(b);
  });
}

function setMode(next){
  mode=next;
  document.querySelectorAll('.mode').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
  var compare=mode==='COMPARE';
  divider.classList.toggle('hidden',!compare);
  leftLabel.classList.toggle('hidden',!compare);
  rightLabel.classList.toggle('hidden',!compare);
  modeCaption.textContent={INTELLIGENCE:'Evidence colours expose source status and uncertainty.',REALISTIC:'Real registered footprints and terrain, with decorative trees/rocks/sea for context · no renovation design shown.',COMPARE:'One Twin · one camera · analytical evidence beside realistic context.'}[mode];
}
document.querySelectorAll('.mode').forEach(function(b){b.onclick=function(){setMode(b.dataset.mode);};});

function setSun(){
  var h=+solarTimeEl.value;
  timeLabel.textContent=String(Math.floor(h)).padStart(2,'0')+':'+(h%1?String(Math.round((h%1)*60)).padStart(2,'0'):'00');
}
solarTimeEl.oninput=setSun;

terrainToggle.onclick=function(e){showTerrain=!showTerrain;e.currentTarget.classList.toggle('active',showTerrain);};
poiToggle.onclick=function(e){e.currentTarget.classList.toggle('active');};
labelsToggle.onclick=function(e){showLabels=!showLabels;e.currentTarget.classList.toggle('active',showLabels);};

liveContextButton.onclick=function(){panel.classList.remove('open');livePanel.classList.add('open');liveContextButton.classList.add('active');};
liveClose.onclick=function(){livePanel.classList.remove('open');liveContextButton.classList.remove('active');};
liveConnect.onclick=function(){liveStatus.textContent='LIVE MAP PROVIDERS ARE BLOCKED IN THIS SANDBOXED VIEW · THE TWIN IS STILL FULLY USABLE';liveStatus.style.color='#ffb1a5';};

addEventListener('keydown',function(e){
  if(e.key==='ArrowRight')stepTo(Math.min(data.navigation.length-1,currentStep+1),false);
  if(e.key==='ArrowLeft')stepTo(Math.max(0,currentStep-1),false);
  if(e.key==='1')setMode('INTELLIGENCE');
  if(e.key==='2')setMode('REALISTIC');
  if(e.key==='3')setMode('COMPARE');
});

makeSteps();setSun();setMode('INTELLIGENCE');stepTo(0,true);
loading.remove();
requestAnimationFrame(frame);
})();
