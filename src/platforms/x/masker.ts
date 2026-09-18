import type { Classification } from "../../shared/types";
import { sendMessage } from "../../shared/messaging";

type SavedAttributes = { inert: string | null; ariaHidden: string | null };
type MaskState = {
  host: HTMLDivElement;
  children: Map<HTMLElement, SavedAttributes>;
  label: HTMLSpanElement;
  onReveal: () => void;
};
const masks = new WeakMap<HTMLElement, MaskState>();
const feedback = new WeakMap<HTMLElement, HTMLElement>();
const UI = "data-rotfilter-ui";
const BAN_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6 18.4 18.4"/></svg>`;
const uiStyle = `
  :host { color: inherit; }
  @keyframes rf-fade { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }
  .controls { height:100%; width:100%; display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:12px; background:color-mix(in srgb,currentColor 3%,transparent);
    animation:rf-fade .18s ease both; }
  .chip { display:inline-flex; align-items:center; gap:7px; padding:6px 14px; border-radius:999px;
    border:1px solid color-mix(in srgb,currentColor 16%,transparent);
    background:color-mix(in srgb,currentColor 5%,transparent);
    font:500 12.5px/1 system-ui,sans-serif; opacity:.8; }
  .chip svg { flex:none; opacity:.75; }
  button.action { appearance:none; border:1px solid color-mix(in srgb,currentColor 20%,transparent);
    background:transparent; color:inherit; font:400 13px/1 system-ui,sans-serif; padding:8px 16px;
    border-radius:999px; cursor:pointer; opacity:.8; transition:background .12s,border-color .12s,opacity .12s; }
  button.action:hover { background:color-mix(in srgb,currentColor 9%,transparent);
    border-color:color-mix(in srgb,currentColor 35%,transparent); opacity:1; }
  button.action:focus-visible { outline:2px solid currentColor; outline-offset:2px; }
  button.action.small { font-size:12px; padding:5px 12px; opacity:.6; }
  button.action.small:hover { opacity:.95; }
`;

function createHost(kind: "mask" | "feedback") {
  const host = document.createElement("div");
  host.setAttribute(UI, kind);
  host.className = kind === "mask" ? "rotfilter-mask" : "rotfilter-feedback";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style"); style.textContent = uiStyle; shadow.append(style);
  // RotFilter controls must not trigger X's article navigation handler.
  for (const event of ["click", "dblclick", "pointerdown", "pointerup", "keydown", "keyup"]) {
    host.addEventListener(event, e => e.stopPropagation());
  }
  return { host, shadow };
}

function restoreChild(child: HTMLElement, saved: SavedAttributes) {
  for (const [name, value] of [["inert", saved.inert], ["aria-hidden", saved.ariaHidden]] as const) {
    if (value === null) child.removeAttribute(name);
    else child.setAttribute(name, value);
  }
}

function concealChildren(article: HTMLElement, state: MaskState) {
  for (const [child, saved] of state.children) {
    if (child.parentElement !== article) { restoreChild(child, saved); state.children.delete(child); }
  }
  for (const child of article.children) {
    if (!(child instanceof HTMLElement) || child.hasAttribute(UI)) continue;
    if (!state.children.has(child)) state.children.set(child, {
      inert: child.getAttribute("inert"), ariaHidden: child.getAttribute("aria-hidden")
    });
    if (!child.hasAttribute("inert")) child.setAttribute("inert", "");
    if (child.getAttribute("aria-hidden") !== "true") child.setAttribute("aria-hidden", "true");
  }
}

export function maskPost(article: HTMLElement, classification: Classification, label: string, onReveal = () => {}) {
  removeFeedback(article);
  let state = masks.get(article);
  if (!state) {
    const { host, shadow } = createHost("mask");
    const controls = document.createElement("div"); controls.className = "controls";
    const word = document.createElement("span"); word.className = "chip";
    word.innerHTML = BAN_ICON;
    const labelSpan = document.createElement("span"); word.append(labelSpan);
    const show = document.createElement("button"); show.type = "button"; show.className = "action";
    show.textContent = "show"; show.setAttribute("aria-label", "Show filtered post");
    show.addEventListener("click", () => {
      // Record the override before removing the mask so observers cannot remask it.
      masks.get(article)?.onReveal();
      revealPost(article, true);
    });
    controls.append(word, show); shadow.append(controls);
    state = { host, children: new Map(), label: labelSpan, onReveal }; masks.set(article, state);
  }
  state.onReveal = onReveal;
  if (state.label.textContent !== label) state.label.textContent = label;
  // React owns className; this independent attribute survives hover rerenders.
  if (!article.hasAttribute("data-rotfilter-masked")) article.setAttribute("data-rotfilter-masked", "");
  concealChildren(article, state);
  if (state.host.parentElement !== article) article.append(state.host);
  const serialized = JSON.stringify(classification);
  if (article.dataset.rotfilterClassification !== serialized) article.dataset.rotfilterClassification = serialized;
}

export function revealPost(article: HTMLElement, withFeedback = false) {
  const state = masks.get(article);
  state?.host.remove();
  if (state) for (const [child, saved] of state.children) restoreChild(child, saved);
  masks.delete(article);
  article.removeAttribute("data-rotfilter-masked");
  article.dataset.rotfilterState = "revealed";
  if (!withFeedback) return;
  void sendMessage({ type: "POST_REVEALED" });
  removeFeedback(article);
  const { host, shadow } = createHost("feedback");
  const button = document.createElement("button"); button.type = "button"; button.className = "action small"; button.textContent = "wrong call";
  button.addEventListener("click", async () => {
    button.disabled = true;
    const response = await sendMessage<{ok:boolean}>({ type: "WRONG_CALL", payload: { tweetId: article.dataset.rotfilterId } });
    button.textContent = response?.ok ? "noted" : "try again";
    button.disabled = !!response?.ok;
  });
  shadow.append(button);
  // Out of flow: feedback must not change X's measured timeline height.
  article.setAttribute("data-rotfilter-feedback", "");
  article.append(host); feedback.set(article, host);
}

function removeFeedback(article: HTMLElement) {
  feedback.get(article)?.remove(); feedback.delete(article);
  article.removeAttribute("data-rotfilter-feedback");
}

export function resetPost(article: HTMLElement) {
  revealPost(article); removeFeedback(article);
  delete article.dataset.rotfilterState;
  delete article.dataset.rotfilterClassification;
  delete article.dataset.rotfilterId;
}

export function isMasked(article: HTMLElement) { return article.hasAttribute("data-rotfilter-masked"); }
