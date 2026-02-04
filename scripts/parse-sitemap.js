import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xmlPath = join(__dirname, '..', 'data', 'sitemap_raw.xml');
const outPath = join(__dirname, '..', 'data', 'sitemap.json');

const xml = readFileSync(xmlPath, 'utf-8');

const urlBlocks = xml.split(/<url>\s*/).slice(1);
const urls = [];

for (const block of urlBlocks) {
  const locMatch = block.match(/<loc><!\[CDATA\[([^\]]+)\]\]><\/loc>/);
  const lastmodMatch = block.match(/<lastmod><!\[CDATA\[([^\]]+)\]\]><\/lastmod>/);
  const changefreqMatch = block.match(/<changefreq><!\[CDATA\[([^\]]+)\]\]><\/changefreq>/);
  const priorityMatch = block.match(/<priority><!\[CDATA\[([^\]]+)\]\]><\/priority>/);
  if (locMatch) {
    urls.push({
      loc: locMatch[1].trim(),
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
      changefreq: changefreqMatch ? changefreqMatch[1].trim() : null,
      priority: priorityMatch ? priorityMatch[1].trim() : null,
    });
  }
}

const base = 'https://www.functiomed.ch';
const byPath = {};
urls.forEach((u) => {
  const path = u.loc.replace(base, '') || '/';
  byPath[path] = u;
});

const result = {
  source: 'https://www.functiomed.ch/sitemap.xml',
  generated: new Date().toISOString(),
  totalUrls: urls.length,
  urls,
  paths: Object.keys(byPath).sort(),
  byPath,
};

writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
console.log('Written', outPath, 'with', urls.length, 'URLs');
