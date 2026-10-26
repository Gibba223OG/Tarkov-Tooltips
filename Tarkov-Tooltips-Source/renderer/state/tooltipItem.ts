/* eslint-disable @typescript-eslint/ban-ts-comment */
import { hookstate } from "@hookstate/core";
import Item from "../../models/Item";
import IpcConstants from "../../models/IpcConstants";

export const TOOLTIP_ITEM = hookstate<Item | null>(null);

export async function setTooltipItem(item: Item | null) {
  TOOLTIP_ITEM.set(item);
}

// @ts-expect-error
window.electron.receive(
  IpcConstants.NewTooltipItem,
  (event: any, newItem: Item | null) => {
    setTooltipItem(newItem);
  }
);
