export type Feedback = { tweetId: string; type: "false_positive" | "false_negative"; createdAt: number };
const KEY = "feedback";
export async function addFeedback(value: Feedback) { const old = ((await chrome.storage.local.get(KEY))[KEY] as Feedback[] | undefined) ?? []; await chrome.storage.local.set({ [KEY]: [...old, value] }); }
export async function clearFeedback() { await chrome.storage.local.remove(KEY); }

