import { extractPost } from "./extractor";
import { maskPost, revealPost, resetPost, isMasked } from "./masker";
import { SELECTORS } from "./selectors";
export class XFeedAdapter {
  closestPost(node: Node) { return (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(SELECTORS.tweet) ?? null; }
  isOwnedNode(node: Node) { return !!(node instanceof Element ? node : node.parentElement)?.closest('[data-rotfilter-ui]'); }
  postId(article: HTMLElement) { return article.querySelector<HTMLAnchorElement>(SELECTORS.statusLink)?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1]; }
  findFeedRoot() { return document.querySelector<HTMLElement>(SELECTORS.timeline) ?? document.querySelector<HTMLElement>("main"); }
  articlesInside(node: Node): HTMLElement[] {
    if (!(node instanceof Element)) return [];
    const result = [...node.querySelectorAll<HTMLElement>(SELECTORS.tweet)];
    const parent = node.closest<HTMLElement>(SELECTORS.tweet);
    if (parent) result.push(parent);
    if (node.matches(SELECTORS.tweet)) result.unshift(node as HTMLElement);
    return [...new Set(result)];
  }
  extractPost = extractPost;
  maskPost = maskPost;
  revealPost = revealPost;
  resetPost = resetPost;
  isMasked = isMasked;
}
