/**
 * Truncates `text` to at most `maxLength` characters, breaking at the last
 * word boundary at or before that limit rather than mid-word, and appending
 * an ellipsis when truncation actually happened. Used to keep a Wikipedia
 * extract (which varies wildly in length — a couple of sentences for one
 * city, several paragraphs' worth for another) down to something that
 * reads as "a short description" regardless of which city it's for.
 */
export function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const cutoff = text.slice(0, maxLength);
  const lastSpaceIndex = cutoff.lastIndexOf(" ");
  // No space found at all (one very long "word") — fall back to a hard cut
  // rather than returning the text unchanged and blowing past maxLength.
  const truncated = lastSpaceIndex > 0 ? cutoff.slice(0, lastSpaceIndex) : cutoff;

  return `${truncated}…`;
}
