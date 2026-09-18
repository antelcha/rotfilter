import type { Classification, ExtractedPost } from "../shared/types";
export type ProviderResult = Classification;
export type FilterRules = { show?: string; dontShow?: string };
export interface DecisionProvider { evaluatePost(post: ExtractedPost, rules: FilterRules, signal?: AbortSignal): Promise<ProviderResult> }
