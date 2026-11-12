export const meta = { game: "Midnight Apex", minPlayers: 2, maxPlayers: 4 };
const LENGTH = 2400, LAPS = 3;
function curve(z) { return Math.sin(z / 240) * 0.5 + Math.sin(z / 510 + 1) * 0.35; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
export function setup(players) {
  return { phase: "lobby", time: 0, countdown: 3, length: LENGTH, laps: LAPS,
    players: [...players], finishOrder: [], firstFinish: null,
    cars: players.map((id,i)=>({ id, name: "Driver " + (i+1), color:i, x: (i%2 ? 0.36 : -0.36), z:i<2?0:-Math.floor(i/2)*8,
      speed:0, nitro:100, boost:false, hit:0, finish:null, lastInput:0,
      input:{steer:0,throttle:0,brake:false,boost:false}})) };
}
export function validateAction(s, id, a) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return {ok:false,error:"Invalid action."};
  if (!s.players.includes(id)) return {ok:false,error:"Spectators cannot drive."};
  if (a.type==="name") return typeof a.name==="string" && a.name.trim().length>0 && a.name.length<=16 && s.phase==="lobby" ? {ok:true} : {ok:false,error:"Use a name of 1–16 characters in the lobby."};
  if (a.type==="start") return id===s.players[0] && s.phase==="lobby" && s.players.length>=2 ? {ok:true} : {ok:false,error:"The host can start when two racers have joined."};
  if (a.type==="input") {
    if (s.phase!=="race" && s.phase!=="countdown") return {ok:false,error:"The race has not started."};
    if (!Number.isFinite(a.steer) || Math.abs(a.steer)>1 || !Number.isFinite(a.throttle) || a.throttle<0 || a.throttle>1 || typeof a.brake!=="boolean" || typeof a.boost!=="boolean") return {ok:false,error:"Invalid controls."};
    return {ok:true};
  }
  return {ok:false,error:"Unknown action."};
}
export function applyAction(s, id, a) {
  if (a.type==="name") return {...s,cars:s.cars.map(c=>c.id===id?{...c,name:a.name.trim()}:c)};
  if (a.type==="start") return {...s,phase:"countdown",countdown:3,time:0};
  if (a.type==="input") return {...s,cars:s.cars.map(c=>c.id===id?{...c,input:{steer:a.steer,throttle:a.throttle,brake:a.brake,boost:a.boost},lastInput:s.time}:c)};
  // Only the trusted room dispatches ticks; clients cannot validate this action.
  if (a.type!=="tick") return s;
  const dt=clamp(a.dt,0,0.05);
  if (s.phase==="countdown") {const left=s.countdown-dt; return {...s,countdown:Math.max(0,left),phase:left<=0?"race":"countdown"};}
  if (s.phase!=="race") return s;
  const time=s.time+dt, finishOrder=[...s.finishOrder];
  const cars=s.cars.map(c=>{
    if (c.finish!==null) return c;
    const fresh=time-c.lastInput<0.65, input=fresh?c.input:{steer:0,throttle:0,brake:true,boost:false};
    const boosted=input.boost && c.nitro>1 && input.throttle>0 && !input.brake;
    const max=boosted?160:115;
    let speed=clamp(c.speed+(input.throttle*47-(input.brake?110:0)-7-c.speed*0.06)*dt,0,max);
    if (speed>max) speed=Math.max(max,speed-55*dt);
    let x=clamp(c.x + input.steer*dt*(0.38+speed/72) - curve(c.z)*Math.pow(speed/115,2)*dt*0.72,-1.5,1.5);
    let hit=Math.max(0,c.hit-dt);
    if (Math.abs(x)>1.02) speed=Math.max(22,speed-110*dt);
    let z=c.z+speed*dt;
    const oldLap=Math.floor(Math.max(0,c.z)/LENGTH), local=z%LENGTH, oldLocal=((c.z%LENGTH)+LENGTH)%LENGTH;
    // Fixed roadside hazards: pass through the open lane. Hit tests use the crossed interval.
    for (let k=0;k<7;k++) {
      const hz=310+k*295, hx=k%3===0?0:k%3===1?-0.63:0.63;
      if (Math.floor(z/LENGTH)===oldLap && oldLocal<hz && local>=hz && Math.abs(x-hx)<0.22 && hit===0) {speed*=0.45;hit=0.65;}
    }
    const finish=z>=LENGTH*LAPS?time:null;
    if(finish!==null) finishOrder.push(c.id);
    return {...c,x,z:Math.min(z,LENGTH*LAPS),speed,nitro:clamp(c.nitro+(boosted?-31:12)*dt,0,100),boost:boosted,hit,finish};
  });
  // Cars share the circuit. Light contact costs speed without pinning either driver.
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    const a=cars[i],b=cars[j]; if(a.finish!==null||b.finish!==null)continue;
    if(Math.abs(a.z-b.z)<5 && Math.abs(a.x-b.x)<0.18){
      const dir=a.x>=b.x?1:-1; a.x=clamp(a.x+dir*dt*0.6,-1.5,1.5);b.x=clamp(b.x-dir*dt*0.6,-1.5,1.5);
      a.speed=Math.max(0,a.speed-22*dt);b.speed=Math.max(0,b.speed-22*dt);
    }
  }
  const firstFinish=s.firstFinish ?? (finishOrder.length?time:null);
  const ended=finishOrder.length===cars.length || (firstFinish!==null && time-firstFinish>18) || time>180;
  return {...s,time,cars,finishOrder,firstFinish,phase:ended?"finished":"race"};
}
export function isGameOver(s) { return s.phase==="finished"?{over:true,winner:s.finishOrder[0]??null,order:s.finishOrder}:{over:false}; }
export function viewFor(s, id) { return {...s,cars:s.cars.map(({input,lastInput,...c})=>c),you:id}; }
