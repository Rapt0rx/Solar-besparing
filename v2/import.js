export function parseTelemetry(csv,now=Date.now()){
 const keys=["recorded_at","load_w","grid_w","pv_w","battery_w","soc_pct","grid_v","mppt1_w","mppt2_w"];
 const lines=csv.replace(/^\uFEFF/,"").trimEnd().split(/\r?\n/);
 if(lines.shift()!==keys.join(","))throw Error("Use the prepared private telemetry CSV, not an original export");
 if(!lines.length||lines.length>200000)throw Error("File must contain 1–200,000 data rows");
 let prev=0,observations=0;
 const rows=lines.map((line,i)=>{
  const cols=line.split(","),fail=msg=>{throw Error("CSV row "+(i+2)+": "+msg)};
  if(cols.length!==keys.length)fail("incorrect column count");
  const ts=cols[0],t=Date.parse(ts);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(ts)||!Number.isFinite(t)||new Date(t).toISOString().replace(".000Z","Z")!==ts||t<Date.UTC(2000,0,1)||t>now+60000||t<=prev)fail("timestamps must be valid, unique, sorted UTC values");
  prev=t;const r={recorded_at:ts};let present=0;
  for(let j=1;j<keys.length;j++){
   const s=cols[j],v=s===""?null:Number(s);
   if(v!==null&&(!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)||!Number.isFinite(v)||Math.abs(v)>1e9||(keys[j]==="soc_pct"&&(v<0||v>100))||(keys[j]==="grid_v"&&v<0)))fail("invalid "+keys[j]);
   r[keys[j]]=v;if(v!==null){present++;observations++}
  }
  if(!present)fail("all sensors missing");
  return r;
 });
 return {rows,observations,first:rows[0].recorded_at,last:rows.at(-1).recorded_at};
}
