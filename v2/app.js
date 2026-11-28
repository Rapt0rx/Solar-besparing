import {URL as PROJECT_URL,PUBLIC_KEY} from "./config.js";
import {number,dayRange,summarize,entryPayload} from "./model.js";
const $=id=>document.getElementById(id);
const state={session:null,epoch:0,period:"month",page:"home",data:null,busy:false,refresh:null,loadId:0};
const fmt=(v,d=1)=>number(v)===null?"—":Number(v).toLocaleString("en-ZA",{minimumFractionDigits:d,maximumFractionDigits:d});
const money=v=>number(v)===null?"—":"R "+fmt(v,2);
const quantity=(v,unit,d=1)=>number(v)===null?"—":fmt(v,d)+" "+unit;
const localDate=t=>new Date(t).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg",dateStyle:"short",timeStyle:"short"});
const localNow=()=>new Date(Date.now()+7200000).toISOString().slice(0,16);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function status(id,message,error=false){$(id).textContent=message;$(id).classList.toggle("error",error)}
function clearData(){state.data=null;for(const id of ["homeCards","homeFlow","quality","energyCards","energyChart","batteryStats","financialCards","purchaseSummary","utilityCards","meterRows","waterRows","purchaseRows","connection"])$(id).replaceChildren();$("periodLabel").textContent="";status("appStatus","");status("entryStatus","")}
function signedOut(message=""){state.epoch++;state.session=null;state.refresh=null;state.busy=false;state.loadId++;clearData();$("app").hidden=true;$("nav").hidden=true;$("logout").hidden=true;$("login").hidden=false;$("loginForm").reset();$("entryForm").reset();$("signIn").disabled=false;$("saveEntry").disabled=false;$("refresh").disabled=false;entryType();status("loginStatus",message,!!message)}
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
 try{const [settings,days,meters,purchases]=await Promise.all([
 list("solar_settings","installation_cost_zar,timezone,currency","owner_id.asc"),
 list("solar_daily","day,pv_kwh,load_kwh,grid_import_kwh,pv_covered_seconds,load_covered_seconds,grid_covered_seconds,mppt1_kwh,mppt2_kwh,soc_min_pct,soc_max_pct,pv_peak_w","day.asc"),
 list("solar_meter_readings","meter_type,recorded_at,reading,unit,source","recorded_at.asc,meter_type.asc"),
 list("solar_purchases","recorded_at,units_kwh,paid_zar,estimated_units,source","recorded_at.asc")
 ]);if(epoch!==state.epoch||id!==state.loadId)return false;
 state.data={settings:settings[0]||null,days,meters,purchases};render();status("appStatus","Connected · last retrieved "+localDate(Date.now()));return true
 }catch(e){if(epoch===state.epoch&&id===state.loadId)status("appStatus","Could not refresh: "+e.message+(state.data?". Previous data remains on screen.":""),true);return false}finally{if(epoch===state.epoch&&id===state.loadId)$("refresh").disabled=false}}
function card(label,value,sub="",cls=""){const c=el("div",undefined,"card");c.append(el("small",label),el("div",value,"value "+cls));if(sub)c.append(el("small",sub));return c}
function cards(id,items){$(id).replaceChildren(...items.map(x=>card(...x)))}
function rows(id,items){$(id).replaceChildren(...items.map(([label,value])=>{const r=el("div",undefined,"row");r.append(el("span",label,"muted"),el("strong",value));return r}))}
function table(id,values){$(id).replaceChildren(...values.map(values=>{const r=el("tr");for(const value of values)r.append(el("td",value));return r}))}
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
 rows("batteryStats",[["MPPT 1",quantity(s.mppt1,"kWh")],["MPPT 2",quantity(s.mppt2,"kWh")],["Lowest battery SOC",quantity(s.socMin,"%",0)],["Highest battery SOC",quantity(s.socMax,"%",0)]]);
 const known=d.purchases.filter(p=>number(p.paid_zar)!==null),spent=known.length?known.reduce((a,p)=>a+Number(p.paid_zar),0):null;
 cards("financialCards",[["System investment",money(d.settings?.installation_cost_zar),"All history"],["Known purchases",money(spent),"All recorded costs only"],["Estimated savings","Pending","Tariff migration required"],["Payback","Pending","No verified forecast"]]);
 rows("purchaseSummary",[["Purchase records",String(d.purchases.length)],["Unknown purchase amounts",String(d.purchases.length-known.length)],["Recorded units",d.purchases.length?quantity(d.purchases.reduce((a,p)=>a+Number(p.units_kwh),0),"kWh",2):"—"]]);
 cards("utilityCards",[["Electricity balance",latest?quantity(latest.reading,"kWh",2):"—",latest?localDate(latest.recorded_at):"No readings"],["Water meter",waterLast?fmt(waterLast.reading,0):"—",waterLast?localDate(waterLast.recorded_at)+" · raw units":"No readings"]]);
 table("meterRows",electric.slice(-20).reverse().map(r=>[localDate(r.recorded_at),fmt(r.reading,2)]));table("waterRows",water.slice(-20).reverse().map(r=>[localDate(r.recorded_at),fmt(r.reading,0)]));table("purchaseRows",d.purchases.slice(-20).reverse().map(r=>[localDate(r.recorded_at),fmt(r.units_kwh,4),money(r.paid_zar)]));
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
