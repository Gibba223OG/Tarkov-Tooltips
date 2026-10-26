// Settings-only API state panel; no changes to hover popup or React state.
(()=>{
 "use strict";
 let panel=null,lastKey="";
 const label=(st)=>{
  if(!st)return "Not loaded";
  const map={live:"Live",cached:"Cached (offline fallback)",unavailable:"Unavailable","not-loaded":"Not fetched","disk cache available":"Disk cache ready","packaged fallback":"Packaged fallback"};
  let val=map[st.state]||st.state;
  if(st.updated){
   const date=new Date(st.updated);
   if(!Number.isNaN(date.getTime()))val+=" · Last successful update: "+date.toLocaleString();
  }
  if(st.error)val+=" · Last error: "+st.error.slice(0,110);
  return val;
 };
 function ensure(){
  const title=[...document.querySelectorAll("h1")].find(el=>el.textContent?.includes("Tarkov Tooltips Settings"));
  if(!title)return null;
  const head=title.closest("header");
  if(!head)return null;
  if(panel && panel.isConnected)return panel;
  panel=document.createElement("section");
  panel.setAttribute("aria-label","API status");
  panel.style.cssText="background:#24282a;color:#e4e1d6;border:1px solid #44494a;border-radius:5px;padding:9px;margin:8px 0 12px;font:13px sans-serif;line-height:1.5;";
  panel.innerHTML="<div style='font-size:15px;font-weight:600;margin-bottom:4px'>API &amp; offline cache status</div><div data-tt-status>Loading…</div>";
  head.parentElement.appendChild(panel);
  lastKey="";
  return panel;
 }
 async function update(){
  const host=ensure();
  if(!host||!window.ttDataStatus?.get||!window.electron?.getUserConfig)return;
  try{
   const [response,config]=await Promise.all([window.ttDataStatus.get(),window.electron.getUserConfig()]);
   const mode=config?.usePveMode?"pve":"regular";
   const status=response[mode]||{};
   const records=[
    ["Tarkov.dev · Items / prices",status.items],
    ["Tarkov.dev · Quest requirements",status.quests],
    ["Tarkov.dev · Trader barters",status.barters],
    ["Tarkov Wiki · Ammunition",response.ammo]
   ];
   const next=JSON.stringify([mode,records]);
   if(next===lastKey)return;
   lastKey=next;
   const body=host.querySelector("[data-tt-status]");
   if(!body)return;
   body.replaceChildren();
   const heading=document.createElement("div");
   heading.textContent="Selected game mode: "+(mode==="pve"?"PvE":"Regular");
   heading.style.cssText="color:#e4e1d6;margin-bottom:4px";
   body.appendChild(heading);
   for(const [name,st] of records){
    const row=document.createElement("div");
    row.style.cssText="margin:3px 0";
    const nameSpan=document.createElement("span");
    nameSpan.style.cssText="font-weight:600;color:#d4dacf";
    nameSpan.textContent=name+": ";
    const value=document.createElement("span");
    value.style.color="#b4c3ba";
    value.textContent=label(st);
    row.append(nameSpan,value);
    body.appendChild(row);
   }
   const note=document.createElement("div");
   note.textContent="The ammunition entry reports the existing cache/fallback; it does not claim a live Wiki connection.";
   note.style.cssText="color:#a6aca9;font-size:11px;margin-top:5px";
   body.appendChild(note);
  }catch(err){
   const el=host.querySelector("[data-tt-status]");
   if(el)el.textContent="Status unavailable: "+String(err);
  }
 }
 const obs=new MutationObserver(()=>{if(!panel?.isConnected)void update()});
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{obs.observe(document.documentElement,{childList:true,subtree:true});void update()});
 else{obs.observe(document.documentElement,{childList:true,subtree:true});void update()}
 setInterval(()=>{void update()},12000);
})();
