import { readFile, stat } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('./figma-assets-manifest.json', import.meta.url), 'utf8'));
const callsites = await readFile(new URL('../src/assets.ts', import.meta.url), 'utf8');
for (const [name, item] of Object.entries(manifest)) {
  const info = await stat(new URL(`../${item.path}`, import.meta.url));
  if (!info.size) throw new Error(`Empty Figma asset: ${name}`);
  if (!callsites.includes(`'${name}'`)) throw new Error(`Unmapped Figma asset: ${name}`);
}
const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
if (source.includes('figma.com/api/mcp/asset')) throw new Error('Temporary Figma URL in runtime code');
console.log(`Verified ${Object.keys(manifest).length} local Figma assets and their mappings.`);
const iterations = JSON.parse(await readFile(new URL('../src/case-iterations-data.json', import.meta.url), 'utf8'));
for (const item of Object.values(iterations).flat()) {
  const info = await stat(new URL(`../public/assets/iterations/${item.file}`, import.meta.url));
  const [x, y, width, height] = item.crop;
  if (!info.size || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > item.width || y + height > item.height) {
    throw new Error(`Invalid iteration image or crop: ${item.file}`);
  }
}
console.log(`Verified ${Object.values(iterations).flat().length} saved interface iterations and their crops.`);
