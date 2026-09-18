# RotFilter

A small Chrome extension that hides the posts you don't want to see on X (x.com) and keeps the ones you do — a tool for actually seeing the content you want on social media. It's a hobby project: I wanted a calmer timeline and an excuse to try [Jev](https://typesafe.ai/), TypeSafe's decision model.

## What it does

You write two lists on the settings page:

- **Show** — what you want to see ("posts about birdwatching", "friends' life updates", …)
- **Don't show** — what you want hidden ("engagement bait", "crypto threads", …)

While you browse `x.com/home`, the extension looks at each post and asks Jev two yes-or-no questions in a single API call: does this post match the Show list? Does it match the Don't show list? Then:

- matches **Don't show** → hidden (Don't show wins over Show)
- **Show** is not empty and the post matches nothing on it → hidden
- everything else → left alone

Hidden posts are not removed from the page. The tweet keeps its space in the timeline so X's layout doesn't jump, and you see a small label with a `show` button instead of the content. Click it and the post comes back, with a `wrong call` button if you want to note the mistake.

## How it works

- **Content script** (`src/content/`) watches the timeline with a MutationObserver, extracts each post's text, author and media info, and applies or removes masks.
- **Service worker** (`src/background/`) makes the API call through a small queue (3 concurrent), with a 5s timeout and a 30s backoff when rate-limited. Results are cached per post + settings hash, so scrolling back doesn't ask again.
- **Provider** (`src/providers/openrouter-jev-provider.ts`) talks to OpenRouter's decisions transport (`POST /api/alpha/decisions`) with the model `~typesafe/jev-latest`. Jev answers each question with a `noul`, a 0–1 probability of "yes"; 0.5 or higher counts as yes.
- Replies and media-only posts are skipped without asking the model.
- Anything that fails (API down, timeout, malformed response) leaves the post visible. Failing open is deliberate.

## Keys and privacy

There is no backend and no analytics. Your OpenRouter API key lives in `chrome.storage.local` in your browser profile and is only ever sent to OpenRouter. Post text is sent to OpenRouter too — that's the point of the tool, but worth knowing. Only the service worker can read the key; the content script receives settings without it.

## Setup

1. `npm install && npm run build`
2. Load `dist/` as an unpacked extension at `chrome://extensions`
3. Open the options page, paste an OpenRouter key, write your Show / Don't show lists, save
4. Browse `x.com/home`

## Development

```sh
npm test             # unit tests (vitest)
npm run typecheck
npm run build        # esbuild → dist/
npm run test:layout  # playwright: checks that masking never moves tweets (needs Chrome)
```

`scripts/jev-spike.mjs` is a tiny live probe against the decisions endpoint: `OPENROUTER_API_KEY=... node scripts/jev-spike.mjs`. The endpoint is explicitly alpha, so if the envelope ever changes, update the provider and refresh `tests/fixtures/jev-success.json` with a redacted real response. Never commit a key.

## Known rough edges

- X's DOM changes whenever X feels like it; the selectors in `src/platforms/x/selectors.ts` will need updates eventually.
- Jev's decisions endpoint is alpha and may change under us.
- Show / Don't show matching is semantic, not keyword-based: it mostly works, and sometimes it is confidently wrong. That's why hidden posts are one click away.
