// Accent-insensitive matching for the ⌘K palette: "viet pro" finds "Viết Pro".

export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

/** True when every word of the query appears in the title, ignoring accents and case. */
export function matches(query: string, title: string): boolean {
  const haystack = fold(title);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
