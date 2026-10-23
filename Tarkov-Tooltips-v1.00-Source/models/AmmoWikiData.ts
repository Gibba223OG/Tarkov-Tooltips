import { app } from "electron";
import fs from "fs";
import path from "path";
import log from "electron-log";
import Item, { AmmoStats } from "./Item";
import { AMMO_IDENTITY_SEED, AMMO_WIKI_SEED } from "./AmmoWikiSeed";
import { AMMO_WIKI_EXPANDED_SEED } from "./AmmoWikiExpandedSeed";
import { isValidWikiAmmo, parseWikiBallistics } from "./AmmoWikiParser";

// Only wiki page slugs and API-confirmed ammunition item IDs are used.
const ENDPOINT = "https://escapefromtarkov.fandom.com/api.php?action=parse&page=Ballistics&prop=text&format=json&formatversion=2&origin=*";
const slugOf = (input: string): string => {
  try { return decodeURIComponent(new URL(input, "https://escapefromtarkov.fandom.com").pathname).toLowerCase().replace(/\/$/, ""); }
  catch { return ""; }
};
export default class AmmoWikiData {
  private records: Record<string,AmmoStats> = {
    ...AMMO_WIKI_SEED, ...AMMO_WIKI_EXPANDED_SEED
  };
  private readonly cachePath: string;
  constructor() {
    this.cachePath=path.join(app.getPath("userData"),"ammo-wiki-cache.json");
    try {
      const saved=JSON.parse(fs.readFileSync(this.cachePath,"utf8"));
      // Version 1 caches predate the 16-column/pellet parser and are
      // incomplete. Use expanded packaged Wiki data until a fresh refresh.
      if (saved?.version===2 && saved.rows && Object.keys(saved.rows).length>=180 &&
        Object.entries(saved.rows).every(([slug,record]:[string,any])=>
          slug.startsWith("/wiki/") && isValidWikiAmmo(record))) {
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
      const newRows=parseWikiBallistics(payload.parse.text);
      if (JSON.stringify(this.records)!==JSON.stringify(newRows)) {
        const target=this.cachePath+".tmp";
        fs.writeFileSync(target,JSON.stringify({version:2,checkedAt:
          new Date().toISOString(),source:"Tarkov Wiki Ballistics",rows:newRows}),"utf8");
        fs.renameSync(target,this.cachePath);
        this.records=newRows;
        log.info("Ammo Wiki cache refreshed",Object.keys(newRows).length);
      } else log.info("Ammo Wiki already current",Object.keys(newRows).length);
    } catch(e) {log.warn("Ammo Wiki refresh failed; retaining validated cache",e);}
    finally {clearTimeout(timeout);}
  }
}
