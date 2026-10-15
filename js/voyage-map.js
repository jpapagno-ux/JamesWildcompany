(()=>{
'use strict';
const svg=document.getElementById('journey-map');if(!svg)return;
const NS='http://www.w3.org/2000/svg';
const create=(tag,attrs,parent=svg)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n};
const project=([lon,lat])=>[75+(lon+79)*22,45+(-50-lat)*37];
const coords=[[-70.917,-53.163],[-71.3,-53.9],[-69.95,-54.74],[-68.303,-54.801],[-63,-58],[-58.5,-62.15],[-61,-63.25],[-63.3,-64.25],[-58.986,-62.191],[-70.855,-53.003]];
const stages=[
 {day:'Day 01',name:'Punta Arenas · The departure',mode:'vessel',text:'Begin by ship, following the Strait of Magellan toward Cape Froward.',start:0,end:2},
 {day:'Day 02',name:'Southern Patagonia',mode:'vessel',text:'Glacier Alley, with a possible Zodiac outing at Garibaldi Glacier.',start:2,end:3},
 {day:'Day 03',name:'Ushuaia · Beagle Channel',mode:'vessel',text:'Time in Ushuaia before continuing toward Antarctica.',start:3,end:4},
 {day:'Days 04–05',name:'Drake Passage',mode:'vessel',text:'The southbound ocean crossing toward the South Shetland Islands.',start:4,end:6},
 {day:'Days 06–08',name:'Antarctic exploration',mode:'vessel',text:'A schematic peninsula loop. The expedition team chooses actual sites according to conditions.',start:6,end:9},
 {day:'Day 09',name:'King George Island · Return flight',mode:'plane',text:'Disembark and take the scheduled flight back to Punta Arenas.',start:9,end:10},
 {day:'Day 10',name:'Punta Arenas · Onward',mode:'complete',text:'Breakfast and an airport transfer complete the programme.',start:10,end:10}
];
// More route vertices than stage boundaries allow the sailing trace to follow the coast in overview.
const route=[coords[0],[-71.25,-53.55],coords[1],coords[2],coords[3],[-66.5,-55.2],coords[4],coords[5],coords[6],coords[7],[-62.5,-64.55],[-61.5,-63.5],coords[8]];
const paths=[route.slice(0,3),route.slice(2,4),route.slice(3,5),route.slice(4,8),route.slice(7),[coords[8],[-61.8,-59.8],[-65.5,-56.8],coords[9]],[coords[9],coords[9]]];
const ocean=create('rect',{width:900,height:800,fill:'#303b44'});
const grids=create('g',{'stroke':'#8ca5b5','stroke-width':.5,opacity:.20});
for(let lon=-80;lon<=-40;lon+=5){let[x]=project([lon,-50]);create('line',{x1:x,y1:0,x2:x,y2:800},grids);create('text',{x:x+4,y:23,fill:'#b3c9d7',stroke:'none','font-size':10},grids).textContent=Math.abs(lon)+'°W'}
for(let lat=-50;lat>=-70;lat-=2){let[,y]=project([-79,lat]);create('line',{x1:0,y1:y,x2:900,y2:y},grids);create('text',{x:8,y:y-6,fill:'#b3c9d7',stroke:'none','font-size':10},grids).textContent=Math.abs(lat)+'°S'}
const land=create('g',{fill:'#617480',stroke:'#8c9eaa','stroke-width':.7});
for(const f of window.JOURNEY_LAND.features){let polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const poly of polys){if(!poly.some(r=>r.some(p=>p[0]>-82&&p[0]<-44&&p[1]>-72&&p[1]<-49)))continue;let d=poly.map(r=>'M'+r.map(p=>project(p).join(',')).join('L')+'Z').join('');create('path',{d,'fill-rule':'evenodd'},land)}}
const line=(points)=>'M'+points.map(p=>project(p).join(',')).join('L');
paths.slice(0,6).forEach((p,i)=>create('path',{d:line(p),fill:'none',stroke:i===5?'#c3dce9':'#a9becb','stroke-width':i===5?1.4:1.7,'stroke-dasharray':i===5?'6 7':'none',opacity:.45}));
const trace=create('path',{d:'',fill:'none',stroke:'#e1f2fc','stroke-width':2.5,'stroke-linecap':'round'});
const locations=[['Punta Arenas',coords[0],-18,-15,'end'],['Cape Froward',coords[1],-16,18,'end'],['Garibaldi Glacier',coords[2],-18,27,'end'],['Ushuaia',coords[3],16,0,'start'],['King George Island',coords[8],15,-14,'start'],['Antarctic Peninsula',[-61.5,-65.7],-13,10,'end']];
for(const[name,p,dx,dy,anchor]of locations){const[x,y]=project(p);create('circle',{cx:x,cy:y,r:3,fill:'#dae9f1'});create('text',{x:x+dx,y:y+dy,fill:'#e0eaf0','font-size':12,'text-anchor':anchor,style:'paint-order:stroke;stroke:#303b44;stroke-width:3px'},svg).textContent=name}
create('text',{x:520,y:380,fill:'#a9c0d0','font-size':13,'letter-spacing':3,transform:'rotate(-28 520 380)'}).textContent='DRAKE PASSAGE';
const marker=create('g',{'aria-hidden':'true'});create('circle',{r:22,fill:'#303b44',stroke:'#d1e5f2','stroke-width':1},marker);
const ship=create('g',{},marker);create('path',{d:'M-13 4H13L8 12H-7ZM-8 1V-7H7V1M-3-8V-12H3V-8',fill:'none',stroke:'#e7f3fa','stroke-width':1.7,'stroke-linejoin':'round'},ship);
const plane=create('path',{d:'M0-16L3-3L15 4V7L3 3L2 12L7 15V17L0 15L-7 17V15L-2 12L-3 3L-15 7V4L-3-3Z',fill:'#e7f3fa',display:'none'},marker);
const pause=document.getElementById('route-play'),replay=document.getElementById('route-replay'),range=document.getElementById('route-progress'),readout=document.getElementById('route-coordinates'),headline=document.getElementById('route-heading'),copy=document.getElementById('route-copy'),mode=document.getElementById('route-mode');
const buttons=[...document.querySelectorAll('[data-route-stage]')];let value=0,playing=false,last=0,raf=0;
const fmt=(n,pos,neg)=>Math.abs(n).toFixed(3)+'°'+(n>=0?pos:neg);
function pointAlong(points,t){let lengths=points.slice(1).map((p,i)=>Math.hypot(...project(p).map((v,j)=>v-project(points[i])[j]))),total=lengths.reduce((a,b)=>a+b,0),target=t*total;for(let i=0;i<lengths.length;i++){if(target<=lengths[i]||i===lengths.length-1){let f=lengths[i]?target/lengths[i]:0;return{coord:points[i].map((v,j)=>v+(points[i+1][j]-v)*f),index:i,f}}target-=lengths[i]}return{coord:points[0],index:0,f:0}}
function render(){let stage=Math.min(6,Math.floor(value)),t=stage===6?0:value-stage,s=stages[stage],p=pointAlong(paths[stage],t),[x,y]=project(p.coord);marker.setAttribute('transform',`translate(${x} ${y})`);ship.style.display=s.mode==='plane'?'none':'';plane.style.display=s.mode==='plane'?'':'none';if(s.mode==='plane'){let a=project(paths[stage][p.index]),b=project(paths[stage][Math.min(p.index+1,paths[stage].length-1)]);plane.setAttribute('transform',`rotate(${Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI+90})`)}let d=paths.slice(0,Math.min(stage,6)).map(line).join(' ');if(stage<6)d+=' '+line([...paths[stage].slice(0,p.index+1),p.coord]);trace.setAttribute('d',d);range.value=value;headline.textContent=s.day+' / '+s.name;copy.textContent=s.text;mode.textContent=s.mode==='plane'?'By air · scheduled return':s.mode==='complete'?'Journey complete':'By sea · Magellan Discoverer';readout.textContent=fmt(p.coord[1],'N','S')+' / '+fmt(p.coord[0],'E','W');buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===stage));b.classList.toggle('is-active',i===stage)})}
function tick(now){if(!playing)return;if(last)value=Math.min(6,value+(now-last)/6000);last=now;render();if(value>=6){playing=false;pause.textContent='Play journey';return}raf=requestAnimationFrame(tick)}
function setPlaying(on){playing=on;last=0;pause.textContent=on?'Pause journey':'Play journey';cancelAnimationFrame(raf);if(on){if(value>=6)value=0;raf=requestAnimationFrame(tick)}}
pause.addEventListener('click',()=>setPlaying(!playing));replay.addEventListener('click',()=>{value=0;render();setPlaying(true)});range.addEventListener('input',()=>{setPlaying(false);value=Number(range.value);render()});buttons.forEach((b,i)=>b.addEventListener('click',()=>{setPlaying(false);value=i;render()}));document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false)});render();
// Begin on entry only once. Reduced-motion users keep a static, fully usable map.
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const obs=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setPlaying(true);obs.disconnect()}},{threshold:.25});obs.observe(svg)}
window.voyageRoute={stages,paths,project};
})();
