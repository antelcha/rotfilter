import type { ExtractedPost } from "../../shared/types";
import { SELECTORS } from "./selectors";

export async function extractPost(article: HTMLElement): Promise<ExtractedPost | null> {
  const textNodes = [...article.querySelectorAll<HTMLElement>(SELECTORS.tweetText)];
  const text = nodeText(textNodes[0]);
  const quotedText = nodeText(textNodes[1]) || undefined;
  const status = [...article.querySelectorAll<HTMLAnchorElement>(SELECTORS.statusLink)].map(a => a.getAttribute("href") ?? "").find(h => /\/status\/\d+/.test(h));
  const username = status?.match(/^\/([^/]+)\/status\//)?.[1];
  if (!text && !quotedText) return null;
  const id = status?.match(/\/status\/(\d+)/)?.[1] ?? await fallbackId(username, text, quotedText);
  const names = nodeText(article.querySelector<HTMLElement>(SELECTORS.userName) ?? undefined).split("\n");
  return { id, text, quotedText, authorUsername:username, authorDisplayName:names[0], isReply:isContextDependent(article, text), hasMedia:!!article.querySelector(SELECTORS.media), extractedAt:Date.now() };
}

function isContextDependent(article: HTMLElement, text: string) {
  return /Replying to/i.test(nodeText(article)) && text.length < 40;
}
function nodeText(node?: HTMLElement) { return (node?.innerText ?? node?.textContent ?? "").trim(); }
async function fallbackId(username="", text="", quote="") {
  const data = new TextEncoder().encode(`${username}|${text.replace(/\s+/g," ").trim()}|${quote.replace(/\s+/g," ").trim()}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return `fallback-${[...new Uint8Array(hash)].slice(0,12).map(x=>x.toString(16).padStart(2,"0")).join("")}`;
}
