export const SHOW_QUESTION = {
  type: "noul",
  instructions: "According to the user's show list, does this post match at least one item the user wants to see on their timeline?",
  criteria: {
    true: "The post matches at least one thing the user asked to see.",
    false: "The post matches nothing on the user's show list."
  }
} as const;

export const DONT_SHOW_QUESTION = {
  type: "noul",
  instructions: "According to the user's don't-show list, should this post be hidden from the user's timeline?",
  criteria: {
    true: "The post matches at least one thing the user asked to hide.",
    false: "The post does not match the user's don't-show list."
  }
} as const;
