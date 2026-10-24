import Item from "./models/Item";

export function isDev() {
  return process.env["WEBPACK_SERVE"] === "true";
}

export function numberWithCommas(x: number | undefined) {
  if (x === undefined) {
    return x;
  }

  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Returns the best sell value for ONE whole item, not per inventory square.
export function getItemSellPrice(item: Item): number {
  const fleaValue = Math.max(0, Math.min(
    item.prices.avgDay ?? 0,
    item.prices.latest ?? 0
  ));
  const traderValue = Math.max(0, item.prices.trader?.price ?? 0);
  return !item.availableOnFleaMarket ? traderValue : Math.max(fleaValue, traderValue);
}

export function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
