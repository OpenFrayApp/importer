import type { StatBlock } from "./statblock.ts";

export type ImportedItem = {
  type: "statblock";
  data: StatBlock;
};
