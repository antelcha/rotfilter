import type { Stats } from "../shared/types";
const KEY = "stats";
const EMPTY: Stats = { seen:0,evaluated:0,filtered:0,revealed:0,wrongCalls:0,apiErrors:0,cacheHits:0 };
export async function getStats(): Promise<Stats> { return { ...EMPTY, ...((await chrome.storage.local.get(KEY))[KEY] as Partial<Stats>) }; }
export async function incrementStat(name: keyof Stats) { const stats = await getStats(); stats[name]++; await chrome.storage.local.set({ [KEY]: stats }); }
export async function clearStats() { await chrome.storage.local.set({ [KEY]: EMPTY }); }

