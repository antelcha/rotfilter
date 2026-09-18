export const SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  statusLink: 'a[href*="/status/"]',
  media: '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="card.wrapper"]',
  timeline: 'main [aria-label*="Timeline"], main section'
} as const;

