import type { AmmoStats } from "./Item";

// Supports the two actual MediaWiki Ballistics layouts:
// 15 td: ammo name starts the row.
// 16 td: a separate caliber cell precedes ammo name.
// In both layouts the final six cells are the Wiki's armor class ratings.
const slugOfWikiHref = (href: string): string => {
  try {
    const url = new URL(href.replace(/&amp;/g, "&"), "https://escapefromtarkov.fandom.com");
    if (url.hostname !== "escapefromtarkov.fandom.com") return "";
    const slug = decodeURIComponent(url.pathname).toLowerCase().replace(/\/$/, "");
    return slug.startsWith("/wiki/") ? slug : "";
  } catch { return ""; }
};

const clean = (value: string): string => value.replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"').replace(/&#(\d+);/g,
    (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/\s+/g, " ").trim();

export const isValidWikiDamage = (value: unknown): value is number | string =>
  (typeof value === "number" && Number.isInteger(value) && value >= 0) ||
  (typeof value === "string" && /^\d+x\d+$/.test(value) &&
    value.split("x").every(n => Number(n) > 0));

export const isValidWikiAmmo = (record: any): record is AmmoStats =>
  !!record && typeof record.name === "string" && record.name.length > 0 &&
  isValidWikiDamage(record.damage) &&
  Number.isInteger(record.penetration) && record.penetration >= 0 &&
  Array.isArray(record.ratings) && record.ratings.length === 6 &&
  record.ratings.every((rating: unknown) =>
    Number.isInteger(rating) && (rating as number) >= 0 &&
    (rating as number) <= 6);

export function parseWikiBallistics(raw: string): Record<string, AmmoStats> {
  const next: Record<string, AmmoStats> = {};
  for (const row of raw.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length !== 15 && cells.length !== 16) continue;
    const start = cells.length === 16 ? 1 : 0;
    const values = cells.map(cell => clean(cell[1]));
    const damageText = values[start + 1].replace(/\s+/g, "").replace(/×/g, "x");
    // For pellets, retain "8x39" exactly: pellet count x damage per pellet.
    const damage = /^\d+$/.test(damageText) ? Number(damageText) : damageText;
    const penetration = Number(values[start + 2]);
    const ratings = values.slice(-6).map(Number);
    const link = cells[start][1].match(/<a\b[^>]*href="([^"]+)"/i);
    if (!link) continue;
    const slug = slugOfWikiHref(link[1]);
    const record = {name: values[start], damage, penetration, ratings};
    if (!slug || !/^\d+$/.test(values[start + 2]) ||
      !values.slice(-6).every(v => /^[0-6]$/.test(v)) ||
      !isValidWikiAmmo(record)) continue;
    if (next[slug]) throw new Error("Duplicate ammunition Wiki URL: " + slug);
    next[slug] = record;
  }
  // Reject truncated or structurally incompatible live pages as a whole,
  // so an incomplete refresh never replaces our last known-good data.
  if (Object.keys(next).length < 180) {
    throw new Error("Wiki Ballistics table incomplete");
  }
  return next;
}
