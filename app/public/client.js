import {setup,applyAction,viewFor} from "/physics.js";
const $=id=>document.getElementById(id), colors=["#69fbe0","#ff9d65","#f88ac9","#cfddff"];
const canvas=$("world"),ctx=canvas.getContext("2d",{alpha:false});
let W=0,H=0,ratio=1,quality="auto",fps=60,frameCount=0,fpsAt=performance.now(),prev=performance.now();
let mode="home",socket=null,room="",you="",snapshot=null,localState=null,lastRecv=0,online=[],retries=0,closed=false;
let visualZ=200,visualX=0,visualSpeed=65,lastSend=0,uiAt=0,toastAt=0,renderAt=0,soundOn=false;
const keys=new Set(),touch={left:false,right:false,brake:false,boost:false};
let gas=true,reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
$("reduced").checked=reduced;
const sprites=[],lamp=document.createElement("canvas"),sky=document.createElement("canvas");
let audioCtx,osc,gain;
function rounded(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function poly(c,pts,fill){c.beginPath();c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);c.closePath();c.fillStyle=fill;c.fill();}
function carSprite(color){
 const c=document.createElement("canvas");c.width=340;c.height=220;const g=c.getContext("2d");
 let grd=g.createRadialGradient(170,175,4,170,175,156);grd.addColorStop(0,color+"66");grd.addColorStop(1,color+"00");
 g.fillStyle=grd;g.fillRect(0,40,340,180);g.fillStyle="#03060dc9";g.beginPath();g.ellipse(170,184,138,20,0,0,Math.PI*2);g.fill();
 g.fillStyle="#030609";rounded(g,43,118,37,70,9);g.fill();rounded(g,260,118,37,70,9);g.fill();
 g.fillStyle="#253345";g.fillRect(49,139,8,35);g.fillRect(283,139,8,35);
 grd=g.createLinearGradient(0,70,0,185);grd.addColorStop(0,color);grd.addColorStop(.45,color);grd.addColorStop(.48,"#30454c");grd.addColorStop(.5,color);grd.addColorStop(1,"#112b34");
 poly(g,[69,101,94,64,123,49,218,49,247,65,271,101,289,124,283,170,265,181,73,181,55,171,51,125],grd);
 poly(g,[97,91,111,64,229,64,245,91],"#06121e");
 let glass=g.createLinearGradient(0,59,0,96);glass.addColorStop(0,"#4a7083");glass.addColorStop(1,"#0c1b2e");
 poly(g,[116,63,224,63,239,88,103,88],glass);
 g.strokeStyle="#9ee8ee70";g.lineWidth=2;g.beginPath();g.moveTo(117,63);g.lineTo(220,63);g.stroke();
 poly(g,[71,102,270,102,283,123,56,123],color);
 g.strokeStyle="#ffffff4b";g.beginPath();g.moveTo(78,99);g.lineTo(261,99);g.stroke();
 poly(g,[56,127,283,127,278,162,64,162],"#142230");
 poly(g,[64,129,131,131,129,144,67,141],"#ff4c6c");
 poly(g,[208,131,276,129,273,141,210,144],"#ff4c6c");
 g.fillStyle="#ffd1db";g.fillRect(69,131,57,3);g.fillRect(214,131,57,3);
 g.fillStyle="#060b12";rounded(g,132,132,72,21,3);g.fill();g.fillStyle="#8498a4";g.fillRect(151,138,34,7);
 poly(g,[61,161,278,161,264,177,78,177],"#050b12");
 g.fillStyle="#627381";g.fillRect(86,165,25,8);g.fillRect(227,165,25,8);g.fillStyle="#0a1521";g.fillRect(89,167,19,4);g.fillRect(230,167,19,4);
 for(let j=0;j<8;j++)g.fillRect(138+j*7,164,3,13);
 g.fillStyle="#0b1725";g.fillRect(88,106,8,12);g.fillRect(244,106,8,12);
 poly(g,[62,103,277,103,283,111,56,111],"#071421");g.fillStyle=color;g.fillRect(67,103,205,2);
 g.fillStyle="#8fffe955";g.fillRect(75,179,190,2);return c;
}
colors.forEach(c=>sprites.push(carSprite(c)));
lamp.width=128;lamp.height=128;{const g=lamp.getContext("2d");const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,"#b6fffbcc");r.addColorStop(.1,"#6efbe888");r.addColorStop(.4,"#30eedc22");r.addColorStop(1,"#29d6ff00");g.fillStyle=r;g.fillRect(0,0,128,128);}
function seeded(i){return ((Math.sin(i*127.1+47)*43758.5453)%1+1)%1;}
function createSky(){
 sky.width=1800;sky.height=700;const c=sky.getContext("2d"),gr=c.createLinearGradient(0,0,0,700);
 gr.addColorStop(0,"#080c20");gr.addColorStop(.5,"#272447");gr.addColorStop(.8,"#564660");gr.addColorStop(1,"#326979");c.fillStyle=gr;c.fillRect(0,0,1800,700);
 for(let i=0;i<120;i++){c.fillStyle="rgba(200,225,255,"+(seeded(i)*.45)+")";c.fillRect(seeded(i+12)*1800,seeded(i+244)*470,1.3,1.3);}
 const halo=c.createRadialGradient(1230,190,3,1230,190,160);halo.addColorStop(0,"#86b6d522");halo.addColorStop(1,"#789cdb00");c.fillStyle=halo;c.fillRect(1000,0,450,380);c.fillStyle="#a4c5dc99";c.beginPath();c.arc(1230,190,29,0,Math.PI*2);c.fill();
 for(let layer=0;layer<3;layer++){
  for(let i=0;i<75;i++){const x=i*27+seeded(i+layer*50)*18,w=16+seeded(i+40)*35,h=40+seeded(i+layer*150+13)*240*(.6+layer*.25);
   const y=665-h+layer*8;c.fillStyle=["#293647","#192b3e","#0e2031"][layer];c.fillRect(x,y,w,h);
   if(h>200){c.fillStyle="#172a3b";c.fillRect(x+w*.4,y-22,w*.2,23);c.fillStyle="#79ead5";c.fillRect(x+w*.5,y-30,2,3);}
   for(let wy=y+8;wy<665;wy+=11)for(let wx=x+5;wx<x+w-3;wx+=8){if(seeded(wx+wy+layer)>.48){c.fillStyle=seeded(wx*wy)>.6?"#b19c7766":"#79d4ed35";c.fillRect(wx,wy,3,4);}}
   if(i%6===0){c.fillStyle=layer%2?"#ef80c388":"#73e9df88";c.fillRect(x+2,y+4,2,h-8);}
  }
 }
 c.fillStyle="#6dd4ca55";c.fillRect(0,682,1800,2);
}
createSky();
function resize(){
 W=innerWidth;H=innerHeight;
 const max=quality==="high"?1.7:quality==="low"?0.85:1.2;
 ratio=Math.min(devicePixelRatio||1,max,quality==="high"?2400/W:1700/W);
 canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
}
addEventListener("resize",resize);resize();
const points=Array.from({length:122},()=>({x:0,y:0,w:0,z:0,s:0}));
function project(depth,z,baseX,horizon,out){
 const s=22/(22+depth),a=z/260,b=(z+depth)/260;
 out.x=baseX+(Math.sin(b)-Math.sin(a)-Math.cos(a)*depth/260)*W*.47*s;
 out.y=horizon+(H-horizon)*s;out.w=W*.72*s;out.z=depth;out.s=s;return out;
}
function quad(x1,y1,w1,x2,y2,w2,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x1-w1,y1);ctx.lineTo(x1+w1,y1);ctx.lineTo(x2+w2,y2);ctx.lineTo(x2-w2,y2);ctx.closePath();ctx.fill();}
const temp={x:0,y:0,w:0,z:0,s:0};
function draw(now,dt){
 const racing=mode==="race", menu=!racing;
 if(menu){visualZ+=dt*32;visualX=0;visualSpeed=48;}
 const state=snapshot, mine=state?.cars.find(c=>c.id===you)??state?.cars[0];
 if(racing&&mine){
  const target=mine.z+((state.phase==="race"&&mine.finish===null)?mine.speed*Math.min(.11,(now-lastRecv)/1000):0);
  visualZ+=(target-visualZ)*Math.min(1,dt*12);
  const input=getInput();const px=mine.x+(input.steer*.035);
  visualX+=(px-visualX)*Math.min(1,dt*18);visualSpeed=mine.speed;
 }
 const horizon=H*(menu?.42:.37),baseX=W*(menu?.68:.5)-visualX*W*.13;
 ctx.fillStyle="#0a1423";ctx.fillRect(0,0,W,H);
 const skyH=horizon+H*.07,shift=Math.sin(visualZ/900)*W*.07;
 ctx.drawImage(sky,0,0,1800,700,-W*.15+shift,0,W*1.3,skyH);
 ctx.fillStyle="#0b1d2b";ctx.fillRect(0,horizon,W,H-horizon);
 const glow=ctx.createLinearGradient(0,horizon,0,H);glow.addColorStop(0,"#33506e55");glow.addColorStop(.5,"#0b172b00");ctx.fillStyle=glow;ctx.fillRect(0,horizon,W,H-horizon);
 for(let i=0;i<122;i++)project(i*5,visualZ,baseX,horizon,points[i]);
 for(let i=120;i>=0;i--){
  const near=points[i],far=points[i+1],stripe=Math.floor((visualZ+i*5)/16)%2===0;
  quad(near.x,near.y,near.w*1.23,far.x,far.y,far.w*1.23,stripe?"#132934":"#102432");
  quad(near.x,near.y,near.w*1.035,far.x,far.y,far.w*1.035,stripe?"#72c1cb":"#306680");
  quad(near.x,near.y,near.w,far.x,far.y,far.w,stripe?"#202b3c":"#1c2838");
  if(Math.floor((visualZ+i*5)/12)%2===0){
   for(const lane of [-.333,.333])quad(near.x+near.w*lane,near.y,near.w*.006,far.x+far.w*lane,far.y,far.w*.006,"#75889b77");
  }
  for(const edge of [-1,1])quad(near.x+near.w*edge*.98,near.y,near.w*.005,far.x+far.w*edge*.98,far.y,far.w*.005,"#75ffee99");
  if(Math.floor((visualZ+i*5)/40)!==Math.floor((visualZ+(i+1)*5)/40)){
   for(const edge of [-1,1]){
    const lx=near.x+near.w*1.17*edge,ly=near.y,hh=H*.33*near.s;
    ctx.strokeStyle="#47778b";ctx.lineWidth=Math.max(.6,3*near.s);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(lx,ly-hh);ctx.lineTo(lx-edge*near.w*.12,ly-hh-hh*.05);ctx.stroke();
    const lightX=lx-edge*near.w*.12,lightY=ly-hh-hh*.05;ctx.drawImage(lamp,lightX-45*near.s,lightY-45*near.s,90*near.s,90*near.s);
    ctx.fillStyle="#a9ffe9";ctx.fillRect(lightX-8*near.s,lightY,16*near.s,2*near.s);
   }
  }
  const world=Math.floor(visualZ+i*5);
  if(world%2400<5 && i>0){
   const tiles=10;
   for(let k=0;k<tiles;k++)quad(near.x-near.w+(k+.5)*near.w*2/tiles,near.y,near.w/tiles,far.x-far.w+(k+.5)*far.w*2/tiles,far.y,far.w/tiles,k%2?"#d3e4e7":"#0b1423");
  }
 }
 // Only the visible road sector is considered for obstacles and cars.
 for(let i=120;i>=1;i--){
  const near=points[i],depth=i*5;
  const world=visualZ+depth,local=((world%2400)+2400)%2400;
  for(let k=0;k<7;k++){
   if(Math.abs(local-(310+k*295))<2.5){
    const hx=k%3===0?0:k%3===1?-.63:.63;
    const x=near.x+near.w*hx,ww=near.w*.17,hh=near.s*H*.095;
    poly(ctx,[x-ww,near.y,x-ww*.82,near.y-hh,x+ww*.82,near.y-hh,x+ww,near.y],"#fca577");
    ctx.fillStyle="#322633";ctx.fillRect(x-ww*.77,near.y-hh*.75,ww*1.54,hh*.2);
    ctx.fillStyle="#fff2cc";ctx.fillRect(x-ww*.55,near.y-hh*.73,ww*.32,hh*.17);
   }
  }
  if(racing&&state)for(const c of state.cars){
   if(c.id===you)continue;
   const z=c.z+((state.phase==="race"&&c.finish===null)?c.speed*Math.min(.1,(now-lastRecv)/1000):0),relative=z-visualZ;
   if(relative>=depth-2.5&&relative<depth+2.5){
    const width=W*.25*near.s;ctx.drawImage(sprites[c.color%4],near.x+near.w*c.x-width/2,near.y-width*.58,width,width*.647);
    if(relative<180){ctx.font="bold "+Math.max(8,12*near.s)+"px Arial";ctx.textAlign="center";ctx.fillStyle=colors[c.color%4];ctx.fillText(c.name,near.x+near.w*c.x,near.y-width*.6);}
   }
  }
 }
 let carW=menu?Math.min(420,W*.33):Math.min(340,W*.3),carX=menu?W*.68:W*.5+visualX*W*.2,carY=menu?H*.83:H*.88;
 if(W<700){carW=menu?W*.53:W*.4;carX=menu?W*.77:W*.5+visualX*W*.21;}
 if(racing&&mine?.boost&&!reduced){
  const flicker=.75+Math.sin(now/35)*.25;ctx.fillStyle="#b3fff2aa";
  poly(ctx,[carX-carW*.22,carY-carW*.09,carX-carW*.17,carY-carW*.09,carX-carW*.19,carY+carW*.2*flicker],"#82faffbb");
  poly(ctx,[carX+carW*.22,carY-carW*.09,carX+carW*.17,carY-carW*.09,carX+carW*.19,carY+carW*.2*flicker],"#82faffbb");
  ctx.strokeStyle="#c4efff28";ctx.lineWidth=1;for(let i=0;i<14;i++){const angle=i*.4488,r=W*.35+(now/3+i*83)%200;ctx.beginPath();ctx.moveTo(W*.5+Math.cos(angle)*r,H*.5+Math.sin(angle)*r);ctx.lineTo(W*.5+Math.cos(angle)*(r+100),H*.5+Math.sin(angle)*(r+100));ctx.stroke();}
 }
 ctx.save();ctx.translate(carX,carY);
 const steer=racing?getInput().steer:0;ctx.rotate(reduced?0:steer*.023);
 if(mine?.hit>0&&racing)ctx.globalAlpha=.6+Math.sin(now/30)*.25;
 ctx.drawImage(sprites[racing?(mine?.color??0)%4:0],-carW/2,-carW*.55,carW,carW*.647);ctx.restore();
 if(menu){const rW=carW*.42;ctx.drawImage(sprites[1],W*.81-rW/2,H*.65-rW*.55,rW,rW*.647);}
}
function show(id,visible=true){$(id).classList.toggle("hidden",!visible);}
function toast(t){$("toast").textContent=t;$("toast").style.opacity="1";toastAt=performance.now();}
function clearControls(){keys.clear();for(const k in touch)touch[k]=false;document.querySelectorAll("[data-input]").forEach(e=>e.classList.remove("active"));if(mode==="race"&&!localState)send({type:"action",action:{type:"input",steer:0,throttle:0,brake:true,boost:false}});}
function getInput(){
 let steer=(keys.has("KeyD")||keys.has("ArrowRight")||touch.right?1:0)-(keys.has("KeyA")||keys.has("ArrowLeft")||touch.left?1:0);
 let brake=keys.has("KeyS")||keys.has("ArrowDown")||touch.brake;
 let boost=keys.has("ShiftLeft")||keys.has("ShiftRight")||keys.has("Space")||touch.boost;
 let throttle=gas||keys.has("KeyW")||keys.has("ArrowUp")?1:0;
 const pad=navigator.getGamepads?.()[0];
 if(pad){if(Math.abs(pad.axes[0]||0)>.15)steer=pad.axes[0];throttle=Math.max(throttle,pad.buttons[7]?.value||0);brake=brake||(pad.buttons[6]?.value||0)>.3;boost=boost||!!pad.buttons[0]?.pressed;}
 if(document.hidden || $("settings").classList.contains("hidden")===false)return {type:"input",steer:0,throttle:0,brake:true,boost:false};
 return {type:"input",steer,throttle:brake?0:throttle,brake,boost};
}
addEventListener("keydown",e=>{if(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)return;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)&&mode==="race")e.preventDefault();keys.add(e.code);});
addEventListener("keyup",e=>keys.delete(e.code));addEventListener("blur",clearControls);document.addEventListener("visibilitychange",()=>{if(document.hidden)clearControls();});
document.querySelectorAll("[data-input]").forEach(el=>{const key=el.dataset.input;el.addEventListener("pointerdown",e=>{e.preventDefault();el.setPointerCapture(e.pointerId);touch[key]=true;el.classList.add("active");});for(const evt of ["pointerup","pointercancel","lostpointercapture"])el.addEventListener(evt,()=>{touch[key]=false;el.classList.remove("active");});});
function send(msg){if(socket?.readyState===1)socket.send(JSON.stringify(msg));}
function token(){let t=sessionStorage.getItem("apex-session");if(!t){t=crypto.randomUUID();sessionStorage.setItem("apex-session",t);}return t;}
function connect(code){
 closed=false;room=code.toUpperCase();mode="lobby";localState=null;snapshot=null;show("home",false);show("joinPanel",false);show("lobby");show("hud",false);show("results",false);document.body.classList.remove("racing");
 $("roomCode").textContent=room;$("lobbyHint").textContent="Connecting to your private room…";$("start").disabled=true;
 history.replaceState(null,"","?room="+encodeURIComponent(room));socket?.close();
 const ws=new WebSocket((location.protocol==="https:"?"wss:":"ws:")+"//"+location.host+"/ws/"+room);socket=ws;
 ws.onopen=()=>{retries=0;send({type:"join",playerId:token()});$("connection").innerHTML="<i></i> ROOM CONNECTED";};
 ws.onmessage=e=>{
  if(e.data==="__pong")return;
  let msg;try{msg=JSON.parse(e.data);}catch{return;}
  if(msg.type==="error"){toast(msg.error);return;}
  if(msg.type!=="state"||socket!==ws)return;
  const prior=snapshot?.phase;you=msg.you;snapshot=msg.view;lastRecv=performance.now();online=msg.online??[];
  if(!snapshot)return;
  if(snapshot.phase==="lobby"){
   mode="lobby";show("lobby");show("hud",false);show("results",false);document.body.classList.remove("racing");updateLobby(msg);
   const stored=localStorage.getItem("apex-name");const me=snapshot.cars.find(c=>c.id===you);
   if(prior!=="lobby"&&stored&&me&&me.name!==stored)send({type:"action",action:{type:"name",name:stored}});
  }else if(snapshot.phase==="countdown"||snapshot.phase==="race"){
   if(mode!=="race"){mode="race";show("lobby",false);show("results",false);show("hud");document.body.classList.add("racing");visualZ=snapshot.cars.find(c=>c.id===you)?.z??0;visualX=0;clearControls();}
  }else if(snapshot.phase==="finished")finish();
 };
 ws.onclose=()=>{if(socket!==ws||closed)return;$("connection").textContent="RECONNECTING";clearControls();toast("Connection lost. Reconnecting…");setTimeout(()=>{if(!closed&&socket===ws)connect(room);},Math.min(5000,1000*++retries));};
 ws.onerror=()=>{$("lobbyHint").textContent="Could not connect. Check your connection; retrying…";};
}
function updateLobby(msg){
 $("players").replaceChildren();
 for(let i=0;i<4;i++){const c=snapshot.cars[i],row=document.createElement("div");row.className="player-row"+(c?"":" empty");const dot=document.createElement("i");dot.style.background=colors[i];row.append(dot);const name=document.createElement("span");name.textContent=c?c.name+(c.id===you?" (you)":""):"Waiting for a driver…";row.append(name);const status=document.createElement("span");status.textContent=c?(online.includes(c.id)?(i===0?"HOST":"CONNECTED"):"OFFLINE"):"OPEN";row.append(status);$("players").append(row);}
 const isHost=snapshot.players[0]===you,seated=snapshot.players.includes(you),n=snapshot.players.filter(x=>online.includes(x)).length;
 $("start").disabled=!isHost||n<2;$("start").textContent=isHost?"START RACE →":seated?"WAITING FOR HOST":"SPECTATING";
 $("lobbyHint").textContent=!seated?"The grid is full. You can watch this race.":n<2?"Share the invite. At least two racers are needed.":isHost?n+" racers connected. Start when your crew is ready.":"The host will start the race.";
 const me=snapshot.cars.find(c=>c.id===you);if(document.activeElement!==$("nameInput"))$("nameInput").value=me?.name??"Spectator";$("nameInput").disabled=!seated;
}
function practice(){
 closed=true;socket?.close();socket=null;room="";you="practice";localState=setup(["practice","bot1","bot2"]);localState.cars[0].name=localStorage.getItem("apex-name")||"You";localState.cars[1].name="Nova";localState.cars[2].name="Ghost";localState={...localState,phase:"countdown"};
 snapshot=viewFor(localState,you);lastRecv=performance.now();mode="race";visualZ=0;visualX=0;show("home",false);show("lobby",false);show("results",false);show("hud");document.body.classList.add("racing");history.replaceState(null,"",location.pathname);$("connection").innerHTML="<i></i> PRACTICE";initSound();
}
function finish(){
 if(mode==="results")return;mode="results";clearControls();show("results");show("hud",false);
 const order=[...snapshot.cars].sort((a,b)=>(a.finish??9999)-(b.finish??9999)||b.z-a.z);
 $("resultTitle").textContent=order[0]?.id===you?"You own the night.":"Race complete.";
 $("standings").replaceChildren();
 order.forEach((c,i)=>{const row=document.createElement("div");row.className="standing";const rank=document.createElement("b");rank.textContent=String(i+1);const name=document.createElement("span");name.textContent=c.name+(c.id===you?" (you)":"");const time=document.createElement("span");time.textContent=c.finish===null?"DNF":formatTime(c.finish);row.append(rank,name,time);$("standings").append(row);});
 $("rematch").disabled=!localState&&snapshot.players[0]!==you;$("rematch").textContent=localState?"RACE AGAIN →":snapshot.players[0]===you?"BACK TO THE GRID →":"WAITING FOR HOST";
}
function home(){
 closed=true;socket?.close();socket=null;localState=null;snapshot=null;mode="home";clearControls();history.replaceState(null,"",location.pathname);
 for(const id of ["lobby","hud","results","joinPanel"])show(id,false);show("home");document.body.classList.remove("racing");$("connection").innerHTML="<i></i> READY TO RACE";
}
function formatTime(t){const m=Math.floor(t/60),s=(t%60).toFixed(2).padStart(5,"0");return String(m).padStart(2,"0")+":"+s;}
let lastBoard="";
function updateHUD(now){
 if(mode!=="race"||!snapshot)return;
 const cars=[...snapshot.cars].sort((a,b)=>(a.finish??9999)-(b.finish??9999)||b.z-a.z),mine=snapshot.cars.find(c=>c.id===you)??cars[0];
 $("position").textContent=(cars.findIndex(c=>c.id===you)+1||"S")+"/"+cars.length;
 $("lap").textContent="LAP "+Math.min(3,Math.floor(Math.max(0,mine.z)/2400)+1)+" / 3";
 $("timer").textContent=formatTime(snapshot.time);$("speed").textContent=String(Math.round(mine.speed*2.25)).padStart(3,"0");$("gear").textContent=mine.speed<1?"N":String(Math.min(6,Math.floor(mine.speed/23)+1));
 $("nitro").style.width=mine.nitro+"%";
 $("countdown").textContent=snapshot.phase==="countdown"?String(Math.ceil(snapshot.countdown)):snapshot.time<.85?"GO":"";
 $("raceNotice").textContent=mine.finish!==null?"FINISHED · WAITING FOR THE FIELD":Math.abs(mine.x)>1.02?"OFF ROAD · STEER BACK":mine.hit>0?"COLLISION":mine.boost?"NITRO ENGAGED":!snapshot.players.includes(you)?"SPECTATING":localState&&snapshot.time<6?"PRACTICE · AUTO ACCELERATION ON":"";
 const boardKey=cars.map(c=>c.id+c.name+Math.floor(c.z/30)).join("");
 if(boardKey!==lastBoard){lastBoard=boardKey;$("leaderboard").replaceChildren();cars.forEach((c,i)=>{const row=document.createElement("div"),rank=document.createElement("b"),dot=document.createElement("i"),name=document.createElement("span"),gap=document.createElement("span");rank.textContent=String(i+1);dot.style.background=colors[c.color%4];name.textContent=c.name;gap.textContent=c.id===you?"YOU":c.finish!==null?"FIN":"-"+Math.max(0,Math.round(cars[0].z-c.z))+"m";row.append(rank,dot,name,gap);$("leaderboard").append(row);});}
 $("fps").textContent=Math.round(fps)+" FPS";
 if(soundOn&&osc&&gain){osc.frequency.setTargetAtTime(35+mine.speed*1.15,audioCtx.currentTime,.08);gain.gain.setTargetAtTime(mine.speed>1?.035:0,audioCtx.currentTime,.1);}
}
function initSound(){
 if(!soundOn)return;
 try{if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();osc=audioCtx.createOscillator();osc.type="sawtooth";gain=audioCtx.createGain();gain.gain.value=0;const filter=audioCtx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=380;osc.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);osc.start();}audioCtx.resume();}catch{soundOn=false;}
}
$("create").onclick=()=>{const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";connect(Array.from(bytes,b=>alphabet[b%32]).join(""));initSound();};
$("showJoin").onclick=()=>{show("joinPanel");$("roomInput").focus();};
$("join").onclick=()=>{const code=$("roomInput").value.trim().toUpperCase();if(!/^[A-Z0-9_-]{4,32}$/.test(code)){toast("Enter the room code from your host.");return;}connect(code);initSound();};
$("roomInput").onkeydown=e=>{if(e.code==="Enter")$("join").click();};
$("practice").onclick=practice;
$("start").onclick=()=>{send({type:"action",action:{type:"start"}});initSound();};
$("copy").onclick=async()=>{const url=location.origin+"/?room="+room;try{await navigator.clipboard.writeText(url);toast("Invite copied. Send it to your crew.");}catch{toast("Invite: "+url);}};
$("nameInput").onchange=()=>{const name=$("nameInput").value.trim().slice(0,16);if(!name)return;localStorage.setItem("apex-name",name);send({type:"action",action:{type:"name",name}});};
$("rematch").onclick=()=>localState?practice():send({type:"reset"});
document.querySelectorAll(".leave").forEach(e=>e.onclick=home);$("exitRace").onclick=home;
document.querySelectorAll("[data-close]").forEach(e=>e.onclick=()=>show(e.dataset.close,false));
$("settingsButton").onclick=()=>{show("settings");clearControls();};
$("quality").onchange=()=>{quality=$("quality").value;resize();};
$("autoGas").onchange=()=>gas=$("autoGas").checked;
$("reduced").onchange=()=>reduced=$("reduced").checked;
$("sound").onclick=()=>{soundOn=!soundOn;$("sound").textContent=soundOn?"SOUND ON":"SOUND OFF";$("sound").setAttribute("aria-label",soundOn?"Turn sound off":"Turn sound on");if(soundOn)initSound();else if(gain)gain.gain.setTargetAtTime(0,audioCtx.currentTime,.05);};
setInterval(()=>{if(socket?.readyState===1)socket.send("__ping");},20000);
let accumulator=0;
function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min(.1,(now-prev)/1000);prev=now;
 if(localState&&mode==="race"){
  accumulator+=dt;const input=getInput();
  while(accumulator>=1/60){
   localState=applyAction(localState,you,input);
   for(let j=1;j<localState.cars.length;j++){
    const c=localState.cars[j],cr=Math.sin(c.z/240)*.5+Math.sin(c.z/510+1)*.35,target=j===1?-.48:.48;
    const steer=Math.max(-1,Math.min(1,(target-c.x)*1.5+cr*.31));
    localState=applyAction(localState,c.id,{type:"input",steer,throttle:.92,brake:false,boost:Math.sin(localState.time/8+j)>.78});
   }
   localState=applyAction(localState,"",{type:"tick",dt:1/60});accumulator-=1/60;
  }
  snapshot=viewFor(localState,you);lastRecv=now;if(snapshot.phase==="finished")finish();
 }else if(mode==="race"&&now-lastSend>=50&&snapshot?.players.includes(you)){lastSend=now;send({type:"action",action:getInput()});}
 // Cap rendering at the requested 60 Hz on high-refresh displays.
 if(now-renderAt>=16.1){const elapsed=now-renderAt;const renderDt=Math.min(.1,elapsed/1000);renderAt=now-(elapsed% (1000/60));draw(now,renderDt);frameCount++;}
 if(now-fpsAt>=1000){fps=frameCount*1000/(now-fpsAt);frameCount=0;fpsAt=now;
  if(quality==="auto"&&fps<48&&ratio>.8){ratio=Math.max(.75,ratio-.1);canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);}
 }
 if(now-uiAt>90){uiAt=now;updateHUD(now);if(mode!=="race"&&gain)gain.gain.setTargetAtTime(0,audioCtx.currentTime,.2);}
 if(toastAt&&now-toastAt>4300){$("toast").style.opacity="0";toastAt=0;}
}
requestAnimationFrame(frame);
const initial=new URLSearchParams(location.search).get("room");
if(initial&&/^[A-Za-z0-9_-]{4,32}$/.test(initial))connect(initial);
// Read-only diagnostics used to verify rendering and multiplayer synchronization.
window.apexDebug={get state(){return snapshot;},get mode(){return mode;},get fps(){return fps;},get you(){return you;},get resolution(){return [canvas.width,canvas.height];}};
