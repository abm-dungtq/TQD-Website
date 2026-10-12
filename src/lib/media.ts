// Media in R2: streamed uploads checked by magic bytes, one delete path that never touches backups.
import { slugify } from './articles';

export const LIMITS = { image: 10 * 1024 * 1024, video: 95 * 1024 * 1024 } as const;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** Upload rejected; `status` is the HTTP status to answer with. */
export class MediaError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const startsWith = (head: Uint8Array, bytes: number[], offset = 0) => bytes.every((b, i) => head[offset + i] === b);
const ascii = (head: Uint8Array, text: string, offset = 0) => startsWith(head, [...text].map((c) => c.charCodeAt(0)), offset);

export function sniffType(head: Uint8Array): string | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(head, 'GIF8')) return 'image/gif';
  if (ascii(head, 'RIFF') && ascii(head, 'WEBP', 8)) return 'image/webp';
  if (ascii(head, 'ftyp', 4)) return 'video/mp4';
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  return null;
}

const randomHex = (bytes: number) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

export interface StoredMedia {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export async function storeMedia(
  env: Env,
  body: ReadableStream<Uint8Array> | null,
  length: number,
  filename: string,
  alt: string,
  source: string,
): Promise<StoredMedia> {
  if (!body || !Number.isFinite(length) || length <= 0) throw new MediaError(411, 'Cần header Content-Length.');

  // Read just enough to identify the file, keeping every chunk to replay in full.
  const reader = body.getReader();
  const head: Uint8Array[] = [];
  let headSize = 0;
  while (headSize < 16) {
    const { value, done } = await reader.read();
    if (done) break;
    head.push(value);
    headSize += value.byteLength;
  }
  const first = new Uint8Array(headSize);
  head.reduce((at, chunk) => (first.set(chunk, at), at + chunk.byteLength), 0);

  const contentType = sniffType(first);
  if (!contentType) {
    await reader.cancel();
    throw new MediaError(415, 'Chỉ nhận ảnh JPEG, PNG, GIF, WebP hoặc video MP4, WebM.');
  }
  if (length > (contentType.startsWith('video/') ? LIMITS.video : LIMITS.image)) {
    await reader.cancel();
    throw new MediaError(413, 'Tệp quá lớn.');
  }

  const name = slugify(filename.replace(/\.[^.]*$/, '')).slice(0, 40).replace(/-+$/, '') || 'file';
  const month = new Date().toISOString().slice(0, 7).replace('-', '/');
  const key = `${month}/${randomHex(6)}-${name}.${EXT[contentType]}`;

  const rebuilt = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of head) controller.enqueue(chunk);
    },
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  // put() consumes the readable while pipeTo() fills it, so both must run together.
  const { readable, writable } = new FixedLengthStream(length);
  const putP = env.MEDIA.put(key, readable, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });
  try {
    await Promise.all([rebuilt.pipeTo(writable), putP]);
  } catch {
    // The body ended before Content-Length bytes (client abort or a lying header).
    await reader.cancel().catch(() => {});
    throw new MediaError(400, 'Tệp gửi lên không đủ dung lượng đã khai báo.');
  }

  await env.DB.prepare('INSERT INTO media (key, content_type, size, alt, source) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(key, contentType, length, alt.slice(0, 300), source)
    .run();
  return { key, url: `/media/${key}`, contentType, size: length };
}

/** The only way media is deleted. Backups and unknown keys are refused. */
export async function deleteMedia(env: Env, key: string): Promise<boolean> {
  if (key.startsWith('backups/')) return false;
  const row = await env.DB.prepare('DELETE FROM media WHERE key = ?1 RETURNING key').bind(key).first();
  if (!row) return false;
  await env.MEDIA.delete(key);
  return true;
}
