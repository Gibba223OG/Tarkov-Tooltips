export default class Item {
  id: string;
  ocrText?: string;
  ocrMs?: number;
  unmatched?: boolean;
  name: string;
  shortName: string;
  availableOnFleaMarket: boolean;
  prices: ItemPrices;
  slots: number;
  tasks: ItemTask[];
  liveQuestTasks?: ItemTask[];
  barterUsed?: boolean;
  icon: string;
  wikiPath?: string;
  isAmmoRound?: boolean;
  ammoStats?: AmmoStats;
}

// Damage can be a pellet count x per-pellet damage (e.g. "8x39") from Wiki.
export type AmmoStats = { name: string; damage: number | string; penetration: number; ratings: number[] };

type ItemPrices = {
  latest: number;
  avgDay: number;
  avgWeek: number;
  trader: TraderPrice;
};

type TraderPrice = {
  name: string;
  price: number;
};

export type ItemTask = {
  task: string;
  count: number;
  inRaid: boolean;
};

export class ClientItem extends Item {
  count: number;
  mostRecentlyAddedItem: boolean;

  constructor(item: Item) {
    super();
    this.availableOnFleaMarket = item.availableOnFleaMarket;
    this.id = item.id;
    this.name = item.name;
    this.prices = item.prices;
    this.shortName = item.shortName;
    this.slots = item.slots;
    this.tasks = item.tasks;
    this.count = 1;
    this.mostRecentlyAddedItem = false;
    this.icon = item.icon;
  }
}
