// Rebuild raster derivatives from the original vector paths. No server or fonts required.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const brand = `${root}public/brand/`;
const logo = await readFile(`${brand}logo.svg`, 'utf8');
const symbol = await readFile(`${brand}symbol.svg`, 'utf8');
for (const [variant, color] of [['dark', '#173F35'], ['light', '#F6F7F2']]) {
  const mono = logo.replace(/  <rect[^>]+\/>\n/, '').replaceAll('#173F35', color).replaceAll('#F6F7F2', color).replaceAll('#37B9A0', color);
  await writeFile(`${brand}logo-mono-${variant}.svg`, mono);
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  async function raster(svg, width, height, path, background = 'transparent') {
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><body style="margin:0;background:${background}">${svg.replace('<svg ', `<svg width="${width}" height="${height}" `)}</body></html>`);
    await page.screenshot({ path, omitBackground: background === 'transparent' });
  }
  await raster(logo, 1360, 256, `${brand}logo.png`);
  await raster(symbol, 512, 512, `${brand}icon-512.png`);
  await raster(symbol, 192, 192, `${brand}icon-192.png`);
  await raster(symbol, 180, 180, `${root}public/apple-touch-icon.png`, '#173F35');
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.setContent(`<html><body style="margin:0;background:#F6F7F2;font-family:Arial,sans-serif;color:#173F35"><div style="padding:50px 60px"><p style="font-size:14px;letter-spacing:4px;margin:0 0 40px">TRANSQORA · BRAND IDENTITY</p><div style="width:680px">${logo}</div><div style="display:flex;gap:20px;margin-top:52px;align-items:center">${symbol.replace('<svg ', '<svg width="96" height="96" ')}<p style="font-size:18px;line-height:1.7;margin-left:20px">One conversation. Beyond language.<br/><span style="color:#52634B">Forest #173F35 · Jade #37B9A0 · Paper #F6F7F2</span></p></div></div><div style="height:160px;background:#173F35;padding:36px 60px;display:flex;gap:60px;align-items:center"><div style="width:340px">${await readFile(`${brand}logo-mono-light.svg`, 'utf8')}</div><span style="color:#F6F7F2;font-size:16px">Original vector paths · No external font</span></div></body></html>`);
  await page.screenshot({ path: `${brand}brand-preview.png` });
} finally { await browser.close(); }
execFileSync(`${root}../.venv/bin/python`, ['-c', `from PIL import Image
from pathlib import Path
root = Path(${JSON.stringify(root)})
im = Image.open(root / 'public/brand/icon-512.png')
im.save(root / 'public/favicon.ico', sizes=[(16,16),(32,32),(48,48)], bitmap_format='bmp')
`]);
console.log('Generated Transqora SVG variants, PNG assets, favicon ICO and preview.');
