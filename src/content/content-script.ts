import { XFeedAdapter } from "../platforms/x/x-feed-adapter";
import type { Classification, EvaluationResponse, ExtractedPost, Settings } from "../shared/types";
import { sendMessage } from "../shared/messaging";
const adapter = new XFeedAdapter();
const pending = new Set<HTMLElement>(); let timer=0; let settings: Settings | undefined;
const decisions = new Map<string, Classification>();
const revealed = new Set<string>();
let feedRoot: HTMLElement | null = null;
let route = location.pathname;
let watchTimer: ReturnType<typeof setInterval> | undefined;
const active = () => location.pathname === '/home' && !!settings?.enabled && !!settings?.configured;
const observer = new MutationObserver(records => {
  const candidates = new Set<HTMLElement>();
  for (const record of records) {
    if (adapter.isOwnedNode(record.target)) continue;
    const article = adapter.closestPost(record.target);
    if (article) candidates.add(article);
    for (const node of record.addedNodes) {
      if (!adapter.isOwnedNode(node)) adapter.articlesInside(node).forEach(e => candidates.add(e));
    }
  }
  candidates.forEach(schedule);
});

void start();
async function start() {
  settings = await sendMessage<Settings>({ type:"GET_PUBLIC_SETTINGS" });
  // Trusted-context storage prevents direct reads here; public settings arrive through the worker.
  observeWhenReady();
  chrome.runtime.onMessage.addListener(message => {
    if (message.type !== "SETTINGS_CHANGED") return;
    if (settings?.filterHash !== message.settings.filterHash) {
      decisions.clear(); revealed.clear();
      adapter.articlesInside(document.body).forEach(e=>adapter.resetPost(e));
    }
    settings=message.settings;
    if (!active()) revealAll(); else scan();
  });
  // X replaces the timeline during SPA navigation. Only locate the root here;
  // tweet processing remains mutation-driven, not a whole-page polling scan.
  watchTimer = setInterval(observeWhenReady, 750);
}
function observeWhenReady() {
  if (!chrome.runtime?.id) { observer.disconnect(); clearInterval(watchTimer); revealAll(); return; }
  if (route !== location.pathname) { route=location.pathname; revealAll(); }
  if (!active()) { observer.disconnect(); feedRoot=null; return; }
  const root=adapter.findFeedRoot();
  if (!root || root === feedRoot) return;
  observer.disconnect(); feedRoot=root;
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['href'],characterData:true});
  scan();
}
function scan(){ adapter.articlesInside(document.body).forEach(schedule); }
function schedule(article:HTMLElement) {
  if (!active() || !article.isConnected) return;
  const id = adapter.postId(article);
  if (id && article.dataset.rotfilterId && id !== article.dataset.rotfilterId) {
    adapter.resetPost(article);
  }
  if (id && decisions.has(id)) { apply(article,id,decisions.get(id)!); return; }
  if (article.dataset.rotfilterState && article.dataset.rotfilterState !== 'unsupported' && article.dataset.rotfilterState !== 'revealed') return;
  pending.add(article);
  if (!timer) timer=window.setTimeout(flush,100);
}
function apply(article:HTMLElement,id:string,value:Classification) {
  if (!active() || !settings) return;
  article.dataset.rotfilterId=id;
  if (revealed.has(id) || value.decision==='keep') {
    if (adapter.isMasked(article)) adapter.revealPost(article);
    article.dataset.rotfilterState=revealed.has(id)?'revealed':'classified';
  } else {
    article.dataset.rotfilterState='classified';
    adapter.maskPost(article,value,settings.label,()=>{
      revealed.add(id);
      if(revealed.size>10000) revealed.delete(revealed.values().next().value!);
    });
  }
}
async function flush() { timer=0; const list=[...pending]; pending.clear(); for (const article of list) if(article.isConnected) void process(article); }
async function process(article:HTMLElement) {
  if (!active() || !article.isConnected) return;
  const filterHash=settings?.filterHash;
  article.dataset.rotfilterState="extracting";
  const post=await adapter.extractPost(article); if (!post || shouldKeepWithoutEvaluation(post)) { article.dataset.rotfilterState="unsupported"; return; }
  article.dataset.rotfilterId=post.id;
  if (decisions.has(post.id)) { apply(article,post.id,decisions.get(post.id)!); return; }
  article.dataset.rotfilterState="evaluating";
  const response = await sendMessage<EvaluationResponse>({type:"EVALUATE_POST",payload:{post}});
  if (filterHash!==settings?.filterHash) return;
  if (response?.ok) {
    decisions.set(post.id,response.classification);
    if (decisions.size>10000) decisions.delete(decisions.keys().next().value!);
  }
  if (!document.contains(article) || (adapter.postId(article) && adapter.postId(article)!==post.id)) return;
  if (!response?.ok) { article.dataset.rotfilterState="error"; return; }
  article.dataset.rotfilterState="classified";
  apply(article,post.id,response.classification);
}
function shouldKeepWithoutEvaluation(post:ExtractedPost) { return post.isReply || (post.hasMedia && post.text.length < 20); }
function revealAll(){ pending.clear(); adapter.articlesInside(document.body).forEach(article=>{if(adapter.isMasked(article)) adapter.revealPost(article);}); }
