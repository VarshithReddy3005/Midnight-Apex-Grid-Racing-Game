import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import * as logic from "./logic.js";
import { parseClientMessage } from "./protocol";
interface Game { status:"waiting"|"playing"|"over"; seats:string[]; state:any; result:unknown; lastTick?:number; }
type Conns=Record<string,string>;
interface Out {to:string;data:unknown}
export function freshGame():Game {return {status:"waiting",seats:[],state:null,result:null};}
export function resolveMeta(raw:unknown):{game:string;minPlayers:number;maxPlayers:number}{
 const m=(raw??{}) as Record<string,any>, p=Array.isArray(m.players)?m.players:[];
 const n=(v:unknown,f:number)=>Number.isInteger(v)&&(v as number)>0?v as number:f;
 const min=n(m.minPlayers,n(p[0],1));return {game:[m.game,m.name,m.title].find(v=>typeof v==="string"&&v.trim())??"Game",minPlayers:min,maxPlayers:Math.max(min,n(m.maxPlayers,n(p[1],min)))};
}
const META=resolveMeta(logic.meta);
export class Room extends DurableObject<Env>{
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("__ping","__pong"));}
 private async load(){const data=await this.ctx.storage.get<any>(["game","conns"]);return {game:(data.get("game")??freshGame()) as Game,conns:(data.get("conns")??{}) as Conns};}
 private async save(game:Game,conns:Conns){await this.ctx.storage.put({game,conns});}
 private broadcast(game:Game,conns:Conns):Out[]{const online=[...new Set(Object.values(conns))];return Object.entries(conns).map(([to,you])=>({to,data:{type:"state",status:game.status,seats:game.seats,you,connected:online.length,online,view:game.state?logic.viewFor(game.state,you):null,result:game.result,meta:META}}));}
 private error(to:string,error:string){return [{to,data:{type:"error",error}}];}
 private send(messages:Out[]){for(const ws of this.ctx.getWebSockets()){const id=(ws.deserializeAttachment() as {connId?:string}|null)?.connId;for(const m of messages)if(m.to===id)try{ws.send(JSON.stringify(m.data));}catch{ /* closed socket */ }}}
 override async fetch(request:Request):Promise<Response>{
  if(request.headers.get("Upgrade")!=="websocket")return new Response("WebSocket required",{status:426});
  const origin=request.headers.get("Origin");
  if(origin && new URL(origin).host!==new URL(request.url).host)return new Response("Origin refused",{status:403});
  if(this.ctx.getWebSockets().length>=16)return new Response("Room connection limit",{status:429});
  const pair=new WebSocketPair(),server=pair[1]!;
  this.ctx.acceptWebSocket(server);server.serializeAttachment({connId:crypto.randomUUID(),window:Date.now(),count:0});
  return new Response(null,{status:101,webSocket:pair[0]});
 }
 override async webSocketMessage(ws:WebSocket,raw:string|ArrayBuffer):Promise<void>{
  const att=ws.deserializeAttachment() as {connId:string;window:number;count:number}|null;if(!att)return;
  const now=Date.now();if(now-att.window>1000){att.window=now;att.count=0;}att.count++;ws.serializeAttachment(att);
  if(att.count>55){if(att.count===56)this.send(this.error(att.connId,"Too many messages."));return;}
  try{await this.handle(att.connId,raw);}catch{this.send(this.error(att.connId,"Connection interrupted. Please reconnect."));}
 }
 private async handle(connId:string,raw:string|ArrayBuffer){
  const parsed=parseClientMessage(raw);if(!parsed.ok){this.send(this.error(connId,parsed.error));return;}
  const msg=parsed.msg,{game,conns}=await this.load();
  if(msg.type==="join"){
   if(!/^[a-f0-9-]{36}$/i.test(msg.playerId)){this.send(this.error(connId,"Invalid player session."));return;}
   // Public player IDs never reveal the private reconnect token.
   const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(msg.playerId));
   const id=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);
   if(conns[connId]&&conns[connId]!==id)return;
   conns[connId]=id;
   if(!game.state)game.state=logic.setup([]);
   if(game.state.phase==="lobby"&&!game.seats.includes(id)&&game.seats.length<META.maxPlayers){
    game.seats.push(id);const old=game.state.cars;
    game.state=logic.setup(game.seats);game.state.cars=game.state.cars.map((c:any)=>old.find((o:any)=>o.id===c.id)??c);
   }
   game.status=game.seats.length>=META.minPlayers?"playing":"waiting";
   if(game.state.phase==="finished")game.status="over";
   await this.save(game,conns);this.send(this.broadcast(game,conns));return;
  }
  const id=conns[connId];if(!id){this.send(this.error(connId,"Join first."));return;}
  if(msg.type==="reset"){
   if(id!==game.seats[0]||!["finished","lobby"].includes(game.state?.phase)){this.send(this.error(connId,"Only the host can return to the lobby after a race."));return;}
   const online=new Set(Object.values(conns));game.seats=game.seats.filter(x=>online.has(x));
   const old=game.state.cars;game.state=logic.setup(game.seats);
   game.state.cars=game.state.cars.map((c:any)=>({...c,name:old.find((o:any)=>o.id===c.id)?.name??c.name}));
   game.result=null;game.status=game.seats.length>=2?"playing":"waiting";
   await this.ctx.storage.deleteAlarm();await this.save(game,conns);this.send(this.broadcast(game,conns));return;
  }
  if(!game.seats.includes(id)){this.send(this.error(connId,"Spectators cannot drive."));return;}
  const a=msg.action as {type?:string};
  if(a?.type==="start" && game.seats.filter(x=>Object.values(conns).includes(x)).length<2){this.send(this.error(connId,"Wait for at least two connected racers."));return;}
  const verdict=logic.validateAction(game.state,id,msg.action);
  if(!verdict.ok){this.send(this.error(connId,verdict.error??"Invalid action."));return;}
  game.state=logic.applyAction(game.state,id,msg.action);
  if(a.type==="start"){game.lastTick=Date.now();await this.ctx.storage.setAlarm(Date.now()+50);}
  await this.save(game,conns);
  if(a.type!=="input")this.send(this.broadcast(game,conns));
 }
 override async alarm():Promise<void>{
  const {game,conns}=await this.load();
  if(!game.state||!["countdown","race"].includes(game.state.phase))return;
  if(!Object.keys(conns).length){game.state={...game.state,phase:"finished"};game.status="over";await this.save(game,conns);return;}
  const now=Date.now();let dt=Math.min(0.25,Math.max(0,(now-(game.lastTick??now-50))/1000));
  while(dt>0.0001){const step=Math.min(1/60,dt);game.state=logic.applyAction(game.state,"",{type:"tick",dt:step});dt-=step;}
  game.lastTick=now;const result=logic.isGameOver(game.state);
  if(result.over){game.status="over";game.result=result;}
  await this.save(game,conns);this.send(this.broadcast(game,conns));
  if(!result.over)await this.ctx.storage.setAlarm(Date.now()+50);
 }
 override async webSocketClose(ws:WebSocket):Promise<void>{
  const id=(ws.deserializeAttachment() as {connId?:string}|null)?.connId;if(!id)return;
  const {game,conns}=await this.load();delete conns[id];
  if(game.state?.phase==="lobby"){
   const online=new Set(Object.values(conns));game.seats=game.seats.filter(x=>online.has(x));
   const old=game.state.cars;game.state=logic.setup(game.seats);
   game.state.cars=game.state.cars.map((c:any)=>({...c,name:old.find((o:any)=>o.id===c.id)?.name??c.name}));
   game.status=game.seats.length>=2?"playing":"waiting";
  }
  await this.save(game,conns);this.send(this.broadcast(game,conns));
 }
 override async webSocketError(ws:WebSocket):Promise<void>{await this.webSocketClose(ws);}
}
