// Minimal Workers runtime declarations for the standalone edge typecheck.
// The generated ../worker-configuration.d.ts is intentionally not included: it imports the Astro worker module,
// which would drag the whole (now cut) web app into this project.
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ExportedHandler<Env> {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
}

interface RequestInit {
  cf?: {
    cacheTtl?: number;
    cacheEverything?: boolean;
  };
}

// Workers exposes a default cache bucket at caches.default (not part of the WebWorker lib).
interface CacheStorage {
  default: Cache;
}
