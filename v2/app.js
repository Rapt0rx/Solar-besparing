import {URL as PROJECT_URL,PUBLIC_KEY} from "./config.js";
import {number,dayRange,summarize,entryPayload} from "./model.js";
import {financialModel} from "./finance.js";
import {energyDetail} from "./detail.js";
import {parseTelemetry} from "./import.js";
const $=id=>document.getElementById(id);
const state={session:null,epoch:0,period:"month",page:"home",data:null,busy:false,refresh:null,loadId:0};
const fmt=(v,d=1)=>number(v)===null?"—":Number(v).toLocaleString("en-ZA",{minimumFractionDigits:d,maximumFractionDigits:d});
const money=v=>number(v)===null?"—":"R "+fmt(v,2);
const quantity=(v,unit,d=1)=>number(v)===null?"—":fmt(v,d)+" "+unit;
const localDate=t=>new Date(t).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg",dateStyle:"short",timeStyle:"short"});
const localNow=()=>new Date(Date.now()+7200000).toISOString().slice(0,16);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function status(id,message,error=false){$(id).textContent=message;$(id).classList.toggle("error",error)}
function clearData(){state.data=null;for(const id of ["homeCards","homeFlow","quality","energyCards","energyChart","batteryStats","powerSummary","peakChart","sunChart","thresholdChart","bandChart","monthlyEnergy","socChart","mpptChart","voltageSummary","voltageChart","hourlyCaption","hourlyChart","financialCards","purchaseSummary","monthlyFinancialRows","forecastRows","utilityCards","meterRows","waterRows","purchaseRows","connection"])$(id).replaceChildren();$("periodLabel").textContent="";status("appStatus","");status("entryStatus","")}
function signedOut(message=""){stopTelemetry=true;state.epoch++;$("telemetryFile").value="";$("importTelemetry").disabled=false;$("cancelTelemetry").hidden=true;$("importProgress").hidden=true;$("importProgress").value=0;status("importStatus","");state.session=null;state.refresh=null;state.busy=false;state.loadId++;clearData();$("app").hidden=true;$("nav").hidden=true;$("logout").hidden=true;$("login").hidden=false;$("loginForm").reset();$("entryForm").reset();$("signIn").disabled=false;$("saveEntry").disabled=false;$("refresh").disabled=false;entryType();status("loginStatus",message,!!message)}
async function request(path,{method="GET",body,token}={}){
 const headers={apikey:PUBLIC_KEY,Accept:"application/json"};if(token)headers.Authorization="Bearer "+token;if(body!==undefined)headers["Content-Type"]="application/json";
 const response=await fetch(PROJECT_URL+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",credentials:"omit",redirect:"error",signal:AbortSignal.timeout(20000)});
 const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null}catch{throw Error("Unexpected server response")}
 if(!response.ok){const e=new Error(response.status===401?"Session or credentials not accepted":data?.message||data?.msg||data?.error_description||"Request failed ("+response.status+")");e.status=response.status;throw e}return data
}
function sessionFrom(data){if(!data?.access_token||!data.refresh_token||!data.user?.id)throw Error("Incomplete sign-in response");return {...data,expiresAt:Date.now()+Math.max(0,Number(data.expires_in)||0)*1000}}
async function accessToken(){
 if(!state.session)throw Error("Sign in first");
 if(state.session.expiresAt>Date.now()+60000)return state.session.access_token;
 if(!state.refresh){const epoch=state.epoch,old=state.session;
  const pending=request("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:old.refresh_token}}).then(data=>{if(epoch!==state.epoch)throw Error("Session changed");const fresh=sessionFrom(data);if(fresh.user.id!==old.user.id)throw Error("Session identity changed");state.session=fresh;return fresh.access_token}).catch(e=>{if(epoch===state.epoch&&e.status&&e.status<500)signedOut("Session expired. Please sign in again.");throw e});
  state.refresh=pending;pending.finally(()=>{if(state.refresh===pending)state.refresh=null}).catch(()=>{});
 }return state.refresh
}
async function api(path,options={}){const epoch=state.epoch,token=await accessToken();if(epoch!==state.epoch)throw Error("Session changed");try{const result=await request("/rest/v1/"+path,{...options,token});if(epoch!==state.epoch)throw Error("Session changed");return result}catch(e){if(e.status===401&&epoch===state.epoch)signedOut("Session expired. Please sign in again.");throw e}}
async function list(table,select,order){const all=[];let offset=0;for(;;){const query=new URLSearchParams({select,order,limit:"500",offset:String(offset)});const rows=await api(table+"?"+query);if(!Array.isArray(rows))throw Error("Unexpected database response");all.push(...rows);if(rows.length<500)return all;offset+=rows.length;if(offset>100000)throw Error("Reporting history exceeds preview limit")}}
async function reload(){const epoch=state.epoch,id=++state.loadId;status("appStatus","Loading private Supabase data…");$("refresh").disabled=true;
 try{const [settings,days,meters,purchases,tariffs,hourly]=await Promise.all([
 list("solar_settings","installation_cost_zar,timezone,currency","owner_id.asc"),
 list("solar_daily","day,pv_kwh,load_kwh,grid_import_kwh,pv_covered_seconds,load_covered_seconds,grid_covered_seconds,mppt1_kwh,mppt2_kwh,soc_min_pct,soc_max_pct,pv_peak_w,mppt1_covered_seconds,mppt2_covered_seconds,battery_positive_kwh,battery_negative_kwh,grid_reverse_kwh,pv_above_seconds,pv_band_kwh,soc_covered_seconds,soc_full_seconds,voltage_covered_seconds,voltage_low_seconds","day.asc"),
 list("solar_meter_readings","meter_type,recorded_at,reading,unit,source","recorded_at.asc,meter_type.asc"),
 list("solar_purchases","recorded_at,units_kwh,paid_zar,estimated_units,source","recorded_at.asc"),
 list("solar_tariffs","effective_from,block_start_kwh,rate_zar_per_kwh,verified","effective_from.asc,block_start_kwh.asc"),
 list("solar_hourly_profile","source_from,source_to,hour,pv_mean_kw,load_mean_kw,soc_full_fraction,pv_covered_seconds,load_covered_seconds,soc_covered_seconds","source_to.asc,source_from.asc,hour.asc")
 ]);if(epoch!==state.epoch||id!==state.loadId)return false;
 state.data={settings:settings[0]||null,days,meters,purchases,tariffs,hourly};render();status("appStatus","Connected · last retrieved "+localDate(Date.now()));return true
 }catch(e){if(epoch===state.epoch&&id===state.loadId)status("appStatus","Could not refresh: "+e.message+(state.data?". Previous data remains on screen.":""),true);return false}finally{if(epoch===state.epoch&&id===state.loadId)$("refresh").disabled=false}}
function card(label,value,sub="",cls=""){const c=el("div",undefined,"card");c.append(el("small",label),el("div",value,"value "+cls));if(sub)c.append(el("small",sub));return c}
function cards(id,items){$(id).replaceChildren(...items.map(x=>card(...x)))}
function rows(id,items){$(id).replaceChildren(...items.map(([label,value])=>{const r=el("div",undefined,"row");r.append(el("span",label,"muted"),el("strong",value));return r}))}
function table(id,values){$(id).replaceChildren(...values.map(values=>{const r=el("tr");for(const value of values)r.append(el("td",value));return r}))}
function drawBars(id,groups,series,scale=null){
 const container=$(id);container.replaceChildren();
 if(!groups.length){container.append(el("p","No records for this period.","small"));return}
 const max=scale??groups.reduce((m,g)=>Math.max(m,...series.map(s=>Math.max(0,number(g[s.key])??0))),1e-9);
 const frag=document.createDocumentFragment();
 for(const g of groups){const box=el("div",undefined,"barrow");box.append(el("div",g.label,"small"));
 for(const s of series){const n=number(g[s.key]),line=el("div",undefined,"barlabel");line.append(el("span",s.label),el("span",quantity(n,s.unit,s.decimals??2)));box.append(line);
 if(n!==null){const track=el("div",undefined,"track"),bar=el("i",undefined,s.cls);bar.style.width=Math.max(0,Math.min(100,n/max*100))+"%";track.append(bar);box.append(track)}}
 frag.append(box)}container.append(frag)
}
const hours=v=>number(v)===null?null:Number(v)/3600;
const kw=v=>number(v)===null?null:Number(v)/1000;
function renderDetail(days,hourly,s){
 const t=energyDetail(days),dayLabel=d=>d.day+([d.pv_covered_seconds,d.load_covered_seconds,d.grid_covered_seconds].some(v=>number(v)!==86400)?" · partial":"");
 const history=[...days].reverse();
 rows("powerSummary",[["Highest observed peak",t.peak?quantity(kw(t.peak.pv_peak_w),"kW",3)+" · "+t.peak.day:"—"],["Power duration records",t.aboveDays+" of "+days.length+" days"],["Energy band records",t.bandDays+" of "+days.length+" days"]]);
 drawBars("peakChart",history.map(d=>({label:dayLabel(d),peak:kw(d.pv_peak_w)})),[{key:"peak",label:"Peak",unit:"kW",cls:"pv"}]);
 drawBars("sunChart",history.map(d=>({label:dayLabel(d),sun:hours(d.pv_above_seconds?.[0])})),[{key:"sun",label:"Above 100 W",unit:"h",cls:"pv"}],24);
 const thresholdNames=["100 W","500 W","1 kW","2 kW","3 kW","4 kW","5 kW","6 kW","7 kW"];
 drawBars("thresholdChart",t.above?thresholdNames.map((label,i)=>({label,value:hours(t.above[i])})):[],[{key:"value",label:"Total observed",unit:"h",cls:"pv"}]);
 const bandNames=["0–<1 kW","1–<2 kW","2–<3 kW","3–<4 kW","4–<5 kW","5–<6 kW","6–<7 kW","7 kW and above"];
 drawBars("bandChart",t.bands?bandNames.map((label,i)=>({label,value:t.bands[i]})):[],[{key:"value",label:"Generated",unit:"kWh",cls:"pv"}]);
 table("monthlyEnergy",t.months.slice().reverse().map(m=>[m.month,String(m.days),fmt(m.pv,2),fmt(m.load,2),fmt(m.grid,2)]));
 rows("batteryStats",[["MPPT 1",quantity(s.mppt1,"kWh",2)],["MPPT 2",quantity(s.mppt2,"kWh",2)],["MPPT 1 share (equal coverage days)",t.mpptShare===null?"—":fmt(t.mpptShare*100,2)+"% · "+t.mpptDays+" days"],["Lowest observed battery SOC",quantity(s.socMin,"%",0)],["Highest observed battery SOC",quantity(s.socMax,"%",0)],["Time at SOC ≥99%",quantity(hours(t.fullSeconds),"h",2)],["SOC observation time",quantity(hours(t.socSeconds),"h",2)],["Battery positive power energy",quantity(t.batteryPositive,"kWh",2)],["Battery negative power energy",quantity(t.batteryNegative,"kWh",2)]]);
 const soc=$("socChart");soc.replaceChildren();
 for(const d of history){const box=el("div",undefined,"barrow"),mn=number(d.soc_min_pct),mx=number(d.soc_max_pct);box.append(el("div",d.day+(number(d.soc_covered_seconds)!==86400?" · incomplete SOC time":""),"small"));box.append(el("div",mn===null||mx===null?"Range unavailable":fmt(mn,0)+"–"+fmt(mx,0)+"%","barlabel"));
 if(mn!==null&&mx!==null&&mn>=0&&mx<=100&&mx>=mn){const track=el("div",undefined,"soc-range"),bar=el("i");bar.style.left=mn+"%";bar.style.width=(mx-mn)+"%";track.append(bar);box.append(track)}box.append(el("div","Time at ≥99%: "+quantity(hours(d.soc_full_seconds),"h",2),"small"));soc.append(box)}
 if(!history.length)soc.append(el("p","No battery records for this period.","small"));
 drawBars("mpptChart",history.map(d=>({label:d.day+(number(d.mppt1_covered_seconds)!==86400||number(d.mppt2_covered_seconds)!==86400?" · partial":""),m1:d.mppt1_kwh,m2:d.mppt2_kwh})),[{key:"m1",label:"MPPT 1",unit:"kWh",cls:"pv"},{key:"m2",label:"MPPT 2",unit:"kWh",cls:"otherbar"}]);
 rows("voltageSummary",[["Observed time below 50 V",quantity(hours(t.lowSeconds),"h",2)],["Voltage observation time",quantity(hours(t.voltageSeconds),"h",2)],["Reverse grid power energy",quantity(t.reverseGrid,"kWh",3)]]);
 drawBars("voltageChart",history.map(d=>({label:d.day+(number(d.voltage_covered_seconds)!==86400?" · incomplete":""),low:hours(d.voltage_low_seconds),covered:hours(d.voltage_covered_seconds)})),[{key:"low",label:"Below 50 V",unit:"h",cls:"gridbar"},{key:"covered",label:"Observed",unit:"h",cls:"batbar"}],24);
 const last=hourly.at(-1),profile=last?hourly.filter(r=>r.source_from===last.source_from&&r.source_to===last.source_to).sort((a,b)=>a.hour-b.hour):[];
 $("hourlyCaption").textContent=last?last.source_from+" – "+last.source_to+" · SAST · fixed historical period":"Hourly history unavailable";
 drawBars("hourlyChart",profile.map(r=>({label:String(r.hour).padStart(2,"0")+":00",pv:r.pv_covered_seconds>0?r.pv_mean_kw:null,load:r.load_covered_seconds>0?r.load_mean_kw:null})),[{key:"pv",label:"Solar mean",unit:"kW",cls:"pv"},{key:"load",label:"Load mean",unit:"kW",cls:"use"}]);
 for(const [i,box] of Array.from($("hourlyChart").children).entries()){const r=profile[i];if(!r)continue;const fraction=number(r.soc_full_fraction);const p=r.soc_covered_seconds>0&&fraction!==null?fraction*100:null;box.append(el("div","SOC ≥99%: "+quantity(p,"%",1),"small"));if(p!==null){const track=el("div",undefined,"track"),bar=el("i",undefined,"batbar");bar.style.width=Math.min(100,Math.max(0,p))+"%";track.append(bar);box.append(track)}}
}
function render(){if(!state.data)return;const d=state.data,range=dayRange(d.days,state.period),s=summarize(range.rows),electric=d.meters.filter(r=>r.meter_type==="electricity"),water=d.meters.filter(r=>r.meter_type==="water"),latest=electric.at(-1),waterLast=water.at(-1);
 const periodText=range.end?range.start+" – "+range.end:"No daily history";
 $("periodLabel").textContent=periodText+" · anchored to latest recorded day";
 document.querySelectorAll("[data-period]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.period===state.period)));
 const coverage=s.coverage===null?"—":fmt(s.coverage*100,2)+"%";
 const energyCards=[["Solar generated",quantity(s.pv,"kWh"),"Recorded range","sun"],["Home consumption",quantity(s.load,"kWh"),"Recorded range","home"],["Grid imported",quantity(s.grid,"kWh",2),"Recorded range","gridpower"],["Grid independence",coverage,s.coverageDays+" fully covered days","home"]];
 cards("homeCards",energyCards);cards("energyCards",energyCards);
 rows("homeFlow",[["Solar",quantity(s.pv,"kWh")],["Household",quantity(s.load,"kWh")],["Grid import",quantity(s.grid,"kWh",2)],["Latest prepaid balance (all history)",latest?quantity(latest.reading,"kWh",2):"—"]]);
 const calendarDays=range.end?Math.round((Date.parse(range.end)-Date.parse(range.start))/86400000)+1:0;
 rows("quality",[["Recorded days",String(s.count)],["Missing calendar days",String(Math.max(0,calendarDays-s.count))],["Partial / incomplete days",String(s.partial)],["Latest daily data",d.days.at(-1)?.day||"—"]]);
 const max=Math.max(1,...range.rows.flatMap(r=>[number(r.pv_kwh)||0,number(r.load_kwh)||0]));
 $("energyChart").replaceChildren(...range.rows.slice().reverse().map(r=>{const box=el("div",undefined,"barrow"),partial=["pv_covered_seconds","load_covered_seconds","grid_covered_seconds"].some(k=>number(r[k])!==86400);box.append(el("div",r.day+(partial?" · partial":""),"small"));for(const [key,label,cls] of [["pv_kwh","Solar","pv"],["load_kwh","Home","use"]]){const n=number(r[key]),line=el("div",undefined,"barlabel");line.append(el("span",label),el("span",quantity(n,"kWh")));box.append(line);if(n!==null){const t=el("div",undefined,"track"),i=el("i",undefined,cls);i.style.width=Math.max(0,Math.min(100,n/max*100))+"%";t.append(i);box.append(t)}}return box}));
 renderDetail(range.rows,d.hourly,s);
 const known=d.purchases.filter(p=>number(p.paid_zar)!==null),spent=known.length?known.reduce((a,p)=>a+Number(p.paid_zar),0):null;
 const fin=financialModel(d.days,d.tariffs,d.settings?.installation_cost_zar);
 cards("financialCards",[["System investment",money(d.settings?.installation_cost_zar),"All history"],["Known purchases",money(spent),"All recorded costs only"],["Estimated energy savings",money(fin.saving),fin.unpricedMonths?fin.unpricedMonths+" months not priced":"Configured tariffs · all recorded months"],["Investment recovered",fin.recovered===null?"—":fmt(fin.recovered*100,2)+"%","Modelled, not cash recovery"],["2027 annual scenario",money(fin.annual),"Provisional seasonal assumptions"],["Simple payback",fin.payback===null?"—":fmt(fin.payback,2)+" years","Cost ÷ projected annual saving"]]);
 rows("purchaseSummary",[["Purchase records",String(d.purchases.length)],["Unknown purchase amounts",String(d.purchases.length-known.length)],["Estimated unit amounts",String(d.purchases.filter(p=>p.estimated_units).length)],["Recorded units",d.purchases.length?quantity(d.purchases.reduce((a,p)=>a+Number(p.units_kwh),0),"kWh",2):"—"],["Forecast basis",fin.fullDays+" fully covered days"],["Tariff entries",String(d.tariffs.length)],["Unverified tariff entries",String(d.tariffs.filter(t=>!t.verified).length)]]);
 table("monthlyFinancialRows",fin.months.slice().reverse().map(m=>[m.month+(m.partial?" · partial":""),money(m.without),money(m.withSolar),money(m.saving),m.verified?"Verified":"Unverified"]));
 table("forecastRows",fin.forecast.map(m=>[m.month,fmt(m.factor*100,0)+"%",money(m.saving)]));
 cards("utilityCards",[["Electricity balance",latest?quantity(latest.reading,"kWh",2):"—",latest?localDate(latest.recorded_at):"No readings"],["Water meter",waterLast?fmt(waterLast.reading,0):"—",waterLast?localDate(waterLast.recorded_at)+" · raw units":"No readings"]]);
 table("meterRows",electric.slice(-20).reverse().map(r=>[localDate(r.recorded_at),fmt(r.reading,2)]));table("waterRows",water.slice(-20).reverse().map(r=>[localDate(r.recorded_at),fmt(r.reading,0)]));table("purchaseRows",d.purchases.slice(-20).reverse().map(r=>[localDate(r.recorded_at),fmt(r.units_kwh,4)+(r.estimated_units?" (est.)":""),money(r.paid_zar)]));
 rows("connection",[["Source","Supabase"],["Daily summaries",String(d.days.length)],["Electricity readings",String(electric.length)],["Water readings",String(water.length)],["Top-ups",String(d.purchases.length)],["Session","In memory only"]]);
}
function page(name){state.page=name;document.querySelectorAll("[data-page]").forEach(n=>n.hidden=n.dataset.page!==name);document.querySelectorAll("[data-nav]").forEach(b=>{if(b.dataset.nav===name)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});window.scrollTo(0,0)}
function entryType(){const k=$("kind").value,topup=k==="topup";$("purchaseFields").hidden=!topup;$("units").required=topup;$("paid").required=topup;$("readingLabel").textContent=k==="water"?"Water meter reading (raw units)":topup?"Meter balance after top-up (kWh)":"Meter balance (kWh)";unitPrice()}
function unitPrice(){const u=number($("units").value),p=number($("paid").value);$("unitPrice").textContent=u>0&&p!==null&&p>=0?"Price: "+money(p/u)+"/kWh":""}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if($("signIn").disabled)return;$("signIn").disabled=true;const epoch=++state.epoch;status("loginStatus","Signing in…");try{const password=$("password").value;$("password").value="";const data=await request("/auth/v1/token?grant_type=password",{method:"POST",body:{email:$("email").value.trim(),password}});if(epoch!==state.epoch)return;state.session=sessionFrom(data);$("loginForm").reset();$("login").hidden=true;$("app").hidden=false;$("nav").hidden=false;$("logout").hidden=false;$("when").value=localNow();page("home");await reload()}catch(e){if(epoch===state.epoch)status("loginStatus",e.message,true)}finally{if(epoch===state.epoch)$("signIn").disabled=false}});
$("logout").addEventListener("click",()=>{const token=state.session?.access_token;signedOut();if(token)request("/auth/v1/logout?scope=local",{method:"POST",token}).catch(()=>{})});
$("period").addEventListener("click",e=>{const b=e.target.closest("[data-period]");if(b){state.period=b.dataset.period;render()}});
$("nav").addEventListener("click",e=>{const b=e.target.closest("[data-nav]");if(b)page(b.dataset.nav)});
$("kind").addEventListener("change",entryType);$("units").addEventListener("input",unitPrice);$("paid").addEventListener("input",unitPrice);
$("refresh").addEventListener("click",reload);
$("entryForm").addEventListener("submit",async e=>{e.preventDefault();if(state.busy)return;const epoch=state.epoch;let payload;try{payload=entryPayload({kind:$("kind").value,time:$("when").value,reading:$("reading").value,units:$("units").value,paid:$("paid").value})}catch(e){status("entryStatus",e.message,true);return}state.busy=true;$("saveEntry").disabled=true;status("entryStatus","Saving…");
 try{const result=await api("rpc/solar_save_entry",{method:"POST",body:payload});if(epoch!==state.epoch)return;if(result?.saved!==true)throw Error("Save was not confirmed");$("entryForm").reset();$("when").value=localNow();entryType();status("entryStatus","Saved to Supabase.");const loaded=await reload();if(epoch===state.epoch&&!loaded)status("entryStatus","Save confirmed. Refresh the dashboard to see the new reading.",true)}
 catch(e){if(epoch===state.epoch)status("entryStatus","Save not confirmed: "+e.message+". Keep the same timestamp and values when retrying.",true)}
 finally{if(epoch===state.epoch){state.busy=false;$("saveEntry").disabled=false}}
});
window.addEventListener("pageshow",e=>{if(e.persisted)signedOut()});
entryType();

let stopTelemetry=false, activeImport=null;
$("cancelTelemetry").addEventListener("click",()=>{stopTelemetry=true;$("cancelTelemetry").disabled=true;status("importStatus","Stopping after current batch…")});
$("importTelemetry").addEventListener("click",async()=>{
 if(activeImport||!state.session)return;
 const file=$("telemetryFile").files?.[0];
 if(!file){status("importStatus","Choose the prepared CSV file first.",true);return}
 if(file.size>20*1024*1024){status("importStatus","File exceeds 20 MB.",true);return}
 const epoch=state.epoch,run={};activeImport=run;stopTelemetry=false;
 $("importTelemetry").disabled=true;$("telemetryFile").disabled=true;$("cancelTelemetry").hidden=false;$("cancelTelemetry").disabled=false;$("importProgress").hidden=false;$("importProgress").value=0;
 let accepted=0,inserted=0,existing=0;
 try{
  status("importStatus","Validating every row…");
  const data=parseTelemetry(await file.text());if(epoch!==state.epoch||stopTelemetry)return;
  $("importProgress").max=data.rows.length;
  status("importStatus",data.rows.length.toLocaleString()+" validated timestamps. Importing…");
  for(let i=0;i<data.rows.length;i+=500){
   if(stopTelemetry||epoch!==state.epoch)break;
   const chunk=data.rows.slice(i,i+500),result=await api("rpc/solar_import_telemetry",{method:"POST",body:{p_rows:chunk}});
   if(epoch!==state.epoch)return;
   if(result?.accepted!==chunk.length||!Number.isInteger(result.inserted)||!Number.isInteger(result.existing)||result.inserted<0||result.existing<0||result.inserted+result.existing!==chunk.length)throw Error("Batch response could not be verified");
   accepted+=result.accepted;inserted+=result.inserted;existing+=result.existing;$("importProgress").value=accepted;
   status("importStatus",accepted.toLocaleString()+" / "+data.rows.length.toLocaleString()+" verified · "+inserted.toLocaleString()+" new · "+existing.toLocaleString()+" already present");
  }
  if(epoch!==state.epoch)return;
  if(accepted===data.rows.length){status("importStatus","Import complete: "+accepted.toLocaleString()+" timestamps verified, "+inserted.toLocaleString()+" inserted, "+existing.toLocaleString()+" already present. Daily summary records were not changed.");$("telemetryFile").value=""}
  else status("importStatus","Stopped after "+accepted.toLocaleString()+" confirmed rows. Re-select the same CSV to resume.");
 }catch(e){if(epoch===state.epoch)status("importStatus","Stopped after "+accepted.toLocaleString()+" confirmed rows: "+e.message+". Retry the same CSV; identical rows will be skipped.",true)}
 finally{if(activeImport===run){activeImport=null;if(epoch===state.epoch){$("importTelemetry").disabled=false;$("telemetryFile").disabled=false;$("cancelTelemetry").hidden=true}else{$("telemetryFile").disabled=false}}}
});
