#!/usr/bin/env python
"""Uploads the built site assets (`api/v1/media/tqd-*`) to the media library of an environment.

Idempotent by content: a file whose bytes already match is skipped; a changed file keeps its public name through
`POST /api/v1/media/{name}/replace-by-name`, so pages never need a new URL. Run after `node
tools/build-assets/build.mjs` whenever the CSS/JS/images change.

Usage (from the repository root):
    python tools/build-assets/upload-assets.py                 # dry run against the default environment
    python tools/build-assets/upload-assets.py --yes --env production
"""
import argparse
import glob
import os
import sys
import urllib.parse

SKILLS = 'C:/Users/ABC/.omp/plugins/cache/plugins/cppai___ezyplatform___0.6.0/skills/ezy-shared'
sys.path.insert(0, SKILLS)
from ezy_client import EzyError, load_env, request_bytes, upload_file  # noqa: E402

MEDIA_DIR = os.path.join('api', 'v1', 'media')


def remote_bytes(name):
    try:
        return request_bytes('/api/v1/media/' + urllib.parse.quote(name))
    except EzyError as err:
        # Only "not found" means the file is absent; an auth or server error must not turn into a pointless add.
        if getattr(err, 'status', None) == 404:
            return None
        raise


def public_url(name):
    env = load_env()
    return (env.get('public_url') or 'https://stg.tqd.me').rstrip('/') + '/api/v1/media/' + urllib.parse.quote(name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--yes', action='store_true')
    parser.add_argument('--env', help='environment.json entry name (default: the default entry, e.g. local)')
    args = parser.parse_args()
    if args.env:
        os.environ['EZY_ENV'] = args.env
    names = sorted(os.path.basename(p) for p in glob.glob(os.path.join(MEDIA_DIR, 'tqd-*')))
    # Fonts are embedded as data URLs in tqd-site.css and nothing links the woff2 files; this platform also
    # rejects font binaries (400 {"fileType":"invalid"}), so they stay local.
    names = [n for n in names if not n.startswith('tqd-font-')]
    plan = []
    for name in names:
        with open(os.path.join(MEDIA_DIR, name), 'rb') as handle:
            local = handle.read()
        remote = remote_bytes(name)
        action = 'skip' if remote == local else ('replace' if remote is not None else 'add')
        plan.append((name, local, action))
        print('%-34s %8d bytes  %s' % (name, len(local), action))
    work = [item for item in plan if item[2] != 'skip']
    print('\n%d files, %d to push' % (len(plan), len(work)))
    if not args.yes:
        print('dry run: re-run with --yes to upload')
        return
    for name, local, action in work:
        if action == 'add':
            path = '/api/v1/media/add?notPublic=false'
        else:
            path = '/api/v1/media/%s/replace-by-name' % urllib.parse.quote(name)
        status, raw = upload_file(path, name, local)
        if status != 200:
            raise SystemExit('upload %s failed: HTTP %s %s' % (name, status, raw[:200]))
        if remote_bytes(name) != local:
            raise SystemExit('upload %s did not replace the served bytes' % name)
        print(action, name)
    # The admin endpoint proves storage, not delivery: one public fetch through the site edge catches a private
    # file or a path that the public host does not serve.
    import urllib.request
    for name, local, action in work:
        with urllib.request.urlopen(public_url(name), timeout=30) as response:
            delivered = response.read()
        if delivered != local:
            raise SystemExit('public fetch of %s returned different bytes' % name)
    print('public delivery verified for %d files' % len(work))


if __name__ == '__main__':
    main()
