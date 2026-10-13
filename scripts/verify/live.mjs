// Checks the live site answers the expected status codes and shows the owner's name.
const base = process.argv[2] ?? 'https://tqd.io.vn';
const want = {
  '/': 200, '/san-pham': 200, '/bai-viet': 200, '/lien-he': 200,
  '/llms.txt': 200, '/index.md': 200, '/sitemap.xml': 200, '/og.png': 200,
  '/khong-co-trang-nay': 404,
};
let bad = 0;
for (const [p, code] of Object.entries(want)) {
  const res = await fetch(base + p, { redirect: 'follow' });
  if (res.status !== code) {
    console.log('FAIL', p, res.status);
    bad += 1;
  }
}
const html = await (await fetch(base + '/')).text();
if (!html.includes('Trịnh Quang Dũng')) {
  console.log('FAIL content');
  bad += 1;
}
console.log(bad ? 'BAD' : 'OK live');
process.exit(bad ? 1 : 0);
