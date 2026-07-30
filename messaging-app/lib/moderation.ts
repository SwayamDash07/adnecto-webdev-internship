export const FLAGGED_TERMS = [
  "idiot",
  "stupid",
  "moron",
  "dumbass",
  "shut up",
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
];

export function scanFlaggedTerms(text: string) {
  const normalized = text.toLowerCase();
  return FLAGGED_TERMS.filter((term) => {
    if (term.includes(" ")) return normalized.includes(term);
    return new RegExp(`\\b${term}\\b`, "i").test(normalized);
  });
}
