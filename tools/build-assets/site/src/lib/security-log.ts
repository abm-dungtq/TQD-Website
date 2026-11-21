// Structured JSON security audit logger for Workers Observability.
// Strictly redacts sensitive field names and hashes client IPs so secrets or raw PII never enter logs.

export type SecurityEventType =
  | 'admin.login.success'
  | 'admin.login.failure'
  | 'admin.login.rate_limited'
  | 'admin.logout'
  | 'admin.csrf_blocked'
  | 'apikey.created'
  | 'apikey.revoked'
  | 'article.deleted'
  | 'media.deleted';

const REDACTED_KEY_RE = /pass(word)?|secret|token|cookie|auth(orization)?|hash|private|rawkey|^key$/i;

async function hashIpRef(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tqd-sec-ip:${ip}`));
  return [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeAuditDetails(
  details: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(details)) {
    if (v === undefined) continue;
    if (REDACTED_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (typeof v === 'string') {
      // Redact any accidental bearer/full-api-key/pbkdf2 pattern inside string values (preserving short 12-char prefixes)
      if (/^(Bearer\s+|tqd_[A-Za-z0-9_-]{16,}|pbkdf2-sha256\$)/i.test(v.trim())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = v.slice(0, 160);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function logSecurityEvent(
  event: SecurityEventType,
  details: Record<string, string | number | boolean | null | undefined> = {},
  request?: Request,
): Promise<void> {
  try {
    const rawIp = request?.headers.get('cf-connecting-ip')?.trim() || '';
    const ipRef = rawIp ? await hashIpRef(rawIp) : 'local';
    const payload = {
      ts: new Date().toISOString(),
      kind: 'security_audit',
      event,
      ipRef,
      ...sanitizeAuditDetails(details),
    };
    const isWarn =
      event === 'admin.login.failure' ||
      event === 'admin.login.rate_limited' ||
      event === 'admin.csrf_blocked';
    if (isWarn) {
      console.warn(JSON.stringify(payload));
    } else {
      console.info(JSON.stringify(payload));
    }
  } catch {
    // Audit logging must never crash request handling
  }
}
