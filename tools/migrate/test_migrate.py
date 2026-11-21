#!/usr/bin/env python3
"""Regression tests for tools/migrate/migrate.py (stdlib unittest, no server needed).

Run from the repository root:

    python -m unittest tools.migrate.test_migrate -v
"""
from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import tools.migrate.migrate as migrate


def tree_hash(folder: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(p for p in folder.rglob("*") if p.is_file()):
        digest.update(str(path.relative_to(folder)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


class SlugAndMediaNameTests(unittest.TestCase):
    def test_slugify_removes_vietnamese_diacritics(self) -> None:
        self.assertEqual(migrate.slugify("Bảy Tám Chín 3D"), "bay-tam-chin-3d")
        self.assertEqual(migrate.slugify("Tử Vi Đầu Số Thiên Kỷ"), "tu-vi-dau-so-thien-ky")
        self.assertEqual(migrate.slugify("TQD KidGuard & TV Launcher"), "tqd-kidguard-tv-launcher")

    def test_slugify_requires_content(self) -> None:
        with self.assertRaises(migrate.MigrationError):
            migrate.slugify("!!!")

    def test_flatten_key_replaces_slashes(self) -> None:
        self.assertEqual(migrate.flatten_key("2026/10/a.webp"), "2026-10-a.webp")

    def test_flatten_key_rejects_invalid_result(self) -> None:
        with self.assertRaises(migrate.MigrationError):
            migrate.flatten_key("2026/10/a b.webp")


class TagsTests(unittest.TestCase):
    def test_parse_article_tags_preserves_order(self) -> None:
        self.assertEqual(
            migrate.parse_article_tags('["Viết Pro","Skill","Claude Code"]'),
            ["Viết Pro", "Skill", "Claude Code"],
        )
        self.assertEqual(migrate.parse_article_tags(None), [])
        self.assertEqual(migrate.parse_article_tags("[]"), [])

    def test_parse_article_tags_rejects_non_arrays(self) -> None:
        with self.assertRaises(migrate.MigrationError):
            migrate.parse_article_tags('{"tag":"x"}')
        with self.assertRaises(migrate.MigrationError):
            migrate.parse_article_tags('["ok",1]')

    def test_compact_tags_matches_d1_encoding(self) -> None:
        tags = ["GitHub", "Claude Code", "Codex", "Người mới"]
        self.assertEqual(migrate.compact_tags(tags), '["GitHub","Claude Code","Codex","Người mới"]')


class RewriteMediaUrlTests(unittest.TestCase):
    mapping = {"2026/10/a.webp": "2026-10-a.webp"}

    def test_relative_and_absolute_urls_are_rewritten(self) -> None:
        markup = (
            '<img src="/media/2026/10/a.webp">'
            '<a href="https://tqd.me/media/2026/10/a.webp">x</a>'
            '<video poster="//tqd.me/media/2026/10/a.webp"></video>'
        )
        out = migrate.rewrite_media_urls(markup, self.mapping, "test")
        self.assertEqual(out.count("/api/v1/media/2026-10-a.webp"), 3)
        self.assertNotIn("/media/2026/10", out)

    def test_unknown_key_is_a_hard_error(self) -> None:
        with self.assertRaises(migrate.MigrationError):
            migrate.rewrite_media_urls('<img src="/media/2026/10/missing.webp">', self.mapping, "test")

    def test_query_string_is_dropped(self) -> None:
        out = migrate.rewrite_media_urls('<img src="/media/2026/10/a.webp?v=1">', self.mapping, "test")
        self.assertEqual(out, '<img src="/api/v1/media/2026-10-a.webp">')


class GenerateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self._saved = {
            "POSTS_DIR": migrate.POSTS_DIR,
            "MIGRATE_DIR": migrate.MIGRATE_DIR,
            "MEDIA_MAP_PATH": migrate.MEDIA_MAP_PATH,
            "MANIFEST_PATH": migrate.MANIFEST_PATH,
            "REPORT_PATH": migrate.REPORT_PATH,
        }
        migrate.POSTS_DIR = root / "posts"
        migrate.MIGRATE_DIR = root / "artifacts"
        migrate.MEDIA_MAP_PATH = migrate.MIGRATE_DIR / "media-map.json"
        migrate.MANIFEST_PATH = migrate.MIGRATE_DIR / "manifest.json"
        migrate.REPORT_PATH = migrate.MIGRATE_DIR / "report.json"
        self.conn = migrate.load_db(migrate.DEFAULT_DB)

    def tearDown(self) -> None:
        self.conn.close()
        for name, value in self._saved.items():
            setattr(migrate, name, value)
        self.temp.cleanup()

    def test_generate_counts_and_is_idempotent(self) -> None:
        first = migrate.generate(self.conn)
        self.assertEqual(
            first["counts"]["posts"],
            migrate.EXPECTED_ARTICLES + migrate.EXPECTED_ITEMS + migrate.EXPECTED_GALLERY,
        )
        self.assertEqual(first["counts"]["draft"], 2)
        self.assertEqual(first["counts"]["articlesWithTags"], migrate.EXPECTED_ARTICLES)
        self.assertEqual(
            first["byPostType"],
            {"POST": migrate.EXPECTED_ARTICLES, "tqd_gallery": migrate.EXPECTED_GALLERY, "tqd_product": 14, "tqd_video": 7},
        )
        self.assertEqual(len(first["fallbacks"]), 2)
        article_meta = json.loads(
            (migrate.POSTS_DIR / "github-co-ban-cho-nguoi-moi-dung-agent-ai" / "meta.json").read_text(encoding="utf-8")
        )
        self.assertEqual(article_meta["tags"], ["GitHub", "Claude Code", "Codex", "Người mới"])

        first_hash = tree_hash(migrate.POSTS_DIR)
        second = migrate.generate(self.conn)
        # articles + products + videos + gallery entries in the D1 fixture
        self.assertEqual(second["counts"]["posts"], migrate.EXPECTED_ARTICLES + migrate.EXPECTED_ITEMS + migrate.EXPECTED_GALLERY)
        self.assertEqual(second["prunedFolders"], [])
        self.assertEqual(tree_hash(migrate.POSTS_DIR), first_hash)

    def test_media_map_has_every_row(self) -> None:
        migrate.generate(self.conn)
        mapping = json.loads(migrate.MEDIA_MAP_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(mapping), migrate.EXPECTED_MEDIA)
        self.assertTrue(all(name == key.replace("/", "-") for key, name in mapping.items()))

    def test_draft_article_stays_draft(self) -> None:
        self.conn.execute("UPDATE articles SET status='draft' WHERE slug='viet-pro-skill-viet-tieng-viet-cho-ai'")
        report = migrate.generate(self.conn)
        meta = json.loads(
            (migrate.POSTS_DIR / "viet-pro-skill-viet-tieng-viet-cho-ai" / "meta.json").read_text(encoding="utf-8")
        )
        self.assertEqual(meta["status"], "DRAFT")
        self.assertEqual(report["counts"]["draft"], 3)


if __name__ == "__main__":
    unittest.main()
