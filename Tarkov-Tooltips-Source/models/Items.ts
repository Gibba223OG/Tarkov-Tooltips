import Item, { ItemTask } from "./Item";
import * as LiveData from "./TarkovLiveData";
import MiniSearch from "minisearch";

export default class Items {
  items: Item[];
  searchIndex: MiniSearch;
  public lastSearchReport: any = null;

  constructor() {
    this.items = [];
  }

  // v1.01: validated Tarkov.dev catalogue with persistent per-mode cache.
  async fetchItems(_unusedMarketKey?: string, usePveMode?: boolean): Promise<void> {
    this.items = await LiveData.fetchItems(Boolean(usePveMode));
  }

  getItemsPromise(usePveMode?: boolean): Promise<Item[]> {
    return LiveData.fetchItems(Boolean(usePveMode));
  }

  initializeSearchIndex(): void {
    if (!this.itemsAreLoaded()) {
      throw new Error(
        "Can't create search index for items, no items have been loaded"
      );
    }

    this.searchIndex = new MiniSearch({
      fields: ["name", "shortName"], // fields to index for full-text search
      searchOptions: {
        fuzzy: 0.2,
        prefix: true,
        boost: {
          shortName: 1.5,
        },
      },
    });

    this.searchIndex.addAll(this.items);
  }

  search(searchQuery: string, _lowestAcceptableScore = 0, fuzzyEnabled = true): Item {
    if (!this.searchIndex || !searchQuery?.trim()) return null;
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const target = normalize(searchQuery);
    const exact = this.items.find(i => normalize(i.name) === target);
    if (exact) {
      this.lastSearchReport = { reason: "exact normalized item name", resultId: exact.id };
      return exact;
    }
    // Short names are common in Tarkov's in-game item tooltips. Match
    // only a UNIQUE exact short name so ambiguous abbreviations cannot
    // silently choose an unrelated catalog item. No item-specific bans.
    let shortMatch: Item | null = null;
    let shortMatchCount = 0;
    for (const candidate of this.items) {
      if (candidate.shortName && normalize(candidate.shortName) === target) {
        shortMatch = candidate;
        if (++shortMatchCount > 1) break;
      }
    }
    if (shortMatchCount === 1 && shortMatch) {
      this.lastSearchReport = {
        reason: "unique exact normalized short name",
        resultId: shortMatch.id,
      };
      return shortMatch;
    }

    if (!fuzzyEnabled) {
      this.lastSearchReport = {
        reason: shortMatchCount > 1
          ? "exact short name ambiguous: rejected"
          : "exact-only: no full or unique short name match",
      };
      return null;
    }
    const ranked = this.searchIndex.search(searchQuery);
    const best = ranked.length ? this.getItemById(ranked[0].id) : null;
    this.lastSearchReport = {
      reason: best ? "experimental top fuzzy candidate (NOT verified)" : "no candidate",
      candidates: ranked.slice(0, 4).map(r => ({id:r.id,score:r.score}))
    };
    return best;
  }

  getItemById(id: string): Item {
    if (!this.itemsAreLoaded()) {
      throw new Error("Can't get items, no items have been loaded");
    }

    const itemsMatchedByFilter: Item[] = this.items.filter(
      (item) => item.id === id
    );

    if (itemsMatchedByFilter.length === 0) {
      return null;
    }

    return itemsMatchedByFilter[0];
  }

  itemsAreLoaded(): boolean {
    if (!this.items || this.items.length === 0) {
      return false;
    }

    return true;
  }
}
