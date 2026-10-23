import Item, { ItemTask } from "./Item";
import { fetchItemsFromJsonApi } from "./JsonTarkovCatalog";
import MiniSearch from "minisearch";
import request from "request";
import TarkovMarketItem from "./TarkovMarketItem";
import { Form } from "react-router-dom/dist";
import fs from "fs";
import path from "path";
import { app } from "electron";
import { isDev } from "../utils";

export default class Items {
  items: Item[];
  searchIndex: MiniSearch;
  public lastSearchReport: any = null;

  constructor() {
    this.items = [];
  }

  async fetchItems(apiKey?: string, usePveMode?: boolean): Promise<void> {
    const tarkovMarketApiKey = apiKey || "";

    // Keep the last good item catalog if a background refresh fails.

    try {
      if (tarkovMarketApiKey.trim() !== "") {
        console.log("Using Tarkov Market API key for item fetch");

        const res = await fetch(
          "https://api.tarkov-market.app/api/v1/items/all",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "x-api-key": tarkovMarketApiKey,
            },
          }
        );

        if (!(res.status == 200 || res.status == 204)) {
          throw new Error("Failed to fetch items");
        }

        const data: TarkovMarketItem[] = await res.json();
        const formattedData: Item[] = data.map((item: TarkovMarketItem) => {
          return {
            id: item.uid,
            name: item.name,
            shortName: item.shortName,
            availableOnFleaMarket: !item.bannedOnFlea,
            slots: item.slots,
            prices: {
              latest: item.price,
              avgDay: item.avg24hPrice,
              avgWeek: item.avg7daysPrice,
              trader: {
                name: item.traderName,
                price: item.traderPriceRub,
              },
            },
            tasks: [] as ItemTask[],
            icon: item.icon,
          };
        });

        this.items = formattedData;
      } else {
        console.log("No API key provided, fetching items from Tarkov.dev API");
        const itemsFromApi = await this.getItemsPromise(usePveMode);
        console.log(itemsFromApi.length + " items fetched from API");
        this.items = itemsFromApi;
      }
    } catch (error) {
      console.error("Failed to fetch items from Tarkov Market API:", error);

      // If Tarkov Market API fails and we have an API key, don't fall back
      // If we don't have an API key, we already tried Tarkov.dev above
      if (tarkovMarketApiKey.trim() === "") {
        throw new Error("Failed to fetch items from API");
      }

      // Try Tarkov.dev as fallback when API key fails
      try {
        console.log("Falling back to Tarkov.dev API");
        const itemsFromApi = await this.getItemsPromise(usePveMode);
        console.log(itemsFromApi.length + " items fetched from API");
        this.items = itemsFromApi;
      } catch (fallbackError) {
        console.error(
          "Failed to fetch items from Tarkov.dev API:",
          fallbackError
        );
        throw new Error("Failed to fetch items from API");
      }
    }
  }

  getItemsPromise(usePveMode?: boolean): Promise<Item[]> {
    return fetchItemsFromJsonApi(Boolean(usePveMode));
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
