export function number(v){return v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null}

export function dayRange(days,period){
 const sorted=[...days].sort((a,b)=>a.day.localeCompare(b.day));
 if(!sorted.length)return {rows:[],start:null,end:null};
 const end=sorted.at(-1).day;
 const date=new Date(end+"T00:00:00Z");
 if(period==="day"){}
 else if(period==="week")date.setUTCDate(date.getUTCDate()-6);
 else if(period==="month")date.setUTCDate(1);
 else if(period==="year")date.setUTCMonth(0,1);
 else if(period==="all")return {rows:sorted,start:sorted[0].day,end};
 else throw Error("Unknown period");
 const start=date.toISOString().slice(0,10);
 return {rows:sorted.filter(r=>r.day>=start&&r.day<=end),start,end}
}

export function summarize(rows){
 const sum=k=>{const values=rows.map(r=>number(r[k])).filter(v=>v!==null);return values.length?values.reduce((a,b)=>a+b,0):null};
 const pv=sum("pv_kwh"),load=sum("load_kwh"),grid=sum("grid_import_kwh");
 const partial=rows.filter(r=>["pv_covered_seconds","load_covered_seconds","grid_covered_seconds"].some(k=>number(r[k])!==86400)).length;
 const matched=rows.length>0&&rows.every(r=>number(r.load_kwh)!==null&&number(r.grid_import_kwh)!==null&&number(r.load_covered_seconds)===86400&&number(r.grid_covered_seconds)===86400);
 const complete=rows.filter(r=>["pv_covered_seconds","load_covered_seconds","grid_covered_seconds"].every(k=>number(r[k])===86400)&&number(r.load_kwh)!==null&&number(r.grid_import_kwh)!==null);
 const fullLoad=complete.reduce((s,r)=>s+number(r.load_kwh),0),fullGrid=complete.reduce((s,r)=>s+number(r.grid_import_kwh),0);
 const mins=rows.map(r=>number(r.soc_min_pct)).filter(v=>v!==null);
 const maxes=rows.map(r=>number(r.soc_max_pct)).filter(v=>v!==null);
 return {pv,load,grid,partial,count:rows.length,coverage:fullLoad>0?1-fullGrid/fullLoad:null,coverageDays:complete.length,allComplete:matched,mppt1:sum("mppt1_kwh"),mppt2:sum("mppt2_kwh"),socMin:mins.length?Math.min(...mins):null,socMax:maxes.length?Math.max(...maxes):null}
}

export function entryPayload({kind,time,reading,units,paid},now=Date.now()){
 if(!["water","electricity","topup"].includes(kind))throw Error("Choose an entry type");
 if(typeof time!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(time))throw Error("Enter a valid date and time");
 const stamp=new Date(time+"+02:00");
 if(!Number.isFinite(+stamp)||new Date(+stamp+7200000).toISOString().slice(0,16)!==time.slice(0,16)||+stamp>now+60000||+stamp<Date.UTC(2000,0,1))throw Error("Invalid or future date");
 const decimal=(v,dp,max,min)=>{if(typeof v!=="string"||!new RegExp("^\\d+(\\.\\d{1,"+dp+"})?$").test(v.trim()))throw Error("Enter a valid amount (up to "+dp+" decimals)");const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error("Amount out of range");return n};
 return {p_kind:kind,p_recorded_at:stamp.toISOString(),p_reading:decimal(reading,6,999999999999,0),p_units:kind==="topup"?decimal(units,4,9999999999,.0001):null,p_paid:kind==="topup"?decimal(paid,2,999999999999,0):null}
}
