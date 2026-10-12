import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, etag, jsonResponse, parseIfMatch, readBodyCapped, requireKey } from '../../../../lib/api';
import { ConflictError, deleteArticle, saveArticle, ValidationError } from '../../../../lib/articles';
import { type ArticleStatus, getArticle } from '../../../../lib/content';

const MAX_BODY = 200_000;
const NO_PUBLISH_WARNING = 'Key không có quyền publish nên bài được lưu nháp.';

const versionMismatch = (version: number) =>
  apiError(412, 'version_mismatch', 'Bài đã đổi phiên bản, đọc lại rồi gửi tiếp.', { currentVersion: version }, { ETag: etag(version) });

export const GET: APIRoute = async (context) => {
  const key = await requireKey(context, 'articles:write');
  if (key instanceof Response) return key;
  const a = await getArticle(env.DB, context.params.slug ?? '', { includeDrafts: true });
  if (!a) return apiError(404, 'not_found', 'Không có bài này.');
  return jsonResponse(
    {
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      bodyMd: a.bodyMd,
      coverKey: a.coverKey ?? null,
      tags: a.tags,
      status: a.status,
      version: a.version,
      fbOverlap: a.fbOverlap,
      publishedAt: a.publishedAt ?? null,
      updatedAt: a.updatedAt,
    },
    200,
    { ETag: etag(a.version) },
  );
};

interface PutBody {
  title: string;
  bodyMd: string;
  summary?: string;
  coverKey?: string | null;
  tags?: string[];
  publish?: boolean;
}

/** Type errors in the JSON body; content rules are checked later by validateArticle. */
function shapeErrors(b: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof b.title !== 'string') errors.push('title phải là chuỗi.');
  if (typeof b.bodyMd !== 'string') errors.push('bodyMd phải là chuỗi.');
  if (b.summary !== undefined && typeof b.summary !== 'string') errors.push('summary phải là chuỗi.');
  if (b.coverKey !== undefined && b.coverKey !== null && typeof b.coverKey !== 'string') errors.push('coverKey phải là chuỗi hoặc null.');
  if (b.tags !== undefined && !(Array.isArray(b.tags) && b.tags.every((t) => typeof t === 'string'))) errors.push('tags phải là mảng chuỗi.');
  if (b.publish !== undefined && typeof b.publish !== 'boolean') errors.push('publish phải là true hoặc false.');
  return errors;
}

export const PUT: APIRoute = async (context) => {
  const key = await requireKey(context, 'articles:write');
  if (key instanceof Response) return key;
  const slug = context.params.slug ?? '';

  const text = await readBodyCapped(context.request, MAX_BODY);
  if (text === null) return apiError(413, 'too_large', 'Body tối đa 200 KB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return apiError(400, 'invalid', 'Body phải là JSON.', { errors: ['Body phải là JSON.'] });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return apiError(400, 'invalid', 'Body phải là một object JSON.', { errors: ['Body phải là một object JSON.'] });
  }
  const errors = shapeErrors(parsed as Record<string, unknown>);
  if (errors.length) return apiError(400, 'invalid', 'Dữ liệu không hợp lệ.', { errors });
  const body = parsed as PutBody;

  const canPublish = key.scopes.includes('publish');
  const current = await getArticle(env.DB, slug, { includeDrafts: true });
  const ifMatch = context.request.headers.get('If-Match');
  let status: ArticleStatus;
  let warning: string | undefined;

  if (!current) {
    if (ifMatch !== null) return apiError(412, 'version_mismatch', 'Bài chưa có nên không được gửi If-Match.');
    status = body.publish && canPublish ? 'published' : 'draft';
    if (body.publish && !canPublish) warning = NO_PUBLISH_WARNING;
  } else {
    if (ifMatch === null) return apiError(428, 'if_match_required', `Bài đã có, cần header If-Match: ${etag(current.version)}.`, {}, { ETag: etag(current.version) });
    if (parseIfMatch(ifMatch) !== `v${current.version}`) return versionMismatch(current.version);
    if (current.status === 'published' && !canPublish) return apiError(403, 'forbidden', 'Bài đang đăng, key cần quyền publish để sửa.');
    if (body.publish === undefined) status = current.status;
    else if (body.publish && !canPublish) {
      status = 'draft';
      warning = NO_PUBLISH_WARNING;
    } else status = body.publish ? 'published' : 'draft';
  }

  try {
    // The slug comes from the path only, so a key can never retarget another article.
    const { article, created } = await saveArticle(
      env.DB,
      {
        slug,
        title: body.title.trim(),
        bodyMd: body.bodyMd,
        summary: (body.summary ?? current?.summary ?? '').trim(),
        coverKey: body.coverKey !== undefined ? body.coverKey : (current?.coverKey ?? null),
        tags: (body.tags ?? current?.tags ?? []).map((t) => t.trim()).filter(Boolean),
        status,
      },
      { source: `agent:${key.name}`, expectedVersion: current?.version },
    );
    return jsonResponse(
      {
        slug: article.slug,
        url: `${context.url.origin}/bai-viet/${article.slug}`,
        status: article.status,
        version: article.version,
        fbOverlap: article.fbOverlap,
        ...(warning ? { warning } : {}),
      },
      created ? 201 : 200,
      { ETag: etag(article.version) },
    );
  } catch (e) {
    if (e instanceof ValidationError) return apiError(400, 'invalid', 'Dữ liệu không hợp lệ.', { errors: e.errors });
    if (e instanceof ConflictError) return versionMismatch(e.currentVersion);
    throw e;
  }
};

export const DELETE: APIRoute = async (context) => {
  const key = await requireKey(context, 'articles:write');
  if (key instanceof Response) return key;
  const slug = context.params.slug ?? '';
  const current = await getArticle(env.DB, slug, { includeDrafts: true });
  if (!current) return apiError(404, 'not_found', 'Không có bài này.');
  if (current.status === 'published' && !key.scopes.includes('publish')) {
    return apiError(403, 'forbidden', 'Bài đang đăng, key cần quyền publish để xoá.');
  }
  if (!(await deleteArticle(env.DB, slug))) return apiError(404, 'not_found', 'Không có bài này.');
  return new Response(null, { status: 204 });
};
