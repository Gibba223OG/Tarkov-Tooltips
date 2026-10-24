import Item from "./Item";
export function fetchItems(pve?: boolean): Promise<Item[]>;
export function enrich(item: Item, pve?: boolean): Item;
export function getStatus(): Record<string, any>;
export function refreshExtra(mode: string, part: string): Promise<any>;
