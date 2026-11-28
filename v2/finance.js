export function blockCost(kwh,tariffs){
 if(kwh==null||!Number.isFinite(kwh)||kwh<0||tariffs.length!==4)return null;
 const sorted=[...tariffs].sort((a,b)=>Number(a.block_start_kwh)-Number(b.block_start_kwh));
 if(sorted.some((t,i)=>Number(t.block_start_kwh)!==[0,50,350,600][i]||t.rate_zar_per_kwh==null||!Number.isFinite(Number(t.rate_zar_per_kwh))||Number(t.rate_zar_per_kwh)<0))return null;
 return sorted.reduce((s,t,i)=>s+Math.max(0,Math.min(kwh, i===3?Infinity:Number(sorted[i+1].block_start_kwh))-Number(t.block_start_kwh))*Number(t.rate_zar_per_kwh),0)
}

export function financialModel(days,tariffs,cost){
 const valid=v=>v!=null&&v!==""&&Number.isFinite(Number(v))&&Number(v)>=0;
 const groups=new Map(),rates=new Map();
 for(const r of tariffs){const key=r.effective_from.slice(0,7);if(!rates.has(key))rates.set(key,[]);rates.get(key).push(r)}
 for(const d of days){const key=d.day.slice(0,7);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(d)}
 const months=[...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,rows])=>{
  const matched=rows.filter(d=>valid(d.load_kwh)&&valid(d.grid_import_kwh));
  const load=matched.reduce((s,d)=>s+Number(d.load_kwh),0),grid=matched.reduce((s,d)=>s+Number(d.grid_import_kwh),0),t=rates.get(month)||[];
  const without=matched.length?blockCost(load,t):null,withSolar=matched.length?blockCost(grid,t):null;
  const calendarDays=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
  const partial=matched.length!==calendarDays||matched.some(d=>Number(d.load_covered_seconds)!==86400||Number(d.grid_covered_seconds)!==86400);
  return {month,load,grid,without,withSolar,saving:without===null||withSolar===null?null:without-withSolar,partial,verified:t.length===4&&t.every(r=>r.verified===true),days:matched.length}
 });
 const known=months.filter(m=>m.saving!==null);
 const saving=known.length?known.reduce((s,m)=>s+m.saving,0):null;
 const full=days.filter(d=>valid(d.load_kwh)&&valid(d.grid_import_kwh)&&Number(d.load_covered_seconds)===86400&&Number(d.grid_covered_seconds)===86400);
 const avgLoad=full.length?full.reduce((s,d)=>s+Number(d.load_kwh),0)/full.length:null,avgGrid=full.length?full.reduce((s,d)=>s+Number(d.grid_import_kwh),0)/full.length:null;
 const factors=[1,1,1,.85,.85,.65,.65,.65,.85,1,1,1];
 const forecast=factors.map((factor,i)=>{
  const month="2027-"+String(i+1).padStart(2,"0"),n=new Date(Date.UTC(2027,i+1,0)).getUTCDate(),t=rates.get(month)||[];
  const load=avgLoad===null?null:avgLoad*n,grid=avgLoad===null?null:(avgLoad-Math.max(0,avgLoad-avgGrid)*factor)*n;
  const before=blockCost(load,t),after=blockCost(grid,t);
  return {month,factor,saving:before===null||after===null?null:before-after}
 });
 const annual=full.length&&forecast.every(m=>m.saving!==null)?forecast.reduce((s,m)=>s+m.saving,0):null;
 return {months,saving,unpricedMonths:months.length-known.length,annual,forecast,fullDays:full.length,avgLoad,avgGrid,payback:annual>0&&valid(cost)&&Number(cost)>0?Number(cost)/annual:null,recovered:saving!==null&&valid(cost)&&Number(cost)>0?saving/Number(cost):null}
}
