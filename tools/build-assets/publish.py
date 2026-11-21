#!/usr/bin/env python
"""Pushes the generated `page-fragments/tqd-shared/*` and `pages/*` sources to the local EzyPlatform.

Idempotent: existing posts are updated in place through PUT /ezyarticle/api/v1/posts/{id}, missing ones are
created through POST /ezyarticle/api/v1/posts/add with the same slug/type. Run after `python
tools/build-assets/port.py` whenever the generated markup changes.

Usage (from the repository root):
    python tools/build-assets/publish.py            # dry run
    python tools/build-assets/publish.py --yes      # write to the local environment
"""
import argparse
import glob
import json
import os
import re
import sys

# ezy_client ships with the EzyPlatform agent plugin, whose cache folder name carries its version; take the newest
# install unless EZY_SHARED points elsewhere.
SKILLS = os.environ.get('EZY_SHARED') or max(
    glob.glob(os.path.expanduser('~/.omp/plugins/cache/plugins/*ezyplatform*/skills/ezy-shared')) or [''],
    key=lambda p: [int(n) for n in re.findall(r'\d+', p.rsplit('___', 1)[-1])])
sys.path.insert(0, SKILLS)
from ezy_client import list_posts, request_json, update_payload  # noqa: E402

FRAGMENTS = ['shell', 'header', 'footer', 'desktop']
PAGES = ['index', 'ho-so', 'san-pham', 'thu-vien', 'video-ai', 'bai-viet', 'lien-he', 'shop',
         'tai-video', 'quyen-rieng-tu', '404', 'bai-viet-detail']


def page_title(content):
    return re.search(r'<title>(.*?)</title>', content, re.S).group(1)


def page_summary(content):
    return re.search(r'<meta name="description" content="(.*?)"', content, re.S).group(1)


def live_posts():
    return {p['slug']: p for p in list_posts(page_size=200)}


def server_slug(slug):
    # EzyArticle serves the page whose slug is `home` at `/`.
    return 'home' if slug == 'index' else slug


def plan_pages(live):
    jobs = []
    for slug in PAGES:
        target = server_slug(slug)
        path = os.path.join('pages', slug, 'content.html')
        content = open(path, encoding='utf-8').read()
        title = page_title(content)
        summary = page_summary(content)
        found = live.get(target)
        if found and found.get('postType') == 'STANDALONE_PAGE' and found.get('slug') == target:
            jobs.append(('page', slug, found, title, summary, content))
        else:
            jobs.append(('page', slug, None, title, summary, content))
    for name in FRAGMENTS:
        path = os.path.join('page-fragments', 'tqd-shared', name, 'content.html')
        content = open(path, encoding='utf-8').read()
        found = next(
            (p for p in live.values()
             if p.get('slug') == 'tqd' + name and p.get('postType') == 'FRAGMENT'),
            None,
        )
        jobs.append(('fragment', name, found, 'tqd_' + name, None, content))
    return jobs


def apply(job):
    kind, name, post, title, summary, content = job
    if post:
        body = update_payload(post, content=content, title=title, summary=summary or '')
        return request_json('PUT', '/ezyarticle/api/v1/posts/%d' % post['id'], body)
    if kind == 'page':
        return request_json('POST', '/ezyarticle/api/v1/posts/add', {
            'title': title, 'slug': server_slug(name), 'content': content, 'summary': summary,
            'contentType': 'THYMELEAF', 'status': 'PUBLISHED', 'postType': 'STANDALONE_PAGE',
        })
    return request_json('POST', '/ezyarticle/api/v1/posts/add', {
        'title': title, 'content': content, 'contentType': 'THYMELEAF', 'status': 'PUBLISHED',
        'postType': 'FRAGMENT', 'pageFragmentPageName': 'tqd-shared', 'pageFragmentName': name,
    })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--yes', action='store_true')
    parser.add_argument('--env', help='environment.json entry name (default: the default entry, e.g. local)')
    args = parser.parse_args()
    if args.env:
        os.environ['EZY_ENV'] = args.env
    jobs = plan_pages(live_posts())
    for kind, name, post, title, _summary, content in jobs:
        print('%s %-16s %-9s %7d bytes  %s' % (
            kind, name, 'update' if post else 'create', len(content.encode('utf-8')), title[:60]))
    if not args.yes:
        print('\ndry run: re-run with --yes to publish to the local environment')
        return
    for job in jobs:
        result = apply(job)
        print('published', job[0], job[1], '->', result.get('slug') if isinstance(result, dict) else '')


if __name__ == '__main__':
    main()
