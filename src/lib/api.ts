// Shared plumbing for the tooling APIs: JSON envelopes and a capped body reader.
export const jsonResponse = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export const apiError = (
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response => jsonResponse({ error: code, message, ...extra }, status, headers);

/** Reads at most `max` bytes of body, whether or not Content-Length was sent; `null` when larger. */
export async function readBodyCapped(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > max) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  chunks.reduce((at, chunk) => (bytes.set(chunk, at), at + chunk.byteLength), 0);
  return new TextDecoder().decode(bytes);
}
