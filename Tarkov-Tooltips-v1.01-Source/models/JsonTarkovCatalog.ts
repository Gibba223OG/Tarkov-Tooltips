import Item, { ItemTask } from "./Item";

// Convert live json.tarkov.dev catalog into FleaTooltip's original Item model.
// OCR/search/popup code remains unchanged.
type Data = Record<string, any>;
const API = "https://json.tarkov.dev";

async function getDataset(mode: string, resource: string): Promise<Data> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30000);
  try {
    const response = await fetch(API + "/" + mode + "/" + resource, {
      signal: ctrl.signal,
      headers: { "User-Agent": "FleaTooltip-JSONAPI/1.0", Accept: "application/json" }
    });
    if (!response.ok) throw new Error(resource + ": HTTP " + response.status);
    const payload: any = await response.json();
    if (!payload || !payload.data || typeof payload.data !== "object") {
      throw new Error(resource + ": invalid JSON API response");
    }
    return payload.data;
  } finally { clearTimeout(timeout); }
}
const num = (x: any) => typeof x === "number" && Number.isFinite(x) ? x : 0;

export async function fetchItemsFromJsonApi(usePveMode = false): Promise<Item[]> {
  const mode = usePveMode ? "pve" : "regular";
  const [catalog, names, traders, traderNames] = await Promise.all([
    getDataset(mode, "items"),
    getDataset(mode, "items_en"),
    getDataset(mode, "traders").catch((e) => {
      console.warn("Trader catalog missing:", e); return {} as Data;
    }),
    getDataset(mode, "traders_en").catch((e) => {
      console.warn("Trader translations missing:", e); return {} as Data;
    })
  ]);
  const rawItems: Data = catalog.items;
  if (!rawItems || typeof rawItems !== "object" || Array.isArray(rawItems)) {
    throw new Error("JSON API returned no item catalog");
  }
  if (!names || Object.keys(names).length === 0) {
    throw new Error("JSON API returned no English names (needed for OCR)");
  }
  const translated = (key: any): string => {
    if (typeof key !== "string") return "";
    const value = names[key];
    return (typeof value === "string" && value.trim()) ? value.trim() : key.trim();
  };
  const traderName = (id: string): string => {
    const record = traders[id];
    if (!record) return "N/A";
    const key = record.name;
    return typeof traderNames[key] === "string" ? traderNames[key]
      : (typeof key === "string" ? key : "N/A");
  };

  const items: Item[] = [];
  for (const [id, raw] of Object.entries(rawItems)) {
    if (!raw || typeof raw !== "object") continue;
    const itemId: string = raw.id || id;
    const name = translated(raw.name);
    const shortName = translated(raw.shortName) || name;
    if (!name || !itemId) continue;
    const offers: any[] = Array.isArray(raw.sellToTrader) ? raw.sellToTrader : [];
    const best = offers.filter(o => num(o?.priceRUB) > 0)
      .sort((a, b) => num(b.priceRUB) - num(a.priceRUB))[0];
    const avg24h = num(raw.avg24hPrice);
    const hasFlea = num(raw.lastOfferCount) > 0
      && (avg24h > 0 || num(raw.lastLowPrice) > 0);
    items.push({
      id: itemId,
      name,
      shortName,
      availableOnFleaMarket: hasFlea,
      slots: Math.max(1, num(raw.width) * num(raw.height)),
      prices: {
        latest: avg24h,
        avgDay: avg24h,
        avgWeek: 0,
        trader: { name: best ? traderName(best.trader) : "N/A",
                  price: best ? num(best.priceRUB) : 0 }
      },
      tasks: [] as ItemTask[],
      icon: typeof raw.iconLink === "string" ? raw.iconLink : "",
      isAmmoRound: raw.properties?.propertiesType === "ItemPropertiesAmmo",
      wikiPath: typeof raw.wikiLink === "string" ? (() => {
        try { return decodeURIComponent(new URL(raw.wikiLink).pathname).toLowerCase().replace(/\/$/, ""); }
        catch { return ""; }
      })() : ""
    });
  }
  if (!items.length) throw new Error("JSON API returned no usable items");
  console.log("Loaded " + items.length + " items via JSON API (" + mode + ")");
  return items;
}
