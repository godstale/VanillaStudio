// R-5: 100/300 노드 뷰포트 팬/줌 프레임 간격 측정. 사용: node bench.mjs (dev 서버 5205 실행 중)
import puppeteer from '../../packages/export-worker/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox', '--window-size=1600,900'] });
for (const n of [100, 300]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:5205/?n=${n}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.react-flow__node');
  const loadMs = Date.now() - t0;
  const mounted = await page.$$eval('.react-flow__node', (e) => e.length);
  const r = await page.evaluate(() => window.__bench(4));
  console.log(JSON.stringify({ ...r, loadMs, mountedNodes: mounted, minimap: !!(await page.$('.react-flow__minimap')) }));
  if (n === 100) await page.screenshot({ path: 'shot-100.png' });
  await page.close();
}
await browser.close();
