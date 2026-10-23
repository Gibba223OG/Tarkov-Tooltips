import { app } from "electron";
import fs from "fs";
import path from "path";
import log from "electron-log";
import Item, { AmmoStats } from "./Item";
import { AMMO_IDENTITY_SEED, AMMO_WIKI_SEED } from "./AmmoWikiSeed";

// Only wiki page slugs and API-confirmed ammunition item IDs are used.
const ENDPOINT = "https://escapefromtarkov.fandom.com/api.php?action=parse&page=Ballistics&prop=text&format=json&formatversion=2&origin=*";
const slugOf = (input: string): string => {
  try { return decodeURIComponent(new URL(input, "https://escapefromtarkov.fandom.com").pathname).toLowerCase().replace(/\/$/, ""); }
  catch { return ""; }
};
const clean = (v: string) => v.replace(/<[^>]*>/g," ")
  .replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g," ").trim();
function parseWiki(raw: string): Record<string,AmmoStats> {
  const next: Record<string,AmmoStats> = {};
  for (const row of raw.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const td = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if (td.length !== 15) continue;
    const values = td.map(m=>clean(m[1]));
    if (!/^\d+$/.test(values[1]) || !/^\d+$/.test(values[2]) ||
        !values.slice(9,15).every(v=>/^[0-6]$/.test(v))) continue;
    const a=td[0][1].match(/<a\b[^>]*href="([^"]+)"/i);
    if (!a) continue;
    const slug=slugOf(a[1].replace(/&amp;/g,"&"));
    if (!slug || next[slug]) throw new Error("Duplicate/missing ammo Wiki URL");
    next[slug]={name:values[0],damage:Number(values[1]),
      penetration:Number(values[2]),ratings:values.slice(9,15).map(Number)};
  }
  if (Object.keys(next).length<125) throw new Error("Wiki table incomplete");
  return next;
}
export default class AmmoWikiData {
  private records: Record<string,AmmoStats> = AMMO_WIKI_SEED;
  private readonly cachePath: string;
  constructor() {
    this.cachePath=path.join(app.getPath("userData"),"ammo-wiki-cache.json");
    try {
      const saved=JSON.parse(fs.readFileSync(this.cachePath,"utf8"));
      if (saved?.version===1 && saved.rows && Object.keys(saved.rows).length>=125 &&
        Object.entries(saved.rows).every(([slug,record]:[string,any])=>
          slug.startsWith("/wiki/") && Number.isInteger(record?.damage) &&
          record.damage>0 && Number.isInteger(record.penetration) &&
          record.penetration>=0 && Array.isArray(record.ratings) &&
          record.ratings.length===6 && record.ratings.every((n:any)=>
          Number.isInteger(n) && n>=0 && n<=6))) {
        this.records=saved.rows;
        log.info("Ammo Wiki cache loaded",Object.keys(saved.rows).length);
      }
    } catch { log.info("Using packaged Ammo Wiki fallback"); }
  }
  getForItem(item:Item):AmmoStats|null {
    if (!item.isAmmoRound && !AMMO_IDENTITY_SEED[item.id]) return null;
    const slug=slugOf(item.wikiPath||AMMO_IDENTITY_SEED[item.id]||"");
    const found=slug && this.records[slug];
    return found?{...found,ratings:[...found.ratings]}:null;
  }
  async refresh():Promise<void> {
    const ctrl=new AbortController();
    const timeout=setTimeout(()=>ctrl.abort(),15000);
    try {
      const r=await fetch(ENDPOINT,{signal:ctrl.signal,headers:{
        "User-Agent":"PriceCheckerAmmo/1.2.8","Accept":"application/json"}});
      if (!r.ok) throw new Error("Wiki HTTP "+r.status);
      const payload:any=await r.json();
      if (typeof payload?.parse?.text!=="string") throw new Error("Missing Wiki table");
      const newRows=parseWiki(payload.parse.text);
      if (JSON.stringify(this.records)!==JSON.stringify(newRows)) {
        const target=this.cachePath+".tmp";
        fs.writeFileSync(target,JSON.stringify({version:1,checkedAt:
          new Date().toISOString(),source:"Tarkov Wiki Ballistics",rows:newRows}),"utf8");
        fs.renameSync(target,this.cachePath);
        this.records=newRows;
        log.info("Ammo Wiki cache refreshed",Object.keys(newRows).length);
      } else log.info("Ammo Wiki already current",Object.keys(newRows).length);
    } catch(e) {log.warn("Ammo Wiki refresh failed; retaining validated cache",e);}
    finally {clearTimeout(timeout);}
  }
}
