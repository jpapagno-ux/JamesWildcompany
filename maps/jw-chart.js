/*! jw-chart · House of James Wild animated itinerary chart (HJW-01)
 * Replaces the MapLibre itinerary maps for land and vessel programmes.
 * Usage:
 *   <div data-jw-map="itinerary" data-route="magellan-discoverer-inaugural"></div>   (via maps/jw-embed.js)
 *   JWChart.mount(el, {routes:["id-a","id-b"], dest:"antarctica", kind:"voyage"})
 * Routes are jw-route v1 JSON files in maps/routes/<id>.json.
 * Requires d3 v7 (jw-embed.js loads d3 7.8.5 from cdnjs on demand).
 * One chart per page: the engine owns fixed element ids.
 */
(function () {
  "use strict";
  var SCRIPT = document.currentScript;
  var BASE = (SCRIPT && SCRIPT.src ? SCRIPT.src.replace(/[^\/]*$/, "") : "/maps/");

  /* HJW-01 Part 2.4 · chart colours on the house site */
  var PALETTE = {
    voyage: {
      paper: "#f9f8f3", seaFill: "#eef1ec", seaInk: "#7e9ba3", waveInk: "#2c5566",
      landInk: "#3c3228", landFill: "#ebe7dc", contourInk: "#9e9284", lineInk: "#c9b79f",
      roseInk: "#24485a", ink: "#3c3228", riverInk: "#7e9ba3", roseBg: "rgba(249,248,243,.86)",
      col: { a: "#3b4250", s: "#24485a", w: "#2c5566", l: "#7f5320", f: "#55613a", h: "#621819" },
      vol: "#24485a"
    },
    overland: {
      paper: "#f9f8f3", seaFill: "#f1efe8", seaInk: "#9aa6a8", waveInk: "#6b6155",
      landInk: "#3c3228", landFill: "#ebe7dc", contourInk: "#9e9284", lineInk: "#c9b79f",
      roseInk: "#621819", ink: "#3c3228", riverInk: "#9aa6a8", roseBg: "rgba(249,248,243,.86)",
      col: { a: "#3b4250", s: "#2c5566", w: "#2c5566", l: "#7f5320", f: "#55613a", h: "#621819" },
      vol: "#3b4250"
    }
  };
  var MODE = { air: "a", flight: "a", plane: "a", sea: "s", ship: "s", vessel: "s", boat: "w", zodiac: "w",
    kayak: "w", land: "l", road: "l", rail: "l", drive: "l", transfer: "l", walk: "f", foot: "f", hike: "f",
    heli: "h", helicopter: "h" };
  var LEGEND = { a: "By air", s: "Under way", w: "By boat", l: "Overland", f: "On foot", h: "By helicopter" };
  var LG_STYLE = { a: "dotted", s: "dashed", w: "dashed", l: "solid", f: "dotted", h: "dotted" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }

  /* jw-route v1 -> engine route */
  function adapt(r) {
    var wp = (r.stops || []).map(function (s, i) {
      var w = { d: +s.day || 1, t: s.time || "", n: s.name, c: [+s.lat, +s.lng] };
      if (i > 0) w.m = MODE[String(s.mode || (r.type === "overland" ? "road" : "sea")).toLowerCase()] || "l";
      if (s.kind === "airstrip" || s.kind === "port" || s.kind === "airport") w.k = "strip";
      if (s.nolabel) w.nf = true;
      return w;
    });
    var dt = {};
    if (r.days && typeof r.days === "object") Object.keys(r.days).forEach(function (k) { dt[k] = r.days[k]; });
    return { title: r.title, sub: r.subtitle || "", wp: wp, dt: dt };
  }

  function shell(o) {
    var routeBtns = o.routes.map(function (r, i) {
      return '<button type="button" data-route="' + esc(r.key) + '" aria-pressed="' + (i ? "false" : "true") + '">' + esc(r.label) + "</button>";
    }).join("");
    var legend = o.modes.map(function (m) {
      return '<span><i style="border-top:' + (m === "a" || m === "h" ? 2 : 3) + "px " + LG_STYLE[m] + " " + o.pal.col[m] + '"></i>' + LEGEND[m] + "</span>";
    }).join("");
    return '' +
      '<div class="jwc entrance" id="chart" style="--jwc-vol:' + o.pal.vol + '">' +
      '<div class="stage" id="stage" tabindex="0" aria-label="Animated route map. Drag to turn the globe; use plus and minus to zoom.">' +
      '<canvas id="globe" role="img" aria-label="' + esc(o.alt) + '"></canvas>' +
      '<div class="overlay"><div class="ovk">' + esc(o.kicker) + '</div><h3 id="routeTitle"></h3><p id="routeSub"></p>' +
      '<div class="readout" aria-live="polite"><div class="row1"><span id="day">DAY 01</span><span id="status">THE GLOBE</span></div><div class="coord" id="cx"></div><div class="way" id="way"></div></div></div>' +
      '<div class="zoom"><button type="button" id="zin" aria-label="Zoom in">+</button><button type="button" id="zout" aria-label="Zoom out">−</button><button type="button" id="fs" aria-label="Full screen">⤢</button></div>' +
      '<div class="hud" aria-hidden="true"><span id="hZoom">ZOOM ×1</span><span id="hStep">GRATICULE</span><span id="hCentre"></span><span id="hNote">LOADING…</span></div>' +
      '</div>' +
      '<div class="ctrlbar">' +
      (o.routes.length > 1 ? '<div class="routes" role="group" aria-label="Choose a route">' + routeBtns + '</div>' : '<div class="routes" hidden>' + routeBtns + '</div>') +
      '<div class="ctrlrow"><div class="ctrls"><button type="button" id="prev" aria-label="Previous stop">◀</button><button type="button" id="play">PAUSE</button><button type="button" id="next" aria-label="Next stop">▶</button></div>' +
      '<div class="speed" role="group" aria-label="Playback speed"><button type="button" data-speed="0.5" aria-pressed="false">½×</button><button type="button" data-speed="1" aria-pressed="true">1×</button><button type="button" data-speed="2" aria-pressed="false">2×</button></div>' +
      '<div class="legend">' + legend + '</div></div>' +
      '<div class="days" id="days" role="group" aria-label="Jump to a day"></div>' +
      '</div>' +
      '<details class="coords"><summary>COORDINATES LEDGER · EVERY STOP</summary><ol class="ledger" id="ledger"></ol></details>' +
      (o.caption ? '<p class="platecap">' + esc(o.caption) + '</p>' : '') +
      '</div>';
  }

  function mount(root, opts) {
    opts = opts || {};
    if (window.__JWC_MOUNTED) { console.warn("jw-chart: one chart per page"); return Promise.resolve(); }
    window.__JWC_MOUNTED = true;
    var ids = opts.routes || [];
    if (typeof ids === "string") ids = ids.split(/[\s,]+/).filter(Boolean);
    return Promise.all(ids.map(function (id) {
      return typeof id === "object" ? Promise.resolve(id) : getJSON(BASE + "routes/" + id + ".json");
    })).then(function (routes) {
      if (!routes.length) throw new Error("jw-chart: no routes");
      var first = routes[0];
      var kind = opts.kind || (first.type === "overland" ? "overland" : "voyage");
      var dest = opts.dest || first.destination;
      var meta = dest ? getJSON(BASE + "data/" + dest + "/meta.json").catch(function () { return null; }) : Promise.resolve(null);
      return meta.then(function (m) { return { routes: routes, kind: kind, dest: dest, meta: m }; });
    }).then(function (ctx) {
      var first = ctx.routes[0];
      var pal = Object.assign({}, PALETTE[ctx.kind], opts.palette || {});
      pal.col = Object.assign({}, PALETTE[ctx.kind].col, (opts.palette && opts.palette.col) || {});
      var R = {}, list = [], modes = {};
      ctx.routes.forEach(function (r, i) {
        var key = "R" + i, a = adapt(r);
        a.wp.forEach(function (w) { if (w.m) modes[w.m] = 1; });
        R[key] = a;
        list.push({ key: key, label: r.short || r.title });
      });
      // bbox: meta.json, else the stops
      var box = ctx.meta && ctx.meta.bbox;
      if (!box) {
        var la = [], lo = [];
        ctx.routes.forEach(function (r) { r.stops.forEach(function (s) { la.push(+s.lat); lo.push(+s.lng); }); });
        box = [Math.min.apply(0, lo) - 1, Math.min.apply(0, la) - 1, Math.max.apply(0, lo) + 1, Math.max.apply(0, la) + 1];
      }
      var cLat = (box[1] + box[3]) / 2, cLon = (box[0] + box[2]) / 2;
      var places = [];
      ctx.routes.forEach(function (r) { (r.places || []).forEach(function (p) { places.push({ n: p.name, c: [p.lat, p.lng], minR: p.minR || 0, size: p.size || 13 }); }); });
      var order = ["a", "s", "w", "l", "f", "h"].filter(function (k) { return modes[k]; });
      var kicker = opts.kicker || [first.code && String(first.code).length > 2 ? first.code : "", ctx.kind === "overland" ? "BY LAND" : "BY SEA"].filter(Boolean).join(" · ").toUpperCase();
      root.innerHTML = shell({
        routes: list, modes: order, pal: pal, kicker: kicker,
        alt: opts.alt || ("Animated route map: " + first.title + (first.subtitle ? ", " + first.subtitle : "")),
        caption: opts.caption == null ? (first.map_note || "Engraved after Natural Earth · illustrative route, not a navigational chart") : opts.caption
      });
      window.CHART = Object.assign({
        routes: R, box: box, region: ctx.dest ? BASE + "data/" + ctx.dest + "/base.geojson" : null,
        globe: BASE + "data/world.geojson",
        start: [Math.max(-70, Math.min(70, cLat + 8)), cLon + 22],
        pad: 0.12, maxR: 130000, zoomMax: 200000, vehScale: 11000,
        chase: { s: 45000, w: 45000, l: 40000, a: 14000, h: 25000, d: 40000 },
        dayMaxR: 26000, dayPad: 0.05, hold: 1.5, introT: 2.2,
        cartouche: opts.cartouche || "James Wild & Company",
        holdWord: ctx.kind === "overland" ? "AT REST" : "AT ANCHOR",
        modeWord: ctx.kind === "overland" ? { l: "ON THE ROAD", a: "IN THE AIR", w: "ON THE WATER" } : { s: "UNDER WAY", l: "ASHORE", a: "IN THE AIR" },
        places: places,
        fontDisp: "'Libre Caslon Display', Georgia, serif",
        fontText: "'Libre Caslon Text', Georgia, serif"
      }, pal, opts.chart || {});
      delete window.CHART.vol;
      ENGINE();
    }).catch(function (err) {
      window.__JWC_MOUNTED = false;
      console.error(err);
      root.innerHTML = '<p class="jwc-fail">The route chart could not load. The day-by-day itinerary below has every stop.</p>';
    });
  }

  function ENGINE() {
(function(){
'use strict';
var CFG=window.CHART,J=CFG.routes,D=Math.PI/180,FD=CFG.fontDisp||"'Libre Caslon Display', Georgia, serif",FT=CFG.fontText||"'Libre Caslon Text', Georgia, serif";
function wrap(a){return ((a%360)+540)%360-180}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function toV(la,lo){var a=la*D,b=lo*D;return [Math.cos(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.sin(a)]}
function toLL(v){var n=Math.hypot(v[0],v[1],v[2])||1;return [Math.asin(clamp(v[2]/n,-1,1))/D,Math.atan2(v[1],v[0])/D]}
function slerp(a,b,t){var A=toV(a[0],a[1]),B=toV(b[0],b[1]);var w=Math.acos(clamp(A[0]*B[0]+A[1]*B[1]+A[2]*B[2],-1,1)),s=Math.sin(w);
  if(s<1e-9)return [a[0]+(b[0]-a[0])*t,a[1]+wrap(b[1]-a[1])*t];var k1=Math.sin((1-t)*w)/s,k2=Math.sin(t*w)/s;
  return toLL([k1*A[0]+k2*B[0],k1*A[1]+k2*B[1],k1*A[2]+k2*B[2]])}
function gcd(a,b){var A=toV(a[0],a[1]),B=toV(b[0],b[1]);return Math.acos(clamp(A[0]*B[0]+A[1]*B[1]+A[2]*B[2],-1,1))/D}
var SEG=30;
function legPts(a,b){var o=[];for(var j=0;j<=SEG;j++)o.push(slerp(a,b,j/SEG));return o}
function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
function sampleAt(p,u){var f=clamp(u,0,1)*(p.length-1),i=Math.floor(f),r=f-i;if(i>=p.length-1)return p[p.length-1];return slerp(p[i],p[i+1],r)}
function partU(p,u){var f=clamp(u,0,1)*(p.length-1),i=Math.floor(f),o=p.slice(0,i+1);o.push(sampleAt(p,u));return o}
function centroid(l){var x=0,y=0,z=0;l.forEach(function(c){var v=toV(c[0],c[1]);x+=v[0];y+=v[1];z+=v[2]});return toLL([x,y,z])}
function pad(n,w){var s=String(n);while(s.length<w)s='0'+s;return s}
function dms(x,p,n,w){var h=x>=0?p:n;x=Math.abs(x);var d=Math.floor(x),m=(x-d)*60;if(m>=59.995){d++;m=0}var ms=m.toFixed(2);if(m<10)ms='0'+ms;return pad(d,w)+'°'+ms+'′'+h}
function coord(c){return dms(c[0],'N','S',2)+'  '+dms(wrap(c[1]),'E','W',3)}
function geoLine(p){return {type:'LineString',coordinates:p.map(function(c){return [c[1],c[0]]})}}

var COL=CFG.col,INK=CFG.ink||'#24201A';
var DASH={s:[8,5],w:[8,5],l:[],f:[1,6],a:[2,6],h:[2,4]};
var MODEWORD=Object.assign({s:'UNDERWAY',w:'ON THE WATER',l:'OVERLAND',f:'ON FOOT',a:'IN THE AIR',h:'BY HELICOPTER'},CFG.modeWord||{});
var KEYS=Object.keys(J);
KEYS.forEach(function(k){var m=J[k];m.n=m.wp.length-1;m.legs=[];m.pts=[];m.legR=[];m.legA=[];
 for(var i=0;i<m.n;i++){var lp=legPts(m.wp[i].c,m.wp[i+1].c);m.legs.push(lp);m.pts=m.pts.concat(i?lp.slice(1):lp);
  var c=centroid(lp),md=0;lp.forEach(function(p){md=Math.max(md,gcd(c,p))});m.legR.push(clamp(215/((md+(CFG.pad||0.12))*D),320,CFG.maxR||14000));m.legA.push(md*2)}
 m.dayStart={};m.dayWp={};m.wp.forEach(function(w,i){if(m.dayStart[w.d]==null)m.dayStart[w.d]=i;m.dayWp[w.d]=m.dayWp[w.d]||[];if(!w.nf)m.dayWp[w.d].push(w.c)});m.wp.forEach(function(w,i){if(!m.dayWp[w.d].length){m.dayWp[w.d].push(w.c);if(m.wp[i+1])m.dayWp[w.d].push(m.wp[i+1].c)}});m.days=Object.keys(m.dayStart).map(Number).sort(function(a,b){return a-b});
 m.dayC={};m.dayR={};m.days.forEach(function(d){var l=m.dayWp[d],c=centroid(l),md=0;l.forEach(function(p){md=Math.max(md,gcd(c,p))});m.dayC[d]=c;m.dayR[d]=clamp(215/((md+(CFG.dayPad||0.05))*D),320,CFG.dayMaxR||CFG.maxR||14000)})});
var HOLD=CFG.hold||1.2,HOLD_END=2.4,LNG=Math.log(270),START=CFG.start||[0,0];
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var S={mode:KEYS[0],phase:'fly',lam:START[1],phi:START[0],lnR:LNG,k:0,t:0,u:0,speed:1,playing:!reduce,manual:false,follow:null,lastDay:null};
var data={},userTs=0;['wheel','touchmove','keydown','pointerdown'].forEach(function(ev){addEventListener(ev,function(){userTs=Date.now()},{passive:true})});
function headAt(m,u){return sampleAt(m.pts,u)}
function viewAt(m,k){return k>=m.n?m.wp[m.n].c:centroid(m.legs[k])}
function dayOf(m,k){return m.wp[clamp(k,0,m.n)].d}
function startFly(toC,toLn){var from=[S.phi,S.lam],ang=gcd(from,toC),hi=Math.max(S.lnR,toLn);
 var mid=Math.min(S.lnR,toLn,LNG+(hi-LNG)*(1-clamp(ang/25,0.12,1)));
 S.fly={from:from,to:toC,a:S.lnR,b:toLn,mid:mid,dur:clamp(1.8+ang/40,1.8,3.8)};S.phase='fly';S.t=0}
function intro(){S.phase='intro';S.t=0;S.k=0;S.u=0}
function setMode(k,keepFollow,quick){S.mode=k;S.k=0;S.t=0;S.u=0;S.manual=false;if(!keepFollow)S.follow=null;var m=J[k],d0=m.wp[0].d;if(quick||reduce)startFly(m.dayC[d0],Math.log(m.dayR[d0]));else intro();if(!reduce)S.playing=true;buildUI();syncButtons()}
function jump(i){var m=J[S.mode];S.k=clamp(i,0,m.n);S.u=S.k/m.n;S.t=0;S.phase='hold';S.manual=false}
function showDay(d){var m=J[S.mode];if(m.dayStart[d]==null)return;var i=m.dayStart[d];S.follow=d;S.manual=false;S.playing=true;
 if(i>0){jump(i-1);S.t=HOLD*.75}else jump(0)}
function step(rdt){
 var dt=rdt*S.speed,m=J[S.mode],tc=null,tl=0;
 if(S.phase==='intro'){var d0=m.wp[0].d,T=m.dayC[d0];if(S.playing)S.t+=dt;var kz=1-Math.exp(-rdt*2);S.lnR+=(LNG-S.lnR)*kz;
  var targetLam=wrap(T[1]-40+S.t*16);S.lam=wrap(S.lam+wrap(targetLam-S.lam)*(1-Math.exp(-rdt*1.4)));S.phi+=(T[0]*.6-S.phi)*(1-Math.exp(-rdt*1.2));
  if(S.t>=(CFG.introT||3.2)&&!S.manual){if(m.wp[0].nf)startFly(centroid(m.legs[0]),Math.log(m.legR[0]));else startFly(T,Math.log(m.dayR[d0]))}if(S.lastDay!==d0){S.lastDay=d0;if(window.onChartDay)try{window.onChartDay(S.mode,d0,false)}catch(e){}}return}
 if(S.phase==='fly'){if(S.playing)S.t+=dt;var f=S.fly,uu=clamp(S.t/f.dur,0,1),e=ease(uu),c=slerp(f.from,f.to,e);
  S.phi=c[0];S.lam=c[1];S.lnR=uu<.5?f.a+(f.mid-f.a)*ease(uu*2):f.mid+(f.b-f.mid)*ease(uu*2-1);
  if(uu>=1){S.phase='hold';S.k=0;S.u=0;S.t=0}return}
 if(S.phase==='hold'){if(S.playing)S.t+=dt;S.u=S.k/m.n;var d=dayOf(m,S.k),hw=m.wp[S.k];if(hw.nf){var lk=S.k<m.n?S.k:S.k-1;tc=centroid(m.legs[lk]);tl=Math.log(m.legR[lk])}else{tc=m.dayC[d];tl=Math.log(m.dayR[d])}
  var gate=S.follow!=null&&S.k<m.n&&dayOf(m,S.k+1)>S.follow&&dayOf(m,S.k)>=S.follow;if(gate&&S.playing&&Date.now()-userTs>(CFG.resume||4000)&&S.t>HOLD*2){S.follow=null;gate=false}
  if(!gate&&S.t>=(S.k>=m.n?HOLD_END:(S.k>0&&m.wp[S.k].nf?0.05:HOLD))){if(S.k<m.n){S.phase='leg';S.t=0}else{S.follow=null;intro();return}}}
 else if(S.phase==='leg'){var lmode=m.wp[S.k+1].m,dur=clamp(1.5+m.legA[S.k]*0.5,(lmode==='a'||lmode==='h')?2.6:1.8,5);if(S.playing)S.t+=dt;
  var lu=clamp(S.t/dur,0,1),le=ease(lu);S.u=(S.k+le)/m.n;S.legU=lu;var d1=dayOf(m,S.k),d2=dayOf(m,S.k+1);
  var a=Math.log(m.dayR[d1]),b=Math.log(m.dayR[d2]),lg=Math.log(m.legR[S.k]);
  var CH=CFG.chase||{},close=Math.log(Math.min(CFG.maxR||30000,CH[lmode]||CH.d||36000)),hd=headAt(m,S.u);
  var w8=clamp((close-lg)/1.6,0,1),sn=Math.sin(Math.PI*lu);
  tc=slerp(hd,centroid(m.legs[S.k]),w8*Math.pow(sn,.8)*.9);tl=close+(Math.min(lg,close)-close)*Math.pow(sn,.7);S.chase=true;
  if(lu>=1){S.k++;S.phase='hold';S.t=0}}
 if(tc&&!S.manual){var fast=S.phase==='leg',kp=1-Math.exp(-rdt*(fast?9:4.5)),kz2=1-Math.exp(-rdt*(fast?4.5:3.2));var nc=slerp([S.phi,S.lam],tc,kp);S.phi=nc[0];S.lam=nc[1];S.lnR+=(tl-S.lnR)*kz2}
 var cd=S.phase==='fly'?m.wp[0].d:dayOf(m,S.phase==='leg'&&S.legU>.5?S.k+1:S.k);
 S.cardT=(S.cardT||0)+rdt;S.arrT=(S.arrT||0)+rdt;if(S.phase==='hold'&&S.holdK!==S.k){S.holdK=S.k;S.arrT=0}if(S.phase!=='hold')S.holdK=-1;
 if(cd!==S.lastDay){S.lastDay=cd;S.cardT=0;S.cardD=cd;if(window.onChartDay)try{window.onChartDay(S.mode,cd,S.playing&&!S.manual&&S.follow==null)}catch(e){}}
}
var stage=document.getElementById('stage'),cv=document.getElementById('globe'),ctx=cv.getContext('2d');
var scaleK=1,VW=720,CX=360,FIT=1,landKey='',landPath=null,ovKey='',ovP=null;
function resize(){var w=stage.clientWidth||720,h=stage.clientHeight||w,dpr=Math.min(window.devicePixelRatio||1,1.5);if(w*h*dpr*dpr>1.6e6)dpr=Math.sqrt(1.6e6/(w*h));cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);scaleK=h*dpr/720;VW=720*w/h;CX=VW/2;FIT=Math.min(1,VW/720);landKey='';ovKey=''}
new ResizeObserver(resize).observe(stage);resize();
function makePat(w,h,fn,rot){var s=4,c=document.createElement('canvas');c.width=Math.ceil(w*s);c.height=Math.ceil(h*s);var x=c.getContext('2d');x.scale(s,s);fn(x);
 var p=ctx.createPattern(c,'repeat');var M=new DOMMatrix();if(rot)M=M.rotate(rot);M=M.scale(1/s);try{p.setTransform(M)}catch(e){}return p}
var SEAI=CFG.seaInk||'#7E8F93',LANDI=CFG.landInk||'#3A3328';
var patF=makePat(12,6,function(x){x.strokeStyle=SEAI;x.lineWidth=.5;x.beginPath();x.moveTo(0,3);x.lineTo(6,3);x.stroke()});
var patW=makePat(7,4,function(x){x.strokeStyle=CFG.waveInk||'#3E5560';x.lineWidth=.85;x.beginPath();x.moveTo(0,2);x.lineTo(5,2);x.stroke()});
var patH=makePat(3.2,3.2,function(x){x.strokeStyle=LANDI;x.lineWidth=.75;x.beginPath();x.moveTo(1.6,-1);x.lineTo(1.6,4.2);x.stroke()},40);
function rose(){ctx.save();ctx.translate(VW-70,600);ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=.8;
 ctx.beginPath();ctx.arc(0,0,38,0,2*Math.PI);ctx.stroke();ctx.setLineDash([1,3]);ctx.beginPath();ctx.arc(0,0,32,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
 [[0,-52,5,-5],[0,52,-5,5],[-52,0,-5,-5],[52,0,5,5]].forEach(function(a){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(a[2],a[3]);ctx.lineTo(0,0);ctx.closePath();ctx.fill()});
 [[0,-52,-5,-5],[0,52,5,5],[-52,0,-5,5],[52,0,5,-5]].forEach(function(a){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(a[2],a[3]);ctx.lineTo(0,0);ctx.closePath();ctx.stroke()});
 ctx.fillStyle=CFG.roseInk||INK;ctx.beginPath();ctx.moveTo(0,-52);ctx.lineTo(4,-8);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
 ctx.fillStyle=INK;ctx.font="600 17px "+FT;ctx.textAlign='center';ctx.fillText('N',0,-58);ctx.restore()}
function label(txt,x,y,color,italic){ctx.font=italic?"italic 600 18px "+FD:"700 12.5px 'Courier Prime', monospace";ctx.lineJoin='round';ctx.lineWidth=4.5;ctx.strokeStyle=PAPER;ctx.strokeText(txt,x,y);ctx.fillStyle=color||INK;ctx.fillText(txt,x,y)}
var PAPER=CFG.paper||'#FBF8F1';
function icon(mode,x,y,ang){var col=COL[mode]||INK;ctx.save();ctx.translate(x,y);
 ctx.beginPath();ctx.arc(0,0,11,0,7);ctx.fillStyle=PAPER;ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2.4;ctx.stroke();
 ctx.fillStyle=col;ctx.strokeStyle=col;
 if(mode==='a'||mode==='h'){ctx.rotate(ang);ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(4,-1.4);ctx.lineTo(0,-7);ctx.lineTo(-2,-7);ctx.lineTo(0,-1.4);ctx.lineTo(-5,-1.2);ctx.lineTo(-7,-4);ctx.lineTo(-8,-4);ctx.lineTo(-7,0);ctx.lineTo(-8,4);ctx.lineTo(-7,4);ctx.lineTo(-5,1.2);ctx.lineTo(0,1.4);ctx.lineTo(-2,7);ctx.lineTo(0,7);ctx.lineTo(4,1.4);ctx.closePath();ctx.fill()}
 else{var flip=Math.abs(ang)>Math.PI/2;ctx.rotate(flip?ang+Math.PI:ang);if(flip)ctx.scale(-1,1);
  if(mode==='l'){ctx.fillRect(-6,-2.5,12,5);ctx.fillRect(-2.5,-5.5,6,3);ctx.beginPath();ctx.arc(-3.5,3.5,2,0,7);ctx.arc(4,3.5,2,0,7);ctx.fill()}
  else if(mode==='f'){ctx.beginPath();ctx.arc(.5,-6,2,0,7);ctx.fill();ctx.lineWidth=1.8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(.5,-3.5);ctx.lineTo(0,2);ctx.lineTo(-2.5,6.5);ctx.moveTo(0,2);ctx.lineTo(2.5,6.5);ctx.moveTo(.5,-2.5);ctx.lineTo(-2.5,.5);ctx.moveTo(.5,-2.5);ctx.lineTo(4,0);ctx.stroke()}
  else if(mode==='w'){ctx.beginPath();ctx.moveTo(-7,2);ctx.lineTo(7,2);ctx.lineTo(4.5,5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(-1,1);ctx.lineTo(6,-7);ctx.lineTo(-4.5,0);ctx.closePath();ctx.fill()}
  else{ctx.beginPath();ctx.moveTo(-8,1);ctx.lineTo(6,1);ctx.lineTo(9,-1);ctx.lineTo(6,5);ctx.lineTo(-7,5);ctx.closePath();ctx.fill();ctx.fillRect(-4.5,-2.5,8,3);ctx.fillRect(-1.5,-5.5,4.5,3)}}
 ctx.restore()}
/* engraved vehicle plates, drawn top-down in ink, scaled with zoom */
function hatchRect(x,y,w,h,gap){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.beginPath();for(var i=-h;i<w+h;i+=gap){ctx.moveTo(x+i,y);ctx.lineTo(x+i-h,y+h)}ctx.lineWidth=.45;ctx.stroke();ctx.restore()}
function vYacht(col,now,moving){
 if(moving){ctx.save();ctx.strokeStyle=CFG.waveInk||'#2C5A6C';ctx.lineCap='round';for(var i=0;i<5;i++){var o=(now/420+i/5)%1,sp=6+o*16,bx=-16-o*34;ctx.globalAlpha=.55*(1-o);ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(bx,-sp*.6);ctx.quadraticCurveTo(bx+5,-sp*.2,bx+8,0);ctx.quadraticCurveTo(bx+5,sp*.2,bx,sp*.6);ctx.stroke()}
  ctx.globalAlpha=.5;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(-15,-2);ctx.lineTo(-48,-9);ctx.moveTo(-15,2);ctx.lineTo(-48,9);ctx.stroke();ctx.restore()}
 ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(17,0);ctx.bezierCurveTo(14,-4.5,9,-6.2,4,-6.4);ctx.lineTo(-13,-6.4);ctx.quadraticCurveTo(-15.5,-6.2,-15.5,-4);ctx.lineTo(-15.5,4);ctx.quadraticCurveTo(-15.5,6.2,-13,6.4);ctx.lineTo(4,6.4);ctx.bezierCurveTo(9,6.2,14,4.5,17,0);ctx.closePath();
 ctx.fillStyle=PAPER;ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=1.3;ctx.stroke();
 ctx.beginPath();ctx.moveTo(14.5,0);ctx.bezierCurveTo(12,-3.4,8,-4.8,4,-5);ctx.lineTo(-13.5,-5);ctx.lineTo(-13.5,5);ctx.lineTo(4,5);ctx.bezierCurveTo(8,4.8,12,3.4,14.5,0);ctx.lineWidth=.6;ctx.stroke();
 ctx.fillStyle=col;ctx.globalAlpha=.22;ctx.fillRect(-10,-4.2,13,8.4);ctx.globalAlpha=1;ctx.strokeStyle=INK;ctx.lineWidth=.9;ctx.strokeRect(-10,-4.2,13,8.4);
 ctx.fillStyle=PAPER;ctx.fillRect(-7,-3,8,6);ctx.strokeRect(-7,-3,8,6);ctx.strokeStyle=INK;hatchRect(-7,-3,8,6,1.6);
 ctx.fillStyle=INK;for(var w=0;w<4;w++)ctx.fillRect(3.4,-3+w*1.7,1.1,.9);
 ctx.beginPath();ctx.arc(9,0,1.3,0,7);ctx.stroke();ctx.beginPath();ctx.ellipse(-13.8,0,1.4,3.4,0,0,7);ctx.fillStyle=col;ctx.fill();
 ctx.fillStyle=col;ctx.fillRect(-15.5,-.5,2,1)}
function vPlane(col,now,alt){
 var sh=alt*22;ctx.save();ctx.globalAlpha=.16+alt*.06;ctx.translate(sh,sh*1.1);ctx.scale(.94,.94);planeShape('rgba(36,32,26,1)','rgba(36,32,26,1)',now,true);ctx.restore();
 var sc=1+alt*.35;ctx.scale(sc,sc);planeShape(PAPER,INK,now,false,col)}
function planeShape(fill,ink,now,flat,col){ctx.lineJoin='round';ctx.fillStyle=fill;ctx.strokeStyle=ink;ctx.lineWidth=1.1;
 ctx.beginPath();ctx.moveTo(-8,-1.2);ctx.lineTo(-6,-22);ctx.lineTo(-1.5,-22);ctx.lineTo(1,-1.6);ctx.lineTo(1,1.6);ctx.lineTo(-1.5,22);ctx.lineTo(-6,22);ctx.lineTo(-8,1.2);ctx.closePath();ctx.fill();if(!flat){ctx.stroke();ctx.save();ctx.clip();hatchRect(-9,-23,11,46,2.2);ctx.restore()}
 ctx.beginPath();ctx.moveTo(15,0);ctx.bezierCurveTo(14,-2.6,10,-3,6,-3);ctx.lineTo(-17,-1.8);ctx.lineTo(-20,-.8);ctx.lineTo(-20,.8);ctx.lineTo(-17,1.8);ctx.lineTo(6,3);ctx.bezierCurveTo(10,3,14,2.6,15,0);ctx.fill();if(!flat)ctx.stroke();
 ctx.beginPath();ctx.moveTo(-15,-1.4);ctx.lineTo(-18,-8);ctx.lineTo(-20,-8);ctx.lineTo(-19.2,-1.2);ctx.moveTo(-15,1.4);ctx.lineTo(-18,8);ctx.lineTo(-20,8);ctx.lineTo(-19.2,1.2);ctx.fill();if(!flat)ctx.stroke();
 if(flat)return;
 ctx.fillStyle=col||ink;ctx.fillRect(-14,-.7,22,1.4);ctx.fillStyle=ink;for(var i=0;i<4;i++)ctx.fillRect(-1+i*2.4,-2.2,1.2,.8);
 ctx.save();ctx.translate(15.6,0);ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(0,0,1.2,7,0,0,7);ctx.stroke();ctx.globalAlpha=1;ctx.rotate(Math.sin(now/22)*.9);ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(0,-6.5);ctx.lineTo(0,6.5);ctx.stroke();ctx.restore()}
function vHeli(col,now,alt){var sh=alt*16;ctx.save();ctx.globalAlpha=.18;ctx.translate(sh,sh);ctx.fillStyle=INK;ctx.beginPath();ctx.ellipse(2,0,8,4.5,0,0,7);ctx.fill();ctx.fillRect(-15,-1,12,2);ctx.restore();
 ctx.lineJoin='round';ctx.fillStyle=PAPER;ctx.strokeStyle=INK;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(10,0);ctx.bezierCurveTo(10,-5,2,-5.5,-3,-3.5);ctx.lineTo(-4,-1);ctx.lineTo(-17,-.8);ctx.lineTo(-17,.8);ctx.lineTo(-4,1);ctx.lineTo(-3,3.5);ctx.bezierCurveTo(2,5.5,10,5,10,0);ctx.fill();ctx.stroke();
 ctx.fillStyle=col;ctx.globalAlpha=.3;ctx.beginPath();ctx.ellipse(6,0,3.4,3.6,0,0,7);ctx.fill();ctx.globalAlpha=1;ctx.strokeRect(-18,-3.5,2,7);
 ctx.save();ctx.translate(1,0);ctx.globalAlpha=.18;ctx.beginPath();ctx.arc(0,0,16,0,7);ctx.fillStyle=col;ctx.fill();ctx.globalAlpha=1;ctx.rotate(now/45);ctx.lineWidth=1.5;ctx.lineCap='round';ctx.beginPath();for(var b=0;b<4;b++){var a2=b*Math.PI/2;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a2)*16,Math.sin(a2)*16)}ctx.stroke();ctx.beginPath();ctx.arc(0,0,1.6,0,7);ctx.fillStyle=INK;ctx.fill();ctx.restore()}
function vJeep(col,now,moving){
 if(moving){ctx.save();ctx.fillStyle='#B59A73';for(var j=0;j<5;j++){var ph=((now/700)+j/5)%1;ctx.globalAlpha=.32*(1-ph);ctx.beginPath();ctx.arc(-12-ph*22,(j%2?2.5:-2.5)*(1+ph*2),1.6+ph*4.5,0,7);ctx.fill()}ctx.restore();
  ctx.save();ctx.strokeStyle=INK;ctx.globalAlpha=.3;ctx.setLineDash([1.4,2]);ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-10,-3.6);ctx.lineTo(-40,-3.6);ctx.moveTo(-10,3.6);ctx.lineTo(-40,3.6);ctx.stroke();ctx.restore()}
 ctx.lineJoin='round';ctx.fillStyle=PAPER;ctx.strokeStyle=INK;ctx.lineWidth=1.2;
 ctx.fillStyle=INK;[[-6.5,-5.2],[4.5,-5.2],[-6.5,4],[4.5,4]].forEach(function(w){ctx.fillRect(w[0],w[1],3.6,1.4)});
 ctx.fillStyle=PAPER;ctx.beginPath();ctx.moveTo(-10,-4.4);ctx.lineTo(8.5,-4.4);ctx.quadraticCurveTo(10.5,-4.4,10.5,-2.4);ctx.lineTo(10.5,2.4);ctx.quadraticCurveTo(10.5,4.4,8.5,4.4);ctx.lineTo(-10,4.4);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle=col;ctx.globalAlpha=.28;ctx.fillRect(-8,-3.4,13,6.8);ctx.globalAlpha=1;ctx.strokeRect(-8,-3.4,13,6.8);hatchRect(-7.5,-3,12,6,1.5);
 ctx.fillStyle=INK;ctx.fillRect(5.2,-3.4,1.4,6.8);ctx.fillRect(8.6,-3,.8,6);ctx.beginPath();ctx.arc(-11.2,0,2.4,0,7);ctx.fillStyle=PAPER;ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(-11.2,0,.9,0,7);ctx.fillStyle=INK;ctx.fill();
 ctx.fillRect(6.2,-5.6,1.2,1.2);ctx.fillRect(6.2,4.4,1.2,1.2)}
function vWalk(col,now,moving,ang){
 if(moving){ctx.save();ctx.rotate(ang);ctx.fillStyle=col;for(var k=1;k<10;k++){ctx.globalAlpha=.55-k*.05;ctx.beginPath();ctx.ellipse(-k*5-12,(k%2?2.2:-2.2),1.2,2.1,Math.PI/2,0,7);ctx.fill()}ctx.restore()}
 for(var p=2;p>=0;p--){var bob=moving?Math.sin(now/160+p*2)*.7:0;ctx.save();ctx.translate(-Math.cos(ang)*p*8,-Math.sin(ang)*p*8+bob);
  ctx.beginPath();ctx.ellipse(0,5.6,3.4,1.1,0,0,7);ctx.fillStyle='rgba(36,32,26,.18)';ctx.fill();
  ctx.strokeStyle=INK;ctx.fillStyle=p===0?col:INK;ctx.lineWidth=1.5;ctx.lineCap='round';ctx.beginPath();ctx.arc(0,-9,2.1,0,7);ctx.fill();
  var sw=moving?Math.sin(now/160+p*2)*2.2:0;ctx.beginPath();ctx.moveTo(0,-6.8);ctx.lineTo(0,-.5);ctx.moveTo(0,-.5);ctx.lineTo(-1.8+sw,5);ctx.moveTo(0,-.5);ctx.lineTo(1.8-sw,5);ctx.moveTo(0,-5.5);ctx.lineTo(-2.6,-1.5-sw*.4);ctx.moveTo(0,-5.5);ctx.lineTo(2.6,-1.5+sw*.4);ctx.stroke();
  if(p===0){ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(3.4,-8);ctx.lineTo(3.4,5);ctx.stroke()}else{ctx.fillStyle=PAPER;ctx.strokeStyle=INK;ctx.lineWidth=.8;ctx.fillRect(-3.4,-6.4,2.4,4);ctx.strokeRect(-3.4,-6.4,2.4,4)}ctx.restore()}}
function vDhow(col,now,moving){
 if(moving){ctx.save();ctx.strokeStyle=CFG.waveInk||'#3C5A5E';ctx.lineCap='round';for(var i=0;i<4;i++){var o=(now/460+i/4)%1,sp=4+o*10,bx=-10-o*24;ctx.globalAlpha=.5*(1-o);ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(bx,-sp*.6);ctx.quadraticCurveTo(bx+4,-sp*.2,bx+6,0);ctx.quadraticCurveTo(bx+4,sp*.2,bx,sp*.6);ctx.stroke()}ctx.restore()}
 ctx.lineJoin='round';ctx.fillStyle=PAPER;ctx.strokeStyle=INK;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(13,0);ctx.quadraticCurveTo(8,-4.6,-2,-4.4);ctx.lineTo(-10,-3.6);ctx.lineTo(-11,0);ctx.lineTo(-10,3.6);ctx.lineTo(-2,4.4);ctx.quadraticCurveTo(8,4.6,13,0);ctx.fill();ctx.stroke();
 for(var r=-6;r<8;r+=3.2){ctx.beginPath();ctx.moveTo(r,-3.6);ctx.lineTo(r,3.6);ctx.lineWidth=.5;ctx.stroke()}
 ctx.beginPath();ctx.moveTo(10,1);ctx.quadraticCurveTo(0,-14,-12,-9);ctx.lineTo(-6,1.5);ctx.closePath();ctx.fillStyle=col;ctx.globalAlpha=.32;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=1;ctx.stroke();
 ctx.save();ctx.clip();ctx.strokeStyle=INK;hatchRect(-13,-14,24,16,2.4);ctx.restore();ctx.beginPath();ctx.arc(1,0,1.1,0,7);ctx.fillStyle=INK;ctx.fill()}
function vehicle(mode,x,y,ang,alt,now,moving){var SZ=Object.assign({s:1,w:.8,a:.9,h:.9,l:.55,f:.7},CFG.vehSize||{}),R=Math.exp(S.lnR)*FIT,sc=clamp(R/(CFG.vehScale||9000),1,CFG.vehMax||1.7)*(SZ[mode]||1);
 if(R<(CFG.vehScale||9000)*1.15&&!(mode==='a'||mode==='h')){icon(mode,x,y,ang);return}
 var col=COL[mode]||INK;ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);
 if(mode==='f'){vWalk(col,now,moving,ang);ctx.restore();return}
 ctx.rotate(ang);
 if(mode==='a')vPlane(col,now,alt);else if(mode==='h')vHeli(col,now,alt);else if(mode==='l')vJeep(col,now,moving);else if(mode==='w')vDhow(col,now,moving);else vYacht(col,now,moving);
 ctx.restore()}
var satM=null;function satRaw(P,om){var co=Math.cos(om),so=Math.sin(om);function v(l,p){var cp=Math.cos(p),k=(P-1)/(P-cp*Math.cos(l));return [k*cp*Math.sin(l),k*Math.sin(p)]}
 function f(l,p){var c=v(l,p),y=c[1],A=y*so/(P-1)+co;return [c[0]*co/A,y/A]}
 f.invert=function(x,y){var k=(P-1)/(P-1-y*so),xx=x*k,yy=y*k/co;var rho=Math.sqrt(xx*xx+yy*yy),sinc=(P-Math.sqrt(1-rho*rho*(P+1)/(P-1)))/((P-1)/rho+rho/(P-1)),cc=Math.sqrt(Math.max(0,1-sinc*sinc));return [Math.atan2(xx*sinc,rho*cc),rho?Math.asin(yy*sinc/rho):0]};return f}
var VIS=Math.PI/2;
function makeProj(d3,R){var t=reduce?0:clamp((Math.log(R)-Math.log(900))/(Math.log(7000)-Math.log(900)),0,1)*(CFG.tilt==null?26:CFG.tilt);
 if(t<.5){VIS=Math.PI/2-.02;return d3.geoOrthographic().scale(R).translate([CX,360]).rotate([-S.lam,-S.phi]).clipAngle(90).precision(R>2000?.9:.6)}
 if(!satM)satM=d3.geoProjectionMutator(satRaw);var P=1+(CFG.persp||3.2)*720/R,tw=Math.tan(t*D),hyp=Math.sqrt(1+tw*tw),cap=Math.acos(1/P);if(P<hyp)cap=Math.min(cap,Math.atan(tw)-Math.acos(P/hyp));VIS=Math.max(.004,cap*.9);
 return satM(P,t*D).scale(R).translate([CX,360+t*2.2]).rotate([-S.lam,-S.phi]).clipAngle(VIS/D).precision(1.1)}
function splitPolys(fc){if(fc._split)return fc._split;var out=[];function add(g){if(!g)return;if(g.type==='MultiPolygon')g.coordinates.forEach(function(c){out.push({type:'Polygon',coordinates:c})});else if(g.type==='Polygon')out.push(g);else if(g.type==='GeometryCollection')g.geometries.forEach(add);else if(g.type==='Feature')add(g.geometry);else if(g.type==='FeatureCollection')g.features.forEach(add)}add(fc);fc._split={type:'GeometryCollection',geometries:out};return fc._split}
function nearLand(fc,span){fc=splitPolys(fc);var fs=fc.geometries;if(!fc._b){fs.forEach(function(f){f._b=d3.geoBounds(f)})}fc._b=1;
 var r=Math.min(80,span*3.5+2),out=[];for(var i=0;i<fs.length;i++){var b=fs[i]._b,lo0=b[0][0],lo1=b[1][0],la0=b[0][1],la1=b[1][1];if(la1<S.phi-r||la0>S.phi+r)continue;
  var wrapB=lo1<lo0;if(!wrapB&&(wrap(S.lam-lo0)<-r&&wrap(S.lam-lo1)<-r||wrap(lo0-S.lam)>r&&wrap(lo1-S.lam)>r)&&!(lo0<=S.lam&&S.lam<=lo1))continue;out.push(fs[i])}
 return fc.features?{type:'FeatureCollection',features:out}:{type:'GeometryCollection',geometries:out}}
function draw(now){
 var d3=window.d3,R=Math.exp(S.lnR)*FIT,m=J[S.mode];
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=PAPER;ctx.fillRect(0,0,cv.width,cv.height);ctx.setTransform(scaleK,0,0,scaleK,0,0);

 if(R<1200){ctx.save();ctx.setLineDash([1,4]);ctx.strokeStyle='rgba(36,32,26,.16)';ctx.beginPath();ctx.arc(CX,360,R+12,0,2*Math.PI);ctx.stroke();ctx.restore()}
 if(!d3)return {R:R,st:15,note:'LOADING…'};
 var pr=makeProj(d3,R);if(R>700)pr.clipExtent([[-60,-60],[VW+60,780]]);var path=d3.geoPath(pr);ctx.beginPath();if(R>1500)ctx.rect(-10,-10,VW+20,740);else{path.context(ctx)({type:'Sphere'});path.context(null)}ctx.fillStyle=CFG.seaFill||PAPER;ctx.fill();if(R<2600){ctx.globalAlpha=.55*clamp((2600-R)/900,0,1);ctx.fillStyle=patF;ctx.fill();ctx.globalAlpha=1}
 var span=Math.min(90,(420*Math.max(1,VW/720)/R)/D),st=15,steps=[.1,.25,.5,1,2,5,10,15],i;
 if(R>=700){for(i=0;i<steps.length;i++){if(steps[i]>=span/4){st=steps[i];break}}}
 var gr=d3.geoGraticule().step([st,st]).precision(Math.min(2.5,st/4));
 if(R>=700)gr.extent([[Math.floor((S.lam-span*2)/st)*st,Math.max(-89.9,Math.floor((S.phi-span*1.6)/st)*st)],[S.lam+span*2+st,Math.min(89.9,S.phi+span*1.6+st)]]);else gr.extent([[-180,-80],[180,80.01]]);
 ctx.strokeStyle='rgba(36,32,26,.22)';ctx.lineWidth=.55;ctx.beginPath();path.context(ctx)(gr());ctx.stroke();path.context(null);
 var B=CFG.box,inBox=S.lam>B[0]&&S.lam<B[2]&&S.phi>B[1]&&S.phi<B[3];
 var land=null,note='';if(R>1000&&data.region&&inBox){land=data.region;note='COAST 1:10M'}else if(data.l110){land=R>900?nearLand(data.l110,span):data.l110;note='COAST 1:110M'}
 var pxr=R*D*2.5,key=Math.round(S.lam*pxr)+'|'+Math.round(S.phi*pxr)+'|'+Math.round(Math.log(R)*400)+'|'+note+'|'+cv.width;
 if(key!==landKey){landKey=key;var ds=land?path(land):null;landPath=ds?new Path2D(ds):null;
  ovP=null;if(data.overlay&&R>700){var od={lake:'',river:'',border:''};data.overlay.features.forEach(function(f){var d=path(f);if(d)od[f.properties.k]+=d});ovP={lake:new Path2D(od.lake),river:new Path2D(od.river),border:new Path2D(od.border)}}}
 function engrave(p){ctx.lineJoin='round';ctx.strokeStyle=patW;ctx.globalAlpha=.6;ctx.lineWidth=18;ctx.stroke(p);ctx.globalAlpha=1}
 if(landPath){engrave(landPath);ctx.fillStyle=CFG.landFill||PAPER;ctx.fill(landPath);
  ctx.save();ctx.clip(landPath);ctx.strokeStyle=patH;ctx.globalAlpha=.75;ctx.lineWidth=11;ctx.stroke(landPath);ctx.restore();ctx.globalAlpha=1;
  ctx.strokeStyle=INK;ctx.lineWidth=1.15;ctx.stroke(landPath)}
 if(ovP){ctx.save();ctx.setLineDash([5,3,1,3]);ctx.strokeStyle='rgba(36,32,26,.45)';ctx.lineWidth=1;ctx.stroke(ovP.border);ctx.restore();
  ctx.strokeStyle=CFG.riverInk||'rgba(62,85,96,.6)';ctx.lineWidth=1.1;ctx.stroke(ovP.river);
  ctx.save();ctx.clip(ovP.lake);ctx.fillStyle=CFG.seaFill||PAPER;ctx.fill(ovP.lake);ctx.globalAlpha=.55;ctx.fillStyle=patF;ctx.fill(ovP.lake);ctx.globalAlpha=1;engrave(ovP.lake);ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(-100,-100,VW+200,920);ctx.clip();ctx.strokeStyle=patH;ctx.globalAlpha=.5;ctx.lineWidth=12;ctx.stroke(ovP.lake);ctx.restore();ctx.globalAlpha=1;
  ctx.strokeStyle=INK;ctx.lineWidth=1.1;ctx.stroke(ovP.lake)}
 ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle=CFG.lineInk||'#A8843F';ctx.lineWidth=1.6;ctx.beginPath();path.context(ctx)({type:'LineString',coordinates:[[-180,0],[-90,0],[0,0],[90,0],[180,0]]});ctx.stroke();path.context(null);ctx.restore();
 if(R<1400){var g=ctx.createRadialGradient(CX,360,R*.72,CX,360,R);g.addColorStop(0,'rgba(36,32,26,0)');g.addColorStop(1,'rgba(36,32,26,.12)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(CX,360,R,0,2*Math.PI);ctx.fill()}
 if(R<=1500){ctx.strokeStyle=INK;ctx.lineWidth=1.4;ctx.beginPath();path.context(ctx)({type:'Sphere'});path.context(null);ctx.stroke()}
 function at(c){if(d3.geoDistance([c[1],c[0]],[S.lam,S.phi])>VIS)return null;var q=pr([c[1],c[0]]);if(!q||Math.abs(q[0]-CX)>VW||Math.abs(q[1]-360)>900)return null;return q}
 function dot(c,r,fill,stroke,lw){var q=at(c);if(!q)return null;ctx.beginPath();ctx.arc(q[0],q[1],r,0,2*Math.PI);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1.5;ctx.stroke()}return q}
 function line(pts,color,lw,dash,alpha){ctx.save();ctx.globalAlpha=alpha==null?1:alpha;ctx.setLineDash(dash||[]);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();path.context(ctx)(geoLine(pts));ctx.stroke();path.context(null);ctx.restore()}
 (CFG.places||[]).forEach(function(p){if(R<(p.minR||0))return;var q=at(p.c);if(q){ctx.save();ctx.font="600 "+(p.size||15)+"px "+FT;ctx.textAlign='center';ctx.fillStyle='rgba(36,32,26,.62)';ctx.fillText(p.n.split('').join(String.fromCharCode(8202)),q[0],q[1]);ctx.restore()}});
 if(R>2600){var eq=at([0,S.lam+span*.85]);if(eq)label('0°00′ — The Line',eq[0]+6,eq[1]-9,CFG.lineInk||'#A8843F',true)}
 var u=S.phase==='fly'?0:S.u,f=u*m.n,li=Math.min(m.n-1,Math.floor(f)),r=f-li;
 m.legs.forEach(function(lp,j){var md=m.wp[j+1].m;line(lp,COL[md],1.5,md==='l'?[1,4]:(DASH[md].length?DASH[md]:[1,4]),.4)});
 if(u>.0005){m.legs.forEach(function(lp,j){var md=m.wp[j+1].m,seg=j<li?lp:(j===li?partU(lp,r):null);if(!seg)return;line(seg,PAPER,8);line(seg,COL[md],md==='a'?2.2:3.1,DASH[md])})}
 var drawn={},big=R>900;m.wp.forEach(function(w,j){var id=w.c.join();if(drawn[id])return;drawn[id]=1;var col=COL[(j?w.m:m.wp[1].m)],done=S.phase!=='fly'&&j<=S.k;var q=dot(w.c,big?10:4.6,done?col:PAPER,col,1.7);
  if(q&&big){ctx.font="700 11px 'Courier Prime', monospace";ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=done?PAPER:col;ctx.fillText(String(w.d),q[0],q[1]+.5);ctx.textAlign='start';ctx.textBaseline='alphabetic'}});
 if(S.phase==='hold'){var w=m.wp[Math.min(S.k,m.n)],q=at(w.c);if(q){var rc=COL[S.k>0?w.m:m.wp[1].m]||INK;if(S.arrT<1.6&&!reduce){for(var ri=0;ri<2;ri++){var ph=clamp((S.arrT-ri*.35)/1.2,0,1);if(ph<=0||ph>=1)continue;ctx.save();ctx.globalAlpha=(1-ph)*.7;ctx.strokeStyle=rc;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(q[0],q[1],10+ph*34,0,7);ctx.stroke();ctx.restore()}}
  ctx.save();ctx.globalAlpha=clamp(S.t/.5,0,1);label(w.n.split(' — ').pop(),q[0]+15,q[1]-13,INK,true);ctx.restore()}}
 var md2=m.wp[Math.min(m.n,li+1)].m,hq=at(sampleAt(m.pts,u));
 if(hq){var hp2=at(sampleAt(m.pts,Math.min(1,u+.003))),ang=hp2?Math.atan2(hp2[1]-hq[1],hp2[0]-hq[0]):0;var vm=S.phase==='leg'?md2:(S.k>0?m.wp[Math.min(S.k,m.n)].m:md2);if(S.phase!=='leg'&&S.lastAng!=null)ang=S.lastAng;if(S.phase==='leg')S.lastAng=ang;
  var alt=S.phase==='leg'&&(md2==='a'||md2==='h')?Math.sin(Math.PI*(S.legU||0)):0;if(S.phase==='leg'){var hr=26+8*Math.sin(now/380),hg=ctx.createRadialGradient(hq[0],hq[1],0,hq[0],hq[1],hr);hg.addColorStop(0,'rgba(255,253,246,.85)');hg.addColorStop(1,'rgba(255,253,246,0)');ctx.fillStyle=hg;ctx.beginPath();ctx.arc(hq[0],hq[1],hr,0,7);ctx.fill();vehicle(vm,hq[0],hq[1],ang,alt,now,true)}
  else{var mc=COL[vm]||INK;dot(sampleAt(m.pts,u),7,PAPER,mc,3.2);dot(sampleAt(m.pts,u),2.4,mc)}}
 var vg=ctx.createRadialGradient(CX,360,Math.min(VW,720)*.42,CX,360,Math.max(VW,720)*.78);vg.addColorStop(0,'rgba(36,32,26,0)');vg.addColorStop(1,'rgba(36,32,26,.13)');ctx.fillStyle=vg;ctx.fillRect(0,0,VW,720);
 var DT=(CFG.routes[S.mode].dt||{})[S.cardD];if(DT&&S.cardT<3.6&&S.phase!=='intro'){var ca2=Math.min(clamp(S.cardT/.5,0,1),clamp((3.6-S.cardT)/.7,0,1)),yy=640-(1-ca2)*8;ctx.save();ctx.globalAlpha=ca2;ctx.textAlign='center';
  ctx.font="italic 600 30px "+FD;var tw=Math.min(VW-60,ctx.measureText(DT).width+90);var bg=ctx.createLinearGradient(CX-tw/2-60,0,CX+tw/2+60,0);bg.addColorStop(0,'rgba(251,248,242,0)');bg.addColorStop(.18,'rgba(251,248,242,.92)');bg.addColorStop(.82,'rgba(251,248,242,.92)');bg.addColorStop(1,'rgba(251,248,242,0)');ctx.fillStyle=bg;ctx.fillRect(CX-tw/2-60,yy-50,tw+120,74);
  ctx.fillStyle=CFG.roseInk||INK;ctx.font="700 12px 'Courier Prime', monospace";var dl='D A Y   '+pad(S.cardD,2);ctx.fillText(dl,CX,yy-26);ctx.strokeStyle=CFG.roseInk||INK;ctx.lineWidth=1;var dw=ctx.measureText(dl).width/2+12;ctx.beginPath();ctx.moveTo(CX-dw-60*ca2,yy-30);ctx.lineTo(CX-dw,yy-30);ctx.moveTo(CX+dw,yy-30);ctx.lineTo(CX+dw+60*ca2,yy-30);ctx.stroke();
  ctx.fillStyle=INK;ctx.font="italic 600 30px "+FD;ctx.fillText(DT,CX,yy+8);ctx.restore()}
 ctx.save();ctx.beginPath();ctx.arc(VW-70,600,46,0,7);ctx.fillStyle=''+(CFG.roseBg||'rgba(249,248,243,.82)')+'';ctx.fill();ctx.restore();rose();
 ctx.save();ctx.textAlign='right';ctx.font="italic 600 17px "+FD;ctx.lineWidth=4;ctx.strokeStyle=PAPER;ctx.strokeText(CFG.cartouche||'James Wild & Co.',VW-14,704);ctx.fillStyle=INK;ctx.fillText(CFG.cartouche||'James Wild & Co.',VW-14,704);ctx.restore();
 return {R:R,st:st,note:note||'LOADING COASTLINES…'};
}
var el=function(id){return document.getElementById(id)};
var cache={};function setText(id,v){if(cache[id]!==v){cache[id]=v;el(id).textContent=v}}
function syncButtons(){document.querySelectorAll('[data-route]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.route===S.mode))});
 document.querySelectorAll('[data-speed]').forEach(function(b){b.setAttribute('aria-pressed',String(+b.dataset.speed===S.speed))})}
function buildUI(){var m=J[S.mode],days=el('days'),led=el('ledger');days.innerHTML='';led.innerHTML='';
 if(el('routeTitle'))setText('routeTitle',m.title);if(el('routeSub'))setText('routeSub',m.sub);
 m.days.forEach(function(d){var b=document.createElement('button');b.type='button';b.textContent=(CFG.dayWord||'D')+pad(d,2);b.dataset.d=d;b.setAttribute('aria-label','Day '+d);b.addEventListener('click',function(){showDay(d)});days.appendChild(b)});
 m.wp.forEach(function(w,i){var li=document.createElement('li'),rb=document.createElement('button');rb.type='button';
  rb.innerHTML='<span class="n"></span><span class="c"></span><span class="p"></span>';var col=COL[i?w.m:m.wp[1].m];
  var n=rb.querySelector('.n');n.textContent='D'+pad(w.d,2)+(w.t?' '+w.t:'');n.style.color=col;n.style.borderColor=col;
  rb.querySelector('.c').textContent=coord(w.c)+(i?'  · '+({s:'by sea',w:'by boat',l:'by road',f:'on foot',a:'by air'})[w.m]:'');
  rb.querySelector('.p').textContent=w.n;rb.addEventListener('click',function(){jump(i)});li.appendChild(rb);led.appendChild(li)});cache.on=null}
function updatePanel(info){var m=J[S.mode];
 setText('hZoom','ZOOM ×'+Math.max(1,Math.round(info.R/270)));setText('hStep','GRATICULE '+info.st+'°');setText('hCentre','CENTRE '+coord([S.phi,S.lam]));setText('hNote',info.note);
 setText('play',S.playing?'PAUSE':'PLAY');
 var u=S.phase==='fly'?0:S.u,kk=Math.min(S.k,m.n),li=Math.min(m.n-1,Math.floor(u*m.n+1e-9)),md=m.wp[li+1].m,w=m.wp[kk];
 setText('cx',coord(headAt(m,u)));el('cx').style.color=COL[S.phase==='leg'?md:(kk?w.m:'s')];
 var status,day,way;
 if(S.phase==='intro'){status='THE GLOBE';day='DAY '+pad(m.wp[0].d,2);way='Finding '+(CFG.placeName||m.wp[0].n.split(' — ')[0])+' on the globe'}else if(S.phase==='fly'){status='SETTING COURSE';day='DAY '+pad(m.wp[0].d,2);way='Bound for '+m.wp[0].n}
 else if(S.phase==='hold'){day='DAY '+pad(w.d,2)+(w.t?' · '+w.t:'');status=S.playing?(CFG.holdWord||'AT ANCHOR'):'PAUSED';way=w.n}
 else{var nw=m.wp[S.k+1];day='DAY '+pad(m.wp[S.k].d,2)+(nw.d!==m.wp[S.k].d?' → '+pad(nw.d,2):'');status=S.playing?MODEWORD[md]:'PAUSED';way=m.wp[S.k].n.split(' — ').pop()+'  →  '+nw.n.split(' — ').pop()}
 if(S.manual)status='BY HAND';setText('day',day);setText('status',status);setText('way',way);
 var on=S.phase==='fly'?-1:kk;if(cache.on!==on+'|'+S.phase){cache.on=on+'|'+S.phase;var cd=on>=0?m.wp[on].d:-1;
  Array.prototype.forEach.call(el('days').children,function(b){var d=+b.dataset.d;b.setAttribute('aria-pressed',String(d===cd));b.classList.toggle('passed',S.phase!=='fly'&&on>=0&&d<cd)});
  Array.prototype.forEach.call(el('ledger').querySelectorAll('button'),function(b,i){b.classList.toggle('on',i===on)})}}
document.querySelectorAll('[data-route]').forEach(function(b){b.addEventListener('click',function(){setMode(b.dataset.route)})});
document.querySelectorAll('[data-speed]').forEach(function(b){b.addEventListener('click',function(){S.speed=+b.dataset.speed;syncButtons()})});
el('play').addEventListener('click',function(){S.playing=!S.playing;if(S.playing){S.manual=false;S.follow=null}});
el('prev').addEventListener('click',function(){S.follow=null;jump(S.phase==='leg'?S.k:S.k-1)});
el('next').addEventListener('click',function(){S.follow=null;jump(S.k+1)});
function zoomBy(z){S.manual=true;S.playing=false;S.lnR=clamp(S.lnR+z,Math.log(200),Math.log(CFG.zoomMax||90000))}
el('zin').addEventListener('click',function(){zoomBy(.45)});el('zout').addEventListener('click',function(){zoomBy(-.45)});
stage.addEventListener('wheel',function(e){e.preventDefault();zoomBy(-e.deltaY*.0018)},{passive:false});
var drag=null;
stage.addEventListener('pointerdown',function(e){if(e.target.closest('button'))return;drag={x:e.clientX,y:e.clientY,lam:S.lam,phi:S.phi,id:e.pointerId,moved:false}});
stage.addEventListener('pointermove',function(e){if(!drag||e.pointerId!==drag.id)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(!drag.moved&&Math.hypot(dx,dy)<4)return;if(!drag.moved){drag.moved=true;stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');S.manual=true;S.playing=false}
 var R=Math.exp(S.lnR)*FIT,px=(stage.clientHeight||stage.clientWidth)/720,dpp=(1/(R*px))/D;S.lam=wrap(drag.lam-dx*dpp);S.phi=clamp(drag.phi+dy*dpp,-85,85)});
function endDrag(){drag=null;stage.classList.remove('dragging')}
stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);
stage.setAttribute('tabindex','0');stage.addEventListener('keydown',function(e){var k=e.key;if(k===' '){e.preventDefault();el('play').click()}else if(k==='ArrowRight'){e.preventDefault();el('next').click()}else if(k==='ArrowLeft'){e.preventDefault();el('prev').click()}else if(k==='+'||k==='='){zoomBy(.45)}else if(k==='-'){zoomBy(-.45)}});
var fsb=el('fs');if(fsb){var host=el('chart')||stage;var canFs=!!(host.requestFullscreen||host.webkitRequestFullscreen);if(!canFs)fsb.hidden=true;fsb.addEventListener('click',function(){try{var fe=document.fullscreenElement||document.webkitFullscreenElement;if(fe){(document.exitFullscreen||document.webkitExitFullscreen).call(document)}else{var p=(host.requestFullscreen||host.webkitRequestFullscreen).call(host);if(p&&p.catch)p.catch(function(){fsb.hidden=true})}}catch(err){fsb.hidden=true}})}
window.chartDay=function(k,d){if(!J[k])return;if(S.mode!==k)setMode(k,true,true);showDay(d)};
window.chartRoute=function(k,scroll){if(J[k]){if(S.mode!==k)setMode(k,false,false);if(scroll)stage.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'})}};
[['l110',CFG.globe||'data/land-110m.geo.json'],['region',CFG.region],['overlay',CFG.overlay],['contours',CFG.contours],['terrain',CFG.terrain&&CFG.terrain.src]].forEach(function(p){if(!p[1])return;fetch(p[1]).then(function(r){return r.json()}).then(function(j){if(p[0]==='region'&&j&&j.features)j={type:'FeatureCollection',features:j.features.filter(function(f){var L=f.properties&&f.properties.layer;return !L||L==='land'})};if(p[0]==='terrain')j=j.map(function(q){return {c:[q[0],q[1]],v:toV(q[1],q[0]),t:q[2],l:q[3]}});data[p[0]]=j;landKey=''}).catch(function(){})});
var IMG=null;if(CFG.img){var im=new Image();im.onload=function(){var c=document.createElement('canvas');c.width=im.width;c.height=im.height;var x=c.getContext('2d');var f=Math.round(Math.min(im.width,im.height)*.07);
 x.filter='blur('+Math.round(f*.6)+'px)';x.fillStyle='#000';x.fillRect(f,f,im.width-2*f,im.height-2*f);x.filter='none';x.globalCompositeOperation='source-in';x.drawImage(im,0,0);IMG=c};im.src=CFG.img.src}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){landKey=''});
var visible=true;if('IntersectionObserver' in window){new IntersectionObserver(function(es){visible=es[0].isIntersecting}).observe(stage)}
var last=0;function frame(now){var rdt=last?clamp((now-last)/1000,0,.1):0;last=now;requestAnimationFrame(frame);if(!document.hidden&&visible){step(rdt);var info=draw(now);updatePanel(info)}}
setMode(KEYS[0]);requestAnimationFrame(frame);
})();

  }

  window.JWChart = { mount: mount, adapt: adapt, palette: PALETTE };
})();
