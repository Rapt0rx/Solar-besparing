export function energyDetail(days){
 const val=v=>v==null||v===""||!Number.isFinite(Number(v))?null:Number(v);
 const sum=k=>{const a=days.map(r=>val(r[k])).filter(v=>v!==null);return a.length?a.reduce((s,v)=>s+v,0):null};
 const arrays=(key,n)=>days.filter(r=>Array.isArray(r[key])&&r[key].length===n&&r[key].every(x=>val(x)!==null&&val(x)>=0));
 const above=arrays("pv_above_seconds",9),bands=arrays("pv_band_kwh",8);
 const add=(rows,key,n)=>rows.length?Array.from({length:n},(_,i)=>rows.reduce((a,r)=>a+Number(r[key][i]),0)):null;
 const monthMap=new Map();
 for(const d of days){const m=d.day.slice(0,7);if(!monthMap.has(m))monthMap.set(m,[]);monthMap.get(m).push(d)}
 const months=[...monthMap].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>{
  const total=k=>{const a=rows.map(r=>val(r[k])).filter(v=>v!==null);return a.length?a.reduce((s,v)=>s+v,0):null};
  return {month,days:rows.length,pv:total("pv_kwh"),load:total("load_kwh"),grid:total("grid_import_kwh")}
 });
 const peaks=days.filter(r=>val(r.pv_peak_w)!==null).sort((a,b)=>Number(b.pv_peak_w)-Number(a.pv_peak_w));
 const paired=days.filter(r=>val(r.mppt1_kwh)!==null&&val(r.mppt2_kwh)!==null&&val(r.mppt1_covered_seconds)>0&&val(r.mppt1_covered_seconds)===val(r.mppt2_covered_seconds));
 const m1=paired.reduce((s,r)=>s+Number(r.mppt1_kwh),0),m2=paired.reduce((s,r)=>s+Number(r.mppt2_kwh),0);
 return {months,above:add(above,"pv_above_seconds",9),bands:add(bands,"pv_band_kwh",8),aboveDays:above.length,bandDays:bands.length,fullSeconds:sum("soc_full_seconds"),socSeconds:sum("soc_covered_seconds"),lowSeconds:sum("voltage_low_seconds"),voltageSeconds:sum("voltage_covered_seconds"),peak:peaks[0]||null,mpptShare:m1+m2>0?m1/(m1+m2):null,mpptDays:paired.length,batteryPositive:sum("battery_positive_kwh"),batteryNegative:sum("battery_negative_kwh"),reverseGrid:sum("grid_reverse_kwh")}
}
