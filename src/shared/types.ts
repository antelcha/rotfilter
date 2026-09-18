export type ExtractedPost = {
  id: string;
  text: string;
  authorUsername?: string;
  authorDisplayName?: string;
  quotedText?: string;
  isReply: boolean;
  hasMedia: boolean;
  extractedAt: number;
};

export type Classification = {
  decision: "keep" | "filter";
  model: string;
};

export type CachedEvaluation = Classification & {
  tweetId: string;
  filterHash: string;
  evaluatedAt: number;
};

export type Settings = {
  enabled: boolean;
  apiKey?: string;
  showText: string;
  dontShowText: string;
  filterHash: string;
  label: string;
  configured: boolean;
  authInvalid: boolean;
};

export type Stats = {
  seen: number; evaluated: number; filtered: number; revealed: number;
  wrongCalls: number; apiErrors: number; cacheHits: number;
};

export type EvaluateMessage = { type: "EVALUATE_POST"; payload: { post: ExtractedPost } };
export type RuntimeMessage = EvaluateMessage | { type: "SET_ENABLED"; payload: { enabled: boolean } } | { type: "GET_PUBLIC_SETTINGS" } | { type: "VERIFY_KEY"; payload: { apiKey: string } } | { type:"CONTENT_DIAGNOSTIC"; payload:{ stage:string; count?:number } };
export type EvaluationResponse = { ok: true; classification: Classification } | { ok: false; error: string };
export type FeedbackMessage = { type: "POST_REVEALED" } | { type: "WRONG_CALL"; payload: { tweetId: string } };
