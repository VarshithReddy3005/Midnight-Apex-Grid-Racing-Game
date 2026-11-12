import {SELF} from "cloudflare:test";
import {describe,it,expect} from "vitest";
async function open(room:string){
 const res=await SELF.fetch("https://game.test/ws/"+room,{headers:{Upgrade:"websocket"}});
 expect(res.status).toBe(101);const ws=res.webSocket!;ws.accept();
 const frames:any[]=[];ws.addEventListener("message",(e:MessageEvent)=>{if(e.data!=="__pong")frames.push(JSON.parse(String(e.data)));});
 return {ws,frames,send:(v:unknown)=>ws.send(JSON.stringify(v)),async next(pred:(x:any)=>boolean){for(let i=0;i<200;i++){const f=frames.find(pred);if(f)return f;await scheduler.wait(10);}throw new Error("Timed out");}};
}
describe("private racing rooms",()=>{
 it("isolates rooms and does not expose reconnect tokens",async()=>{
  const a=await open(crypto.randomUUID()),b=await open(crypto.randomUUID()),token=crypto.randomUUID();
  a.send({type:"join",playerId:token});b.send({type:"join",playerId:crypto.randomUUID()});
  const sa=await a.next(x=>x.type==="state"),sb=await b.next(x=>x.type==="state");
  expect(sa.seats).toHaveLength(1);expect(sb.seats).toHaveLength(1);
  expect(JSON.stringify(sa)).not.toContain(token);expect(sa.view.phase).toBe("lobby");
  a.ws.close();b.ws.close();
 });
 it("rejects non-host starts and accepts host starts with two players",async()=>{
  const room=crypto.randomUUID(),a=await open(room),b=await open(room);
  a.send({type:"join",playerId:crypto.randomUUID()});await a.next(x=>x.type==="state");
  b.send({type:"join",playerId:crypto.randomUUID()});await b.next(x=>x.seats?.length===2);
  b.send({type:"action",action:{type:"start"}});expect((await b.next(x=>x.type==="error")).error).toContain("host");
  a.send({type:"action",action:{type:"start"}});expect((await a.next(x=>x.view?.phase==="countdown")).view.cars).toHaveLength(2);
  a.ws.close();b.ws.close();
 });
 it("refuses forged tick actions",async()=>{
  const a=await open(crypto.randomUUID());a.send({type:"join",playerId:crypto.randomUUID()});await a.next(x=>x.type==="state");
  a.send({type:"action",action:{type:"tick",dt:9000}});expect((await a.next(x=>x.type==="error")).error).toContain("Unknown");a.ws.close();
 });
});
