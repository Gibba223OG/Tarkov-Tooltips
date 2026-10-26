"use strict";
// Tarkov Tooltips live data + offline cache module. Added for the standalone build.
// This module never reads user configuration and never writes on hover.
const fs=require("fs"), path=require("path");
const {app,ipcMain}=require("electron");
const ROOT="https://json.tarkov.dev";
const MONEY=new Set(["5449016a4bdc2d6f028b456f","5696686a4bdc2da3298b456a","569668774bdc2da2298b4568"]);
const memory={regular:{},pve:{}};
const statuses={regular:{},pve:{}};
const pending=new Map();
const asMode=flag=>flag?"pve":"regular";
const cachePath=(mode,part)=>path.join(app.getPath("userData"),"data-cache-v2",mode+"-"+part+".json");
function state(mode,part){return statuses[mode][part]||(statuses[mode][part]={state:"not-loaded",updated:null,error:null,count:0});}
function cloneStatus(s){return JSON.parse(JSON.stringify(s));}
function getStatus(){
 for(const mode of ["regular","pve"])for(const part of ["items","quests","barters"]) {
  if(!memory[mode][part])loadStored(mode,part);
 }
 let ammo={state:"packaged fallback",updated:null};
 try {
  const p=path.join(app.getPath("userData"),"ammo-wiki-cache.json");
  if(fs.existsSync(p)){
   const d=JSON.parse(fs.readFileSync(p,"utf8"));
   if(d.version===1&&d.rows&&Object.keys(d.rows).length>=125)
    ammo={state:globalThis.__TTWikiLastVerifiedAt?"live":"disk cache available",updated:globalThis.__TTWikiLastVerifiedAt||d.checkedAt||null};
  }
 }catch{}
 return {regular:cloneStatus(statuses.regular),pve:cloneStatus(statuses.pve),ammo};
}
function loadStored(mode,part){
 if(memory[mode][part])return memory[mode][part];
 try {
  const d=JSON.parse(fs.readFileSync(cachePath(mode,part),"utf8"));
  if(d.version!==2||d.mode!==mode||d.part!==part||!valid(part,d.payload))throw Error("invalid local cache");
  memory[mode][part]=d.payload;
  Object.assign(state(mode,part),{state:"cached",updated:d.updated||null,count:count(part,d.payload),error:null});
  return d.payload;
 } catch { return null; }
}
function count(part,v){return part==="items"?v.length:part==="quests"?Object.keys(v).length:v.length;}
function valid(part,v){
 if(part==="items")return Array.isArray(v)&&v.length>1000&&v.every(x=>typeof x.id==="string"&&!!x.name&&x.prices&&x.prices.trader);
 if(part==="quests")return v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length>100;
 if(part==="barters")return Array.isArray(v)&&v.length>100&&v.every(x=>typeof x==="string"&&x.length>=20);
 return false;
}
function install(mode,part,payload){
 if(!valid(part,payload))throw new Error("Rejected incomplete "+part+" dataset");
 const now=new Date().toISOString(),target=cachePath(mode,part),temp=target+".tmp-"+process.pid;
 fs.mkdirSync(path.dirname(target),{recursive:true});
 try{fs.writeFileSync(temp,JSON.stringify({version:2,mode,part,updated:now,payload}),"utf8");fs.renameSync(temp,target);}
 catch(e){try{fs.unlinkSync(temp)}catch{};throw e}
 memory[mode][part]=payload;
 Object.assign(state(mode,part),{state:"live",updated:now,count:count(part,payload),error:null});
 return payload;
}
async function fetchData(mode,resource){
 const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),30000);
 try{
  const res=await fetch(ROOT+"/"+mode+"/"+resource,{signal:ctrl.signal,headers:{"User-Agent":"TarkovTooltips/1.01","Accept":"application/json"}});
  if(!res.ok)throw Error(resource+" HTTP "+res.status);
  const data=(await res.json()).data;
  if(!data||typeof data!=="object")throw Error(resource+" invalid response");
  return data;
 }finally{clearTimeout(timeout);}
}
const num=v=>typeof v==="number"&&Number.isFinite(v)?v:0;
function convertItems(dataset,names,traders,traderNames){
 const table=dataset.items;
 if(!table||typeof table!=="object"||Object.keys(table).length<1000||Object.keys(names).length<1000)throw Error("incomplete item catalog");
 const tr=k=>typeof k==="string"?(typeof names[k]==="string"&&names[k].trim()?names[k].trim():k.trim()):"";
 const getTrader=id=>{
  const rec=traders[id],key=rec&&rec.name;
  return typeof traderNames[key]==="string"?traderNames[key]:typeof key==="string"?key:"N/A";
 };
 const rows=[];
 for(const [id,raw] of Object.entries(table)){
  if(!raw||typeof raw!=="object")continue;
  const itemId=raw.id||id,name=tr(raw.name),shortName=tr(raw.shortName)||name;
  if(!itemId||!name)continue;
  const offers=Array.isArray(raw.sellToTrader)?raw.sellToTrader:[];
  const best=offers.filter(x=>num(x?.priceRUB)>0).sort((a,b)=>num(b.priceRUB)-num(a.priceRUB))[0];
  const avg=num(raw.avg24hPrice);
  rows.push({id:itemId,name,shortName,availableOnFleaMarket:num(raw.lastOfferCount)>0&&(avg>0||num(raw.lastLowPrice)>0),slots:Math.max(1,num(raw.width)*num(raw.height)),
   prices:{latest:avg,avgDay:avg,avgWeek:0,trader:{name:best?getTrader(best.trader):"N/A",price:best?num(best.priceRUB):0}},
   tasks:[],icon:typeof raw.iconLink==="string"?raw.iconLink:"",
   isAmmoRound:raw.properties?.propertiesType==="ItemPropertiesAmmo",
   wikiPath:typeof raw.wikiLink==="string"?(()=>{try{return decodeURIComponent(new URL(raw.wikiLink).pathname).toLowerCase().replace(/\/$/,"")}catch{return""}})():""});
 }
 if(rows.length<1000)throw Error("too few translated items");
 return rows;
}
function buildQuests(data,names){
 if(!data.tasks||Object.keys(data.tasks).length<350)throw Error("incomplete task list");
 const index={};let records=0;
 for(const t of Object.values(data.tasks)){
  if(!t||!Array.isArray(t.objectives))continue;
  const title=names[t.name]||t.name;
  if(typeof title!=="string"||!title.trim()||title===t.name)continue;
  const merged=new Map();
  for(const o of t.objectives){
   if(!["giveItem","findItem","plantItem"].includes(o.type)||!Array.isArray(o.items))continue;
   const amount=num(o.count);
   if(!(amount>0))continue;
   for(const id of o.items){
    if(typeof id!=="string")continue;
    const prev=merged.get(id);
    if(!prev||o.type==="giveItem"&&prev.type!=="giveItem")
     merged.set(id,{type:o.type,task:title,count:amount,inRaid:!!o.foundInRaid});
    else if(o.type===prev.type)prev.inRaid=prev.inRaid||!!o.foundInRaid;
   }
  }
  for(const [id,rec] of merged){
   (index[id]||(index[id]=[])).push({task:rec.task,count:rec.count,inRaid:rec.inRaid});
   records++;
  }
 }
 if(records<250||Object.keys(index).length<100)throw Error("too few translated quest requirements");
 return index;
}
function buildBarters(data){
 if(!Array.isArray(data)||data.length<400)throw Error("incomplete barter offers");
 const ids=new Set();
 for(const b of data)if(b&&Array.isArray(b.requiredItems)&&b.requiredItems.some(x=>x&&typeof x.item==="string"&&!MONEY.has(x.item))){
  for(const req of b.requiredItems)if(req&&typeof req.item==="string"&&!MONEY.has(req.item))ids.add(req.item);
 }
 return [...ids];
}
async function refreshExtra(mode,part){
 const key=mode+":"+part;if(pending.has(key))return pending.get(key);
 const promise=(async()=>{
  loadStored(mode,part);
  try {
   const result=part==="quests"
    ?buildQuests(await fetchData(mode,"tasks"),await fetchData(mode,"tasks_en"))
    :buildBarters(await fetchData(mode,"barters"));
   return install(mode,part,result);
  }catch(e){
   const cached=loadStored(mode,part),st=state(mode,part);
   st.state=cached?"cached":"unavailable";st.error=String(e);
   return cached;
  }
 })().finally(()=>pending.delete(key));
 pending.set(key,promise);return promise;
}
async function fetchItems(pve){
 const mode=asMode(pve);
 // Additional endpoints refresh independently, never blocking item recognition.
 void refreshExtra(mode,"quests");void refreshExtra(mode,"barters");
 loadStored(mode,"items");
 try{
  const [raw,names,traders,traderNames]=await Promise.all([
   fetchData(mode,"items"),fetchData(mode,"items_en"),
   fetchData(mode,"traders").catch(()=>({})),
   fetchData(mode,"traders_en").catch(()=>({}))
  ]);
  return install(mode,"items",convertItems(raw,names,traders,traderNames));
 }catch(e){
  const previous=loadStored(mode,"items"),st=state(mode,"items");
  st.state=previous?"cached":"unavailable";st.error=String(e);
  if(previous)return previous;
  throw new Error("Tarkov.dev unavailable and no valid cached item database: "+String(e));
 }
}
function enrich(item,pve){
 if(!item||!item.id)return item;
 // Settings' Quest Popup uses a deliberately synthetic item ID, not a real
 // Tarkov catalog entry. Provide stable demonstration-only rows regardless
 // of live API/cache availability, without changing normal quest policies.
 if(item.id==="pricechecker-settings-test-only"&&item.name==="Screw nuts"){
  return {...item,liveQuestTasks:[
   {task:"Sample quest (Found in Raid)",count:3,inRaid:true},
   {task:"Sample quest (no FIR requirement)",count:2,inRaid:false}
  ]};
 }
 const mode=asMode(pve),quests=loadStored(mode,"quests"),barters=loadStored(mode,"barters");
 const result={...item};
 if(quests)result.liveQuestTasks=Array.isArray(quests[item.id])?quests[item.id]:[];
 if(barters)result.barterUsed=barters.includes(item.id);
 return result;
}
const moduleApi={fetchItems,refreshExtra,enrich,getStatus,loadStored,buildQuests,buildBarters,convertItems};
app.whenReady().then(()=>{if(!ipcMain.isTTStatusRegistered){ipcMain.handle("tt-data-status",()=>getStatus());ipcMain.isTTStatusRegistered=true;}});
module.exports=moduleApi;
