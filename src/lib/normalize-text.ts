// Text normalisation and window hashing shared by the privacy check and the Facebook-overlap warning.

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** NFC, tags stripped, common entities decoded, lower case, whitespace collapsed. */
export const normalizeText = (text: string): string =>
  text
    .normalize('NFC')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m])
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * cyrb53 (53-bit, seed 0) as 14 hex chars. Synchronous and cheap enough to run on every
 * 60-character window inside a Worker. Only hashes are stored, never the source text.
 */
export function windowHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
