import { OpenRouterJevProvider, ProviderError } from "../providers/openrouter-jev-provider";
import type { FilterRules } from "../providers/decision-provider";
import { getCached, putCached } from "../storage/cache-store";
import { getSettings, saveSettings } from "../storage/settings-store";
import { incrementStat } from "../storage/stats-store";
import type { EvaluationResponse, RuntimeMessage, FeedbackMessage } from "../shared/types";
import { addFeedback } from "../storage/feedback-store";
import { MODEL } from "../shared/constants";
import { RequestQueue } from "./request-queue";

// Brave versions that still expose the callback-style API return void here.
// Promise.resolve keeps startup from crashing in both callback and Promise implementations.
void Promise.resolve(
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
).catch(() => undefined);
const queue = new RequestQueue(3);
let backoffUntil = 0;

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  if (reason === "install") await chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage | FeedbackMessage, _sender, sendResponse) => {
  if (message.type === "POST_REVEALED" || message.type === "WRONG_CALL") {
    const work = message.type === "POST_REVEALED" ? incrementStat("revealed")
      : typeof message.payload?.tweetId === "string" && message.payload.tweetId.length < 100
        ? addFeedback({tweetId:message.payload.tweetId,type:"false_positive",createdAt:Date.now()}).then(()=>incrementStat("wrongCalls"))
        : Promise.reject(new Error("Invalid feedback"));
    work.then(()=>sendResponse({ok:true}),()=>sendResponse({ok:false}));
    return true;
  }
  if (message.type === "CONTENT_DIAGNOSTIC") {
    chrome.storage.local.set({ contentDiagnostic:{ ...message.payload, at:Date.now() } });
    return false;
  }
  if (message.type === "GET_PUBLIC_SETTINGS") {
    getSettings().then(({ apiKey: _secret, ...publicSettings }) => sendResponse(publicSettings));
    return true;
  }
  if (message.type === "VERIFY_KEY") {
    verifyKey(message.payload.apiKey).then(sendResponse);
    return true;
  }
  if (message.type === "EVALUATE_POST") {
    queue.add(() => evaluate(message.payload.post)).then(sendResponse);
    return true;
  }
  if (message.type === "SET_ENABLED") saveSettings({ enabled: message.payload.enabled }).then(broadcastSettings);
  return false;
});

async function broadcastSettings({ apiKey: _secret, ...settings }: import("../shared/types").Settings) {
  const tabs = await chrome.tabs?.query?.({}).catch(() => []);
  await Promise.all((tabs ?? []).flatMap(tab => tab.id ? [chrome.tabs.sendMessage(tab.id,{type:"SETTINGS_CHANGED",settings}).catch(()=>undefined)] : []));
}

async function verifyKey(apiKey: string) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", { headers:{ Authorization:`Bearer ${apiKey}` } });
    if (!response.ok) return { ok:false };
    await saveSettings({ apiKey, authInvalid:false }); return { ok:true };
  } catch { return { ok:false }; }
}

async function evaluate(post: import("../shared/types").ExtractedPost): Promise<EvaluationResponse> {
  try {
    const settings = await getSettings();
    if (!settings.enabled || !settings.configured || !settings.apiKey || settings.authInvalid) return { ok:false, error:"not-configured" };
    const rules: FilterRules = { show: settings.showText.trim() || undefined, dontShow: settings.dontShowText.trim() || undefined };
    if (!rules.show && !rules.dontShow) return { ok:true, classification:{ decision:"keep", model:MODEL } };
    const cached = await getCached(settings.filterHash, post.id);
    await incrementStat("seen");
    if (cached) {
      await incrementStat("cacheHits");
      return { ok:true, classification: cached };
    }
    if (Date.now() < backoffUntil) return { ok:false, error:"rate-limited" };
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const classification = await new OpenRouterJevProvider(settings.apiKey).evaluatePost(post, rules, controller.signal);
      await putCached({ ...classification, tweetId:post.id, filterHash:settings.filterHash, evaluatedAt:Date.now() });
      await incrementStat("evaluated"); if (classification.decision === "filter") await incrementStat("filtered");
      return { ok:true, classification };
    } finally { clearTimeout(timeout); }
  } catch (error) {
    await incrementStat("apiErrors");
    if (error instanceof ProviderError && error.status === 401) await saveSettings({ authInvalid:true });
    if (error instanceof ProviderError && error.status === 429) backoffUntil = Date.now() + 30_000;
    return { ok:false, error:error instanceof Error ? error.message : "unknown-error" };
  }
}
