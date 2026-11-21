#!/usr/bin/env python
"""Ports the live tqd.me markup into EzyArticle source files.

Input (read-only): `.artifacts/live/page_*` — the server-rendered HTML captured from production, which is
the design ground truth. Output: `page-fragments/tqd-shared/*` (shared shell, included by every page) and
`pages/<slug>/{content.html,meta.json}` (STANDALONE_PAGE).

The transform is deliberately mechanical: identical classes, ids, order and text, with only these changes
 * inline <style> blocks and /_astro/ script tags are dropped — they live in `api/v1/media/tqd-site.css`
   and `tqd-*.js` (built by tools/build-assets/build.mjs);
 * absolute tqd.me URLs in page chrome become relative or a `__TQD_ORIGIN__` token resolved by an inline
   script, so nothing hard-codes the domain;
 * images served from the old worker paths move to `/api/v1/media/tqd-*`;
 * the four post-driven lists become server-side Thymeleaf loops over EzyArticle posts;
 * the article page becomes one template over `get_post_by_slug`.
Run from the repository root; rerunning overwrites the generated files deterministically.
"""
import hashlib
import html
import json
import os
import re

LIVE = '.artifacts/live'
PAGES = 'pages'
FRAG = 'page-fragments/tqd-shared'
MEDIA = 'api/v1/media'
# The edge caches media for a year when the URL carries `?v=`, so the token must change whenever the bytes do.
# Each referenced file is hashed on its own: hashing only the CSS let a JS-only rebuild reuse stale URLs.
_VERSION_CACHE = {}


def asset_version(name):
    if name not in _VERSION_CACHE:
        with open(os.path.join(MEDIA, name), 'rb') as handle:
            _VERSION_CACHE[name] = hashlib.sha1(handle.read()).hexdigest()[:10]
    return _VERSION_CACHE[name]


def asset_query(name):
    override = os.environ.get('TQD_ASSET_VERSION')
    return '?v=' + (override or asset_version(name))

SECTIONS = ['ho-so', 'san-pham', 'thu-vien', 'video-ai', 'bai-viet', 'lien-he']
STATIC_PAGES = SECTIONS + ['shop', 'tai-video', 'quyen-rieng-tu', '404']

SCRIPT_MAP = [
    ('EffectsMenu', 'tqd-effects.js'),
    ('TikTokPlayer', 'tqd-tiktok.js'),
    ('DesktopShell', 'tqd-desktop.js'),
    ('PageActions', 'tqd-page-actions.js'),
    ('MobileShell', 'tqd-mobile.js'),
    ('shop.astro', 'tqd-shop.js'),
    ('tai-video.astro', 'tqd-tai-video.js'),
    ('_slug_', 'tqd-tiktok.js'),
]
SHARED_SCRIPTS = ['tqd-chat.js', 'tqd-cmdk.js', 'tqd-base.js']

# List responses (WebPostContentResponse) carry no content, so each item is fetched by id.
LOOP_TOKENS = {
    'san-pham': "<th:block th:each=\"p : ${products.items}\" th:with=\"full=${ezyfunctions.call('get_post_by_id','{&quot;id&quot;:' + p.id + '}')}\"><th:block th:utext=\"${full.content}\"/></th:block>",
    'video-ai': "<th:block th:each=\"p : ${videos.items}\" th:with=\"full=${ezyfunctions.call('get_post_by_id','{&quot;id&quot;:' + p.id + '}')}\"><th:block th:utext=\"${full.content}\"/></th:block>",
    'thu-vien': "<th:block th:each=\"p : ${gallery.items}\" th:with=\"full=${ezyfunctions.call('get_post_by_id','{&quot;id&quot;:' + p.id + '}')}\"><th:block th:utext=\"${full.content}\"/></th:block>",
}

CARD_TAGS_CALL = ("ezyfunctions.call('get_post_meta','{&quot;postId&quot;:' + p.id + "
                  "',&quot;metaKey&quot;:&quot;tqd_tags&quot;}')")
TAG_CHIPS = ('<ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Nhãn" '
             'th:with="tagsJson=${' + CARD_TAGS_CALL + ' != null ? ' + CARD_TAGS_CALL + '.metaValue : null}">'
             '<th:block th:if="${tagsJson != null and tagsJson != \'[]\'}">'
             '<li class="lux-chip px-2.5 py-0.5 text-xs" '
             "th:each=\"tag : ${#strings.arraySplit(#strings.replace(#strings.replace(#strings.replace(tagsJson,"
             "'[&quot;',''),'&quot;]',''),'&quot;,&quot;','|'),'|')}\" "
             'th:text="${tag}"></li></th:block></ul>')


def article_card(template):
    template = re.sub(r'<p class="font-mono text-xs text-muted">[^<]+</p>',
                      '<p class="font-mono text-xs text-muted" th:text="${#dates.format(new java.util.Date(p.publishedAt + 25200000L), \'dd/MM/yyyy\')}"></p>', template)
    template = re.sub(r'<a href="/bai-viet/[^"]+"([^>]*)>[^<]+</a>',
                      "<a th:href=\"${'/bai-viet/' + p.slug}\"\\1 th:text=\"${p.title}\"></a>", template)
    template = re.sub(r'<p class="mt-2 text-sm leading-relaxed">[^<]*</p>',
                      '<p class="mt-2 text-sm leading-relaxed" th:if="${p.summary}" th:text="${p.summary}"></p>', template, count=1)
    template = re.sub(r'<ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Nhãn">.*?</ul>',
                      TAG_CHIPS, template, count=1, flags=re.S)
    return template


CARD_ATTR = '<li class="lux-card relative p-6">'


def card_spans(html):
    starts = [m.start() for m in re.finditer(re.escape(CARD_ATTR), html)]
    spans = []
    for i, start in enumerate(starts):
        close = html.find('</ul></li>', start)
        if close == -1:
            close = starts[i + 1] - 1 if i + 1 < len(starts) else html.find('</li>', start) + 5
        else:
            close += len('</ul></li>')
        spans.append((start, close))
    return spans


def article_list_region(html):
    spans = card_spans(html)
    if len(spans) != 21:
        raise SystemExit('expected 21 article list items, found %d' % len(spans))
    first, last = spans[0][0], spans[-1][1]
    card = article_card(html[first:spans[0][1]])
    card = card.replace(CARD_ATTR, CARD_ATTR[:-1] + ' th:each="p : ${posts}">', 1)
    return html[:first] + card + html[last:]


def read(name):
    with open(os.path.join(LIVE, name), encoding='utf-8') as f:
        return f.read()


def split_doc(doc):
    head = doc[doc.index('<head>') + 6:doc.index('</head>')]
    start = doc.index('<body')
    start = doc.index('>', start) + 1
    body = doc[start:doc.rindex('</body>')]
    return head, body


def head_meta(head):
    """Shared <head>: the tags every page repeats, in the original order, before the page-specific ones."""
    keep = [
        r'<meta charset="[^"]*">',
        r'<meta name="viewport"[^>]*>',
        r'<meta name="theme-color"[^>]*>',
        r'<link rel="icon"[^>]*>',
        r'<meta name="google-site-verification"[^>]*>',
        r'<link rel="llms-txt"[^>]*>',
        r'<link rel="alternate" type="application/rss\+xml"[^>]*>',
        r'<link rel="alternate" type="application/feed\+json"[^>]*>',
    ]
    tags = []
    for pattern in keep:
        m = re.search(pattern, head)
        if not m:
            raise SystemExit(f'shared head tag missing: {pattern}')
        tags.append(m.group(0))
    preloads = re.findall(r'<link rel="preload" href="/_astro/fonts/[0-9a-f]+\.woff2"[^>]*>', head)
    tags.append('<link rel="stylesheet" ezy:mhref="/api/v1/media/tqd-site.css' + asset_query('tqd-site.css') + '">')
    tags.extend(preloads)
    return '\n'.join(tags)


def sub_header(body):
    m = re.search(r'<header class="site-header">.*?</header>', body, re.S)
    return m.group(0)


def header_fragment(body):
    header = sub_header(body)
    # aria-current is per page; every nav link gets it from the fragment parameter instead of a copy per page.
    header = re.sub(r'\s+aria-current="page"', '', header)
    def add(m):
        href = m.group(1).lstrip('/')
        return f'<a th:attr="aria-current=${{current==\'{href}\' ? \'page\' : null}}" href="/{href}"'
    header = re.sub(r'<a href="/(ho-so|san-pham|thu-vien|video-ai|bai-viet|lien-he|shop|tai-video)"', add, header)
    header = header.replace(
        'class="site-nav -mx-1 order-last w-full gap-1 overflow-x-auto text-sm lg:order-none lg:w-auto flex"',
        'th:class="\'site-nav -mx-1 order-last w-full gap-1 overflow-x-auto text-sm lg:order-none lg:w-auto \' + (home ? \'hidden lg:flex\' : \'flex\')"',
    )
    if 'th:class=' not in header:
        raise SystemExit('header nav class not normalised')
    return f'<header th:fragment="header(current, home)" class="site-header">{header[len("<header class=\"site-header\">") :]}'


def footer_fragment(body):
    tail = body[body.index('</main>') + len('</main>'):]
    tail = re.sub(r'<script[^>]*src="/_astro/[^"]+"></script>', '', tail)
    tail = tail.strip()
    if '<footer class="site-footer">' not in tail:
        raise SystemExit('footer region not found')
    scripts = ''.join(js_tag(s) for s in SHARED_SCRIPTS)
    origin_script = (
        '<script>(function(){var o=location.origin,e=encodeURIComponent(o);'
        'document.querySelectorAll("a[href*=__TQD_ORIGIN__],[data-ai-gemini*=__TQD_ORIGIN__],[data-share-url*=__TQD_ORIGIN__],'
        'a[href*=TQDORIGIN],[data-ai-gemini*=TQDORIGIN],[data-share-url*=TQDORIGIN]")'
        '.forEach(function(n){["href","data-ai-gemini","data-share-url"].forEach(function(a){'
        'var v=n.getAttribute(a);if(v) n.setAttribute(a,v.replace(/__TQD_ORIGIN__|TQDORIGIN/g, a==="href"?e:o));});});})();</script>'
    )
    return f'<th:block th:fragment="foot">{tail}{scripts}{origin_script}</th:block>'


def rewrite_common(text):
    text = text.replace('/_astro/fonts/', '/api/v1/media/tqd-font-')
    text = re.sub(r'<link rel="preload" href="/api/v1/media/tqd-font-[^"]*"[^>]*>\n?', '', text)
    text = re.sub(r'<script[^>]*src="/_astro/[^"]+">\s*</script>', '', text)
    text = text.replace('/img/portrait-240.webp', '/api/v1/media/tqd-portrait-240.webp')
    text = text.replace('/img/portrait-480.webp', '/api/v1/media/tqd-portrait-480.webp')
    text = re.sub(r'/mascot/([a-z]+\.webp)', r'/api/v1/media/tqd-mascot-\1', text)
    text = text.replace('href="/favicon.svg"', 'href="/api/v1/media/tqd-favicon.svg"')
    # page chrome must not carry the production domain
    text = text.replace('content="https://tqd.me/og/', 'content="/api/v1/media/tqd-og/')
    text = re.sub(r'(<meta property="og:image" content=")[^"]*"', r'\1/api/v1/media/tqd-og.png"', text)
    text = re.sub(r'(<meta name="twitter:image" content=")[^"]*"', r'\1/api/v1/media/tqd-og.png"', text)
    text = re.sub(r'(<link rel="canonical" href=")https://tqd\.me', r'\1', text)
    text = re.sub(r'(<link rel="alternate" type="text/markdown" href=")https://tqd\.me', r'\1', text)
    text = re.sub(r'(<meta property="og:url" content=")https://tqd\.me', r'\1', text)
    # JSON-LD is rewritten first and separately: it wants relative URLs, while the AI prompt links and share
    # buttons below get the origin token (the later generic replacements never touch structured data again).
    def structured(match):
        return match.group(1).replace('https://tqd.me/', '/').replace('https://tqd.me', '')
    text = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)',
                  lambda m: m.group(1) + structured(m) + m.group(3), text, flags=re.S)
    # AI prompt links and share buttons get the live origin at runtime
    text = text.replace('https%3A%2F%2Ftqd.me', '__TQD_ORIGIN__')
    text = text.replace('https://tqd.me/', '__TQD_ORIGIN__/')
    return text


def page_scripts(name, doc):
    found = []
    for base, target in SCRIPT_MAP:
        if re.search(r'src="/_astro/' + re.escape(base), doc) and target not in found:
            found.append(target)
    return found


def wrap_page(title, description, head_extra, body_inner, current, scripts, main_attrs=''):
    head_extra = re.sub(r'<title>.*?</title>', '', head_extra, flags=re.S)
    head_extra = re.sub(r'<meta name="description" content="[^"]*">', '', head_extra)
    script_html = ''.join(js_tag(s) for s in scripts)
    home = current == ''
    return (
        '<!DOCTYPE html>\n'
        '<html lang="vi" data-ga4="G-Z9XEQ6BVXJ">\n<head>\n'
        f'{fragment_inner("shell")}\n'
        f'<title>{title}</title>\n'
        f'<meta name="description" content="{description}">\n'
        f'{head_extra.strip()}\n'
        '</head>\n<body class="min-h-screen"' + (' data-tqd-not-found' if current == '404' else '') + '>\n'
        '<a href="#main" data-skip class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[2000] focus:rounded focus:bg-panel focus:px-3 focus:py-2">Bỏ qua tới nội dung</a>\n'
        f'{render_header(current, home)}\n'
        f'{body_inner}\n'
        f'{fragment_inner("footer")}\n'
        f'{script_html}\n'
        '</body>\n</html>\n'
    )



def js_tag(name):
    path = os.path.join(MEDIA, name)
    if not os.path.exists(path):
        raise SystemExit('missing built asset ' + name)
    return '<script type="module" src="/api/v1/media/' + name + asset_query(name) + '"></script>'




def fix_calls(text):
    # Thymeleaf attribute values are double-quoted, so the JSON argument of ezyfunctions.call must use
    # &quot; entities after HTML decoding; plain single quotes would terminate the OGNL string early.
    text = re.sub(r"\{postType:'([A-Za-z_]+)',limit:100\}",
                  r"{&quot;postType&quot;:&quot;\1&quot;,&quot;limit&quot;:100}", text)
    text = re.sub(r"\{postType:'([A-Za-z_]+)',sortOrder:'([A-Z_]+)',limit:100\}",
                  r"{&quot;postType&quot;:&quot;\1&quot;,&quot;sortOrder&quot;:&quot;\2&quot;,&quot;limit&quot;:100}", text)
    text = text.replace("{name:'slug'}", "{&quot;name&quot;:&quot;slug&quot;}")
    text = text.replace("{slug:' + slug + ',statuses:'PUBLISHED'}",
                        "{&quot;slug&quot;:&quot;' + slug + '&quot;,&quot;status&quot;:&quot;PUBLISHED&quot;}")
    text = text.replace("@{'/bai-viet/' + ${p.slug}}", "${'/bai-viet/' + p.slug}")
    text = text.replace("@{'/bai-viet/' + ${rel.slug}}", "${'/bai-viet/' + rel.slug}")
    text = text.replace("${'/bai-viet/' + ${post.slug} + '.md'}", "${'/bai-viet/' + post.slug + '.md'}")
    text = text.replace("${'/bai-viet/' + ${post.slug}", "${'/bai-viet/' + post.slug")
    return text


def fragment_inner(name):
    text = open(os.path.join(FRAG, name, 'content.html'), encoding='utf-8').read().strip()
    text = re.sub(r'^<th:block[^>]*>', '', text)
    text = re.sub(r'</th:block>$', '', text)
    return text.strip()


def render_header(current, home):
    text = fragment_inner('header')
    text = re.sub(
        r"th:class=\"'([^']*)' \+ \(home \? '([^']*)' : '([^']*)'\)\"",
        lambda m: 'class="' + m.group(1) + (m.group(2) if home else m.group(3)) + '"',
        text,
    )
    def aria(m):
        return 'aria-current="page"' if m.group(1) == current else ''
    text = re.sub(r"th:attr=\"aria-current=\$\{current=='([^']*)' \? 'page' : null\}\"", aria, text)
    text = re.sub(r'\s*th:fragment="[^"]*"', '', text, count=1)
    if 'th:' in text:
        raise SystemExit('header still has Thymeleaf attributes')
    return text.replace('<header ', '<header ', 1)


def read_fragment(name):
    with open(os.path.join(FRAG, name, 'content.html'), encoding='utf-8') as f:
        return f.read()


def page_head_extra(head, path):
    """Everything page-specific in <head>, minus the shared tags."""
    extra = head
    for pattern in [
        r'<meta charset="[^"]*">', r'<meta name="viewport"[^>]*>', r'<meta name="theme-color"[^>]*>',
        r'<link rel="icon"[^>]*>', r'<meta name="google-site-verification"[^>]*>',
        r'<link rel="llms-txt"[^>]*>', r'<link rel="alternate" type="application/rss\+xml"[^>]*>',
        r'<link rel="alternate" type="application/feed\+json"[^>]*>',
    ]:
        extra = re.sub(pattern, '', extra)
    extra = re.sub(r'<link rel="preload" href="/_astro/fonts/[0-9a-f]+\.woff2"[^>]*>', '', extra)
    extra = re.sub(r'<style>.*?</style>', '', extra, flags=re.S)
    return extra


def main_inner(body):
    m = re.search(r'<main\b[^>]*>(.*?)</main>', body, re.S)
    if not m:
        raise SystemExit('main not found')
    return m.group(1)


def main_open(body):
    m = re.search(r'<main\b[^>]*>', body)
    return m.group(0)


def sanitize_page_main(main, slug):
    main = rewrite_common(main)
    if slug == 'bai-viet':
        main = article_list_region(main)
    elif slug in ('san-pham', 'video-ai', 'thu-vien'):
        pattern = {
            'san-pham': r'<article class="lux-card flex flex-col gap-3 p-6">.*?</article>',
            'video-ai': r'<article class="lux-card flex flex-col gap-3 p-6">.*?</article>',
            'thu-vien': r'<figure class="lux-card gallery-item">.*?</figure>',
        }[slug]
        cards = re.findall(pattern, main, re.S)
        expected = {'san-pham': 12, 'video-ai': 7, 'thu-vien': 4}[slug]
        if len(cards) != expected:
            raise SystemExit(f'{slug}: expected {expected} cards, found {len(cards)}')
        first = main.index(cards[0])
        last = main.index(cards[-1]) + len(cards[-1])
        main = main[:first] + LOOP_TOKENS[slug] + main[last:]
    return main


def html_escape_attr(value):
    return html.escape(value, quote=True)


MEDIA_REWRITES = (
    ('/img/portrait-240.webp', '/api/v1/media/tqd-portrait-240.webp'),
    ('/img/portrait-480.webp', '/api/v1/media/tqd-portrait-480.webp'),
)


IMAGE_VERSIONED = (
    '/api/v1/media/tqd-portrait-240.webp',
    '/api/v1/media/tqd-portrait-480.webp',
    '/api/v1/media/tqd-mascot-idle.webp',
    '/api/v1/media/tqd-mascot-point.webp',
    '/api/v1/media/tqd-mascot-sleep.webp',
    '/api/v1/media/tqd-mascot-think.webp',
    '/api/v1/media/tqd-mascot-type.webp',
    '/api/v1/media/tqd-mascot-wave.webp',
)


# The platform JVM runs in UTC (Etc/UTC) while the site publishes in Indochina time; without the shift a post
# published after 17:00 UTC shows the previous day. Vietnam has no DST, so the templates add a constant
# 25200000 ms (+7 h) before formatting.
SKU_COUNT_FIXES = (
    # The captured deploy predates the 30-SKU catalog that the repository ships (src/lib/shop-catalog.ts);
    # the summary heading still said 23, so it disagreed with the client-rendered table. The ItemList keeps 23:
    # it describes the server-rendered rows crawlers see, and the client catalog only swaps the table.
    ('23 gói', '30 gói'),
)


def sku_counts(text):
    for old, new in SKU_COUNT_FIXES:
        text = text.replace(old, new)
    return text


def media_paths(text):
    for source, target in MEDIA_REWRITES:
        text = text.replace(source, target)
    for image in IMAGE_VERSIONED:
        # A fragment already carrying `?v=` must not gain a second one when a page re-applies media_paths.
        name = image.rsplit('/', 1)[1]
        text = re.sub(re.escape(image) + r'(?!\?v=)', image + asset_query(name), text)
    return text


def write_page(slug, meta, content):
    content = sku_counts(media_paths(fix_calls(content)))
    d = os.path.join(PAGES, slug)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'content.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    with open(os.path.join(d, 'meta.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write('\n')


def build_fragments():
    ho = read('page_ho-so')
    head, body = split_doc(ho)
    os.makedirs(os.path.join(FRAG, 'shell'), exist_ok=True)
    os.makedirs(os.path.join(FRAG, 'header'), exist_ok=True)
    os.makedirs(os.path.join(FRAG, 'footer'), exist_ok=True)
    os.makedirs(os.path.join(FRAG, 'desktop'), exist_ok=True)
    css = open(os.path.join(MEDIA, 'tqd-site.css'), encoding='utf-8').read()
    if '</style' in css:
        raise SystemExit('stylesheet contains a closing style tag')
    with open(os.path.join(FRAG, 'shell', 'content.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('<th:block th:fragment="head-meta">\n<style>\n' + css + '</style>\n' + media_paths(rewrite_common(head_meta(head))) + '\n</th:block>\n')
    with open(os.path.join(FRAG, 'header', 'content.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(media_paths(rewrite_common(header_fragment(body))) + '\n')
    with open(os.path.join(FRAG, 'footer', 'content.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(media_paths(rewrite_common(footer_fragment(body))) + '\n')
    for name, label in [('shell', 'Shared head tags'), ('header', 'Site header'), ('footer', 'Footer, chat, command palette'), ('desktop', 'Home desktop shell')]:
        with open(os.path.join(FRAG, name, 'meta.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'title': 'TQD ' + label, 'contentType': 'THYMELEAF', 'status': 'PUBLISHED'}, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return head, body


def main():
    head, body = build_fragments()
    used = {}

    # ---- static and section pages
    for slug in STATIC_PAGES:
        doc = read('page_404-test' if slug == '404' else 'page_' + slug)
        head, body = split_doc(doc)
        title = re.search(r'<title>(.*?)</title>', head, re.S).group(1)
        desc = re.search(r'<meta name="description" content="(.*?)"', head, re.S).group(1)
        extra = rewrite_common(page_head_extra(head, '/' + slug))
        main = main_open(body)
        inner = sanitize_page_main(main_inner(body), slug)
        if slug == 'san-pham':
            main = main.replace('<main ', '<main th:with="products=${ezyfunctions.call(\'get_post_pagination\',\'{postType:\'tqd_product\',sortOrder:\'PRIORITY_ASC_ID_ASC\',limit:100}\')}" ', 1)
        elif slug == 'video-ai':
            main = main.replace('<main ', '<main th:with="videos=${ezyfunctions.call(\'get_post_pagination\',\'{postType:\'tqd_video\',sortOrder:\'PRIORITY_ASC_ID_ASC\',limit:100}\')}" ', 1)
        elif slug == 'thu-vien':
            main = main.replace('<main ', '<main th:with="gallery=${ezyfunctions.call(\'get_post_pagination\',\'{postType:\'tqd_gallery\',sortOrder:\'PRIORITY_ASC_ID_ASC\',limit:100}\')}" ', 1)
        elif slug == 'bai-viet':
            main = main.replace('<main ', '<main th:with="posts=${ezyfunctions.call(\'get_latest_published_posts_by_type\',\'{postType:\'POST\',limit:100}\')}" ', 1)
        scripts = page_scripts(slug, doc)
        if slug == 'lien-he':
            inner = add_contact_form(inner)
            scripts.append('tqd-contact.js')
        content = wrap_page(title, desc, extra, main + inner + '</main>', slug, scripts)
        used[slug] = len(content)
        write_page(slug, page_meta(slug, title, desc), content)

    # ---- home
    doc = read('page_index')
    head, body = split_doc(doc)
    title = re.search(r'<title>(.*?)</title>', head, re.S).group(1)
    desc = re.search(r'<meta name="description" content="(.*?)"', head, re.S).group(1)
    desk = build_desktop_windows(body)
    with open(os.path.join(FRAG, 'desktop', 'content.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('<th:block th:fragment="desktop">' + sku_counts(rewrite_common(desk)) + '</th:block>\n')
    inner = sanitize_page_main(main_inner(body), 'index')
    fallback = body[body.index('<div data-fallback>'):]
    fallback = re.sub(r'<header class="site-header">.*?</header>', '', fallback, flags=re.S)
    fallback = fallback[:fallback.index('<footer class="site-footer">')].rstrip() + '</div>'
    fallback = re.sub(r'<script[^>]*src="/_astro/[^"]+"></script>', '', fallback)
    content = wrap_page(
        title, desc, rewrite_common(page_head_extra(head, '/')),
        fragment_inner('desktop') + fallback,
        '', page_scripts('index', doc),
    ).replace('<th:block th:replace="~{tqd-shared/header :: header(current=\'\', home=false)}"/>',
              '<th:block th:replace="~{tqd-shared/header :: header(current=\'\', home=true)}"/>')
    used['index'] = len(content)
    write_page('index', page_meta('index', title, desc), content)

    # ---- article detail template
    doc = read('page_bai-viet__ai-agent-khac-gi-chatbot')
    head, body = split_doc(doc)
    content = article_template(head, body)
    used['bai-viet-detail'] = len(content)
    write_page('bai-viet-detail', {
        'title': 'Bài viết · DũngTQ', 'summary': '', 'pageType': 'STANDALONE_PAGE',
        'contentType': 'THYMELEAF', 'status': 'PUBLISHED', 'metadata': {},
    }, content)

    print(json.dumps(used, indent=1))


def page_meta(slug, title, desc):
    return {
        'title': title, 'summary': desc, 'pageType': 'STANDALONE_PAGE',
        'contentType': 'THYMELEAF', 'status': 'PUBLISHED', 'metadata': {},
    }


def add_contact_form(inner):
    marker = '<div class="flex flex-col gap-6">'
    if marker not in inner:
        raise SystemExit('lien-he wrapper not found')
    form = '''
<form class="lux-card flex flex-col gap-4 p-6" data-contact-form novalidate>
<p class="text-xs font-semibold uppercase tracking-wider text-accent">Gửi lời nhắn</p>
<div class="grid gap-3 sm:grid-cols-2">
<label class="flex flex-col gap-1.5 text-sm font-medium">Họ tên<input class="contact-field" type="text" name="contactUsYourName" required maxlength="100" autocomplete="name"></label>
<label class="flex flex-col gap-1.5 text-sm font-medium">Email<input class="contact-field" type="email" name="contactUsYourEmail" required maxlength="254" autocomplete="email"></label>
</div>
<label class="flex flex-col gap-1.5 text-sm font-medium">Tiêu đề<input class="contact-field" type="text" name="contactUsSubject" required maxlength="200"></label>
<label class="flex flex-col gap-1.5 text-sm font-medium">Nội dung<textarea class="contact-field" name="contactUsMessage" rows="5" required maxlength="4000"></textarea></label>
<div class="flex flex-wrap items-center gap-3">
<button type="submit" class="btn-gold text-sm">Gửi lời nhắn</button>
<p class="text-sm" role="status" aria-live="polite" data-contact-status></p>
</div>
</form>
'''
    return inner.replace(marker, marker + form, 1)


def build_desktop_windows(body):
    start = body.index('<div id="desktop"')
    end = body.index('<div data-fallback>')
    desk = body[start:end]
    desk = re.sub(r'<script[^>]*src="/_astro/[^"]+"></script>', '', desk)
    # products window
    win = desk[desk.index('data-window="san-pham"'):desk.index('data-window="thu-vien"')]
    cards = re.findall(r'<article class="lux-card flex flex-col gap-3 p-6">.*?</article>', win, re.S)
    # replace the whole run of product cards (they are contiguous after the CTA)
    first, last = cards[0], cards[-1]
    new_win = win[:win.index(first)] + LOOP_TOKENS['san-pham'] + win[win.index(last) + len(last):]
    new_win = new_win.replace('<section class="desktop-window" aria-labelledby="win-title-san-pham" data-window="san-pham" tabindex="-1" hidden>',
                              '<section class="desktop-window" aria-labelledby="win-title-san-pham" data-window="san-pham" tabindex="-1" hidden th:with="products=${ezyfunctions.call(\'get_post_pagination\',\'{postType:\'tqd_product\',sortOrder:\'PRIORITY_ASC_ID_ASC\',limit:100}\')}">', 1)
    desk = desk.replace(win, new_win)
    # gallery window
    win = desk[desk.index('data-window="thu-vien"'):desk.index('data-window="video-ai"')]
    figs = re.findall(r'<figure class="lux-card gallery-item">.*?</figure>', win, re.S)
    if not figs:
        raise SystemExit('desktop gallery cards missing')
    new_win = win.replace(figs[0], LOOP_TOKENS['thu-vien'])
    for fig in figs[1:]:
        new_win = new_win.replace(fig, '')
    new_win = new_win.replace('<section class="desktop-window" aria-labelledby="win-title-thu-vien" data-window="thu-vien" tabindex="-1" hidden>',
                              '<section class="desktop-window" aria-labelledby="win-title-thu-vien" data-window="thu-vien" tabindex="-1" hidden th:with="gallery=${ezyfunctions.call(\'get_post_pagination\',\'{postType:\'tqd_gallery\',sortOrder:\'PRIORITY_ASC_ID_ASC\',limit:100}\')}">', 1)
    desk = desk.replace(win, new_win)
    # video window
    win = desk[desk.index('data-window="video-ai"'):desk.index('data-window="bai-viet"')]
    cards = re.findall(r'<article class="lux-card flex flex-col gap-3 p-6">.*?</article>', win, re.S)
    if not cards:
        raise SystemExit('desktop video cards missing')
    new_win = win.replace(cards[0], LOOP_TOKENS['video-ai'])
    for card in cards[1:]:
        new_win = new_win.replace(card, '')
    new_win = new_win.replace('<section class="desktop-window" aria-labelledby="win-title-video-ai" data-window="video-ai" tabindex="-1" hidden>',
                              '<section class="desktop-window" aria-labelledby="win-title-video-ai" data-window="video-ai" tabindex="-1" hidden th:with="videos=${ezyfunctions.call(\'get_post_pagination\',\'{postType:\'tqd_video\',sortOrder:\'PRIORITY_ASC_ID_ASC\',limit:100}\')}">', 1)
    desk = desk.replace(win, new_win)
    # articles window
    win = desk[desk.index('data-window="bai-viet"'):desk.index('data-window="lien-he"')]
    new_win = article_list_region(win)
    new_win = new_win.replace('<section class="desktop-window" aria-labelledby="win-title-bai-viet" data-window="bai-viet" tabindex="-1" hidden>',
                              '<section class="desktop-window" aria-labelledby="win-title-bai-viet" data-window="bai-viet" tabindex="-1" hidden th:with="posts=${ezyfunctions.call(\'get_post_pagination\',\'{postType:\'POST\',limit:100}\')}">', 1)
    desk = desk.replace(win, new_win)
    # The captured <section> tags carry tabindex/aria attributes, so a literal replace never matches; attach the
    # pagination variable with one pattern per window instead.
    windows = [
        ('san-pham', 'products', 'tqd_product'),
        ('thu-vien', 'gallery', 'tqd_gallery'),
        ('video-ai', 'videos', 'tqd_video'),
        ('bai-viet', 'posts', 'POST'),
    ]
    for win_name, var, post_type in windows:
        if post_type == 'POST':
            call = ("${ezyfunctions.call('get_latest_published_posts_by_type',"
                    "'{&quot;postType&quot;:&quot;POST&quot;,&quot;limit&quot;:100}')}")
        else:
            call = ("${ezyfunctions.call('get_post_pagination','{&quot;postType&quot;:&quot;" + post_type +
                    "&quot;,&quot;sortOrder&quot;:&quot;PRIORITY_ASC_ID_ASC&quot;,&quot;limit&quot;:100}')}")
        pattern = r'(<section[^>]*data-window="' + win_name + r'"[^>]*?)(\s*>)'
        desk = re.sub(pattern, lambda m: m.group(1) + ' th:with="' + var + '=' + call + '"' + m.group(2),
                      desk, count=1)
    return media_paths(rewrite_common(desk))


def article_template(head, body):
    main = main_inner(body)
    # breadcrumb date -> post date
    main = re.sub(r'<time[^>]*>[^<]+</time>', '<time class="tabular-nums" th:text="${#dates.format(new java.util.Date(post.publishedAt + 25200000L), \'dd/MM/yyyy\')}"></time>', main, count=1)
    # reading time is derived at build time on the old site; it is not stored in the post
    main = re.sub(r'<span class="tabular-nums text-muted"> · ~[0-9]+ phút đọc</span>', '', main)
    main = re.sub(r'<h1 class="display mb-5 text-\[2\.35rem\] sm:text-6xl">.*?</h1>',
                  '<h1 class="display mb-5 text-[2.35rem] sm:text-6xl" th:text="${post.title}"></h1>', main, count=1, flags=re.S)
    main = re.sub(r'<p class="mb-6 text-lg leading-relaxed text-muted">.*?</p>',
                  '<p class="mb-6 text-lg leading-relaxed text-muted" th:if="${post.summary != null}" th:text="${post.summary}"></p>', main, count=1, flags=re.S)
    tags_call = "ezyfunctions.call('get_post_meta','{&quot;postId&quot;:' + post.id + ',&quot;metaKey&quot;:&quot;tqd_tags&quot;}')"
    tags = ("<ul class=\"flex flex-wrap gap-1.5\" aria-label=\"Chủ đề bài viết\" "
            "th:with=\"tagsJson=${" + tags_call + " != null ? " + tags_call + ".metaValue : null}\">"
            "<th:block th:if=\"${tagsJson != null and tagsJson != '[]'}\">"
            "<li class=\"lux-chip px-2.5 py-0.5\" "
            "th:each=\"tag : ${#strings.arraySplit(#strings.replace(#strings.replace(#strings.replace(tagsJson,"
            "'[&quot;',''),'&quot;]',''),'&quot;,&quot;','|'),'|')}\" "
            "th:text=\"${tag}\"></li></th:block></ul>")
    main = re.sub(r'<ul class="flex flex-wrap gap-1\.5" aria-label="Chủ đề bài viết">.*?</ul>',
                  lambda _m: tags, main, count=1, flags=re.S)
    # page actions: markdown path and AI prompts depend on the post
    main = main.replace('data-copy-md="/bai-viet/ai-agent-khac-gi-chatbot.md"',
                        '''th:attr="data-copy-md=${'/bai-viet/' + post.slug + '.md'}"''')
    main = main.replace('href="/bai-viet/ai-agent-khac-gi-chatbot.md"',
                        '''th:href="${'/bai-viet/' + post.slug + '.md'}"''')
    main = main.replace('href="https://tqd.me/bai-viet/ai-agent-khac-gi-chatbot.md"',
                        '''th:href="${'/bai-viet/' + post.slug + '.md'}"''')
    # share buttons and AI prompts carry this post, not the captured sample
    # both share attributes live on one <button>, so they must share a single th:attr
    main = re.sub(r'data-share-url="[^"]*" data-share-title="[^"]*"',
                  '''th:attr="data-share-url=${'TQDORIGIN/bai-viet/' + post.slug},data-share-title=${post.title}"''',
                  main, count=1)
    main = re.sub(r'href="https://chatgpt\.com/\?q=[^"]*"',
                  '''th:attr="href=${'https://chatgpt.com/?q=' + #uris.escapeQueryParam(qaPrompt) + '&amp;hints=search'}"''',
                  main, count=1)
    main = re.sub(r'href="https://claude\.ai/new\?q=[^"]*"',
                  '''th:attr="href=${'https://claude.ai/new?q=' + #uris.escapeQueryParam(qaPrompt)}"''', main, count=1)
    main = re.sub(r'data-ai-gemini="[^"]*"', 'th:attr="data-ai-gemini=${qaPrompt}"', main, count=1)
    # cover and body
    # The capture carries the sample article's cover; render this post's cover from its tqd_cover meta instead.
    cover_call = "ezyfunctions.call('get_post_meta','{&quot;postId&quot;:' + post.id + ',&quot;metaKey&quot;:&quot;tqd_cover&quot;}')"
    main = re.sub(r'<img[^>]*class="article-cover"[^>]*>',
                  '<th:block th:with="coverMeta=${' + cover_call + '}">'
                  '<img class="article-cover" '
                  'th:if="${coverMeta != null and coverMeta.metaValue != null and coverMeta.metaValue != \'\'}" '
                  'th:src="${\'/api/v1/media/\' + coverMeta.metaValue}" '
                  'th:attr="alt=${post.title}" width="1200" height="675" fetchpriority="high">'
                  '</th:block>', main, count=1)
    main = re.sub(r'<details class="lux-card mb-8 p-5">.*?</details>', toc_block(), main, count=1, flags=re.S)
    main = re.sub(r'<div class="prose-article">.*?</div>\s*<aside class="lux-card mt-14',
                  '<div class="prose-article" th:utext="${post.content}"></div>\n<aside class="lux-card mt-14', main, count=1, flags=re.S)
    # related posts: latest 4 minus the current one, capped at 3
    related_start = main.index('<section class="mt-12 border-t border-line pt-10"')
    related_end = main.index('</section>', related_start) + len('</section>')
    rel = main[related_start:related_end]
    lis = re.findall(r'<li class="lux-card relative flex flex-col gap-2 p-5">.*?</li>', rel, re.S)
    t = lis[0]
    t = re.sub(r'<p class="font-mono text-xs text-muted">[^<]+</p>',
               '<p class="font-mono text-xs text-muted" th:text="${#dates.format(new java.util.Date(rel.publishedAt + 25200000L), \'dd/MM/yyyy\')}"></p>', t)
    t = re.sub(r'<a href="/bai-viet/[^"]+"([^>]*)>[^<]+</a>',
               "<a th:href=\"${'/bai-viet/' + rel.slug}\"\\1 th:text=\"${rel.title}\"></a>", t)
    t = re.sub(r'<p class="line-clamp-2 text-xs leading-relaxed text-muted">[^<]*</p>',
               '<p class="line-clamp-2 text-xs leading-relaxed text-muted" th:if="${rel.summary != null}" th:text="${rel.summary}"></p>', t, count=1)
    new_rel = rel.replace('<ul class="grid gap-4 sm:grid-cols-2">',
                          '<ul class="grid gap-4 sm:grid-cols-2" th:with="latest=${ezyfunctions.call(\'get_latest_published_posts_by_type\',\'{&quot;postType&quot;:&quot;POST&quot;,&quot;limit&quot;:4}\')}">')
    new_rel = new_rel.replace(lis[0], t.replace('<li class="lux-card relative flex flex-col gap-2 p-5">',
                                                '<li class="lux-card relative flex flex-col gap-2 p-5" th:each="rel,iter : ${latest.{? #this.id != #root.post.id}}" th:if="${iter.index &lt; 3}">'))
    for li in lis[1:]:
        new_rel = new_rel.replace(li, '')
    main = main[:related_start] + new_rel + main[related_end:]
    main = rewrite_common(main)
    main_open_tag = '<main id="main" class="mx-auto max-w-5xl px-5 py-10 sm:py-16">'
    extra = '''<link rel="canonical" th:href="${'/bai-viet/' + post.slug}">
<meta property="og:type" content="article">
<meta property="og:title" th:content="${post.title}">
<meta property="og:description" th:content="${post.summary}">
<meta property="og:url" th:content="${'/bai-viet/' + post.slug}">
<meta property="og:image" content="/api/v1/media/tqd-og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" th:content="${post.title}">
<meta name="twitter:description" th:content="${post.summary}">
<meta name="twitter:image" content="/api/v1/media/tqd-og.png">
'''
    title = 'Bài viết · DũngTQ'
    page = wrap_page(title, '', extra, main_open_tag + main + '</main>', 'bai-viet', page_scripts('article', read('page_bai-viet__ai-agent-khac-gi-chatbot')))
    post_expr = ("ezyfunctions.call('get_post_by_slug','{&quot;slug&quot;:&quot;' + "
                 "ezyfunctions.call('get_request_parameter','{&quot;name&quot;:&quot;slug&quot;}') + '&quot;}')")
    prompt = ("'Hãy đọc trang &quot;' + post.title + '&quot; của Trịnh Quang Dũng (DũngTQ) tại "
              "TQDORIGIN/bai-viet/' + post.slug + ' (bản Markdown sạch: TQDORIGIN/bai-viet/' + "
              "post.slug + '.md) và tóm tắt các ý cốt lõi kèm gợi ý áp dụng thực tế cho công việc / doanh "
              "nghiệp bằng tiếng Việt tự nhiên.'")
    page = page.replace('<html lang="vi"',
                        '<html lang="vi" th:with="post=${' + post_expr + '}, qaPrompt=${' + prompt + '}"', 1)
    return page


def toc_block():
    return '''<details class="lux-card mb-8 p-5" th:if="${post.content != null and #strings.contains(post.content, '<h2')}" th:with="parts=${#strings.arraySplit(post.content,'<h')},tocCount=${#arrays.length(#strings.arraySplit(post.content,'</h2>')) + #arrays.length(#strings.arraySplit(post.content,'</h3>')) - 2}">
<summary class="flex min-h-11 -my-2 cursor-pointer items-center justify-between gap-2 font-semibold">
<span class="inline-flex items-center gap-2 text-sm uppercase tracking-wider text-accent"><span th:text="|Mục lục bài viết (${tocCount} phần)|">Mục lục bài viết</span></span>
<span class="text-xs font-medium text-muted">Thu gọn / Mở</span>
</summary>
<nav class="mt-3 border-t border-line pt-3" aria-label="Mục lục bài viết">
<ol class="flex flex-col gap-1 text-sm">
<li th:each="part : ${parts}" th:if="${#strings.startsWith(part,'2 ') or #strings.startsWith(part,'3 ')}" th:classappend="${#strings.startsWith(part,'3 ') ? 'pl-4' : null}">
<a class="inline-flex min-h-11 sm:min-h-9 items-center py-1 text-ink/90 no-underline hover:text-accent-ink" th:href="${'#' + #strings.substringBetween(part,'id=&quot;','&quot;')}" th:text="${#strings.substringBefore(#strings.substringAfter(part,'&gt;'),'&lt;/h')}"></a>
</li>
</ol>
</nav>
</details>'''


if __name__ == '__main__':
    main()
