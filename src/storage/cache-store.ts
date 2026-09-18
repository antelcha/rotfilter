import { CACHE_LIMIT } from "../shared/constants";
import type { CachedEvaluation } from "../shared/types";
const KEY = "classificationCache";
type Cache = Record<string, CachedEvaluation>;
const cacheKey = (filterHash: string, tweetId: string) => `${filterHash}:${tweetId}`;
async function all(): Promise<Cache> { return ((await chrome.storage.local.get(KEY))[KEY] as Cache | undefined) ?? {}; }
export async function getCached(filterHash: string, tweetId: string) { return (await all())[cacheKey(filterHash, tweetId)]; }
export async function putCached(entry: CachedEvaluation) {
  const cache = await all(); cache[cacheKey(entry.filterHash, entry.tweetId)] = entry;
  const values = Object.entries(cache);
  if (values.length > CACHE_LIMIT) {
    values.sort(([,a],[,b]) => a.evaluatedAt - b.evaluatedAt).slice(0, values.length - CACHE_LIMIT).forEach(([key]) => delete cache[key]);
  }
  await chrome.storage.local.set({ [KEY]: cache });
}
export async function clearCache() { await chrome.storage.local.remove(KEY); }
