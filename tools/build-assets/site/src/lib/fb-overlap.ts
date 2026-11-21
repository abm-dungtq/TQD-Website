// Warns when article text repeats ≥ 60 characters of a Facebook post. Uses hashes only.
import fingerprintList from '../data/fb-fingerprints.json';
import { normalizeText, windowHash } from './normalize-text';

export const WINDOW = 60;

let defaultSet: Set<string> | undefined;

export function hasFacebookOverlap(text: string, fingerprints?: Set<string>): boolean {
  const set = fingerprints ?? (defaultSet ??= new Set(fingerprintList as string[]));
  if (set.size === 0) return false;
  const norm = normalizeText(text);
  for (let i = 0; i + WINDOW <= norm.length; i += 1) {
    if (set.has(windowHash(norm.slice(i, i + WINDOW)))) return true;
  }
  return false;
}
