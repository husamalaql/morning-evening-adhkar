import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const out = new URL('../www/', import.meta.url);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const path of ['index.html', 'style.css', 'data', 'assets', 'islamic-pattern-4096.svg']) {
  try {
    await cp(new URL(path, root), new URL(path, out), { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await sharp(fileURLToPath(new URL('../assets/app-icon.svg', import.meta.url))).resize(1024, 1024).png().toFile(fileURLToPath(new URL('../assets/icon.png', import.meta.url)));

let html = await readFile(new URL('index.html', out), 'utf8');
html = html
  .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/g, '')
  .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/g, '')
  .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^"]+" rel="stylesheet">/g, '')
  .replace(/<script src="script\.js"><\/script>/, '<script src="app.js"></script>');
await writeFile(new URL('index.html', out), html);

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['chrome90'],
  outfile: new URL('app.js', out).pathname,
  minify: true,
  sourcemap: false
});

console.log('Android web assets prepared in www/');
