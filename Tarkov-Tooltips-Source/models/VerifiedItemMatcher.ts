import Item from "./Item";

// Conservative OCR name resolver. A wrong item gives a believable but false price;
// ambiguous OCR must produce no popup instead of an arbitrary MiniSearch hit.
export type RankedHit = { id: string; score: number };

export function normalizeItemName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const itemTypes = [
  "magazine", "pistol", "assault rifle", "stock", "handguard",
  "suppressor", "muzzle brake", "helmet", "backpack", "grip",
  "gas tube", "scope", "key", "ammo pack", "armor", "medical",
];

export class VerifiedItemMatcher {
  public lastDecision = "not run";
  private reject(reason: string): null {
    this.lastDecision = reason;
    return null;
  }
  private accept(item: Item, method: string): Item {
    this.lastDecision = method;
    return item;
  }
  private byId = new Map<string, Item>();
  private fullName = new Map<string, Item[]>();
  private shortName = new Map<string, Item[]>();
  private fullNames: { normalized: string; item: Item }[];

  constructor(items: Item[]) {
    this.fullNames = [];
    for (const item of items) {
      this.byId.set(item.id, item);
      const full = normalizeItemName(item.name);
      const short = normalizeItemName(item.shortName);
      if (!full) continue;
      this.fullNames.push({ normalized: full, item });
      const matchNames = this.fullName.get(full) || [];
      matchNames.push(item);
      this.fullName.set(full, matchNames);
      if (short) {
        const matchShorts = this.shortName.get(short) || [];
        matchShorts.push(item);
        this.shortName.set(short, matchShorts);
      }
    }
  }

  match(raw: string, rankedHits: RankedHit[], minimumScore = 50): Item | null {
    const query = normalizeItemName(raw);
    this.lastDecision = "no confirmed match";
    if (!query) return this.reject("OCR name empty after normalization");

    // Exact English item name is decisive unless duplicate IDs share a name.
    const fullMatches = this.fullName.get(query) || [];
    if (fullMatches.length) return fullMatches.length === 1
      ? this.accept(fullMatches[0], "unique exact full name")
      : this.reject("duplicate full names");

    // Full OCR sometimes appends price or extra lines. Match the complete item
    // name inside the OCR stream, but NEVER a tiny short name.
    if (query.length >= 12) {
      const embedded = this.fullNames.filter(({ normalized }) => {
        if (normalized.length < 10) return false;
        return query === normalized ||
          query.startsWith(normalized + " ") ||
          query.endsWith(" " + normalized) ||
          query.includes(" " + normalized + " ");
      });
      if (embedded.length) {
        const maxLength = Math.max(...embedded.map(x => x.normalized.length));
        const longest = embedded.filter(x => x.normalized.length === maxLength);
        return longest.length === 1
          ? this.accept(longest[0].item, "complete item name embedded in OCR")
          : this.reject("multiple embedded item names");
      }
    }

    // Unique exact shorthand such as "6L20" is safe. "PM" and "AK-12"
    // each refer to multiple completely different items.
    const shorts = this.shortName.get(query) || [];
    if (shorts.length) return shorts.length === 1
      ? this.accept(shorts[0], "unique exact short name")
      : this.reject("ambiguous short name");

    // Do not guess a full item from a two-to-five-character abbreviation.
    if (query.length < 6 || query.split(" ").length < 2)
      return this.reject("short or single-token OCR without unique match");

    const queryWords = query.split(" ");
    const specificNumbers = queryWords.filter(token =>
      token.length >= 2 && /\d/.test(token)
    );
    const requiredTypes = itemTypes.filter(type => query.includes(type));
    const usable = rankedHits
      .filter(hit => hit.score > 0 && this.byId.has(hit.id))
      .map(hit => ({ ...hit, item: this.byId.get(hit.id)! }))
      .filter(hit => {
        const name = normalizeItemName(hit.item.name);
        const tokens = new Set(name.split(" "));
        // An exact OCR model number must not turn into a different model.
        if (!specificNumbers.every(token => tokens.has(token))) return false;
        if (!requiredTypes.every(type => name.includes(type))) return false;
        return true;
      });

    if (!usable.length) return this.reject("no candidate passes required model number/item type");
    const best = usable[0];
    const runnerUp = usable[1];

    // A partial OCR read may contain a model family but not an item identifier.
    // Require a strong candidate margin, and respect existing sensitivity.
    if (best.score <= minimumScore) return this.reject("candidate below configured score threshold");
    if (runnerUp && best.score < runnerUp.score * 1.55)
      return this.reject("leading candidates too close in score");

    // Require meaningful overlap instead of accepting a high MiniSearch score
    // produced by the boosted short-name field alone.
    const bestWords = new Set(normalizeItemName(best.item.name).split(" "));
    const meaningful = queryWords.filter(w => w.length > 2);
    const overlaps = meaningful.filter(w => bestWords.has(w));
    if (meaningful.length && overlaps.length < Math.ceil(meaningful.length * 0.6)) {
      return this.reject("insufficient full-name token overlap");
    }
    return this.accept(best.item, "fuzzy match confirmed by token/model checks");
  }
}
