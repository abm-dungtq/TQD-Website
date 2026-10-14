-- The "Đào tạo & sự kiện" section becomes the photo and video gallery ("Thư viện"), edited at /admin/thu-vien.
-- Safe to run on a database that already has this state: it writes the same values.
UPDATE settings SET value = '[{"id":"ho-so","title":"Hồ sơ","short":"Mình là ai, đang làm gì","icon":"user"},{"id":"san-pham","title":"Sản phẩm","short":"Skill, agent và công cụ tự xây","icon":"box"},{"id":"thu-vien","title":"Thư viện","short":"Ảnh và video các chương trình","icon":"image"},{"id":"video-ai","title":"Video AI","short":"Thử nghiệm video làm bằng AI","icon":"film"},{"id":"bai-viet","title":"Bài viết","short":"Viết hằng ngày về AI ứng dụng","icon":"book"},{"id":"lien-he","title":"Liên hệ","short":"Kết nối với mình","icon":"mail"}]' WHERE key = 'sections';
INSERT OR IGNORE INTO settings(key, value) VALUES ('gallery', '[]');
DELETE FROM items WHERE kind = 'training';
UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'content_version';
