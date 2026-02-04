#!/usr/bin/env node
/**
 * Extracts text from PDF and DOCX in "Content Docs from Client" and writes data/client_docs.json.
 * Run: node scripts/extract-client-docs.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { PDFParse } from 'pdf-parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const docsDir = join(root, 'Content Docs from Client ');
const dataDir = join(root, 'data');

function extractDocxText(filePath) {
  try {
    const out = execSync(`unzip -p "${filePath.replace(/"/g, '\\"')}" word/document.xml`, {
      encoding: 'utf-8',
      maxBuffer: 2 * 1024 * 1024,
    });
    const text = out
      .replace(/<w:p[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    return text;
  } catch (e) {
    return `[Could not extract DOCX: ${e.message}]`;
  }
}

async function extractPdfText(filePath) {
  try {
    const buffer = readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result?.text?.trim() || '[No text in PDF]';
  } catch (e) {
    return `[Could not extract PDF: ${e.message}]`;
  }
}

function slug(name) {
  return name
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\.]/g, '')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80);
}

async function main() {
  const files = readdirSync(docsDir);
  const skipPrefix = 'Copy of ';
  const toProcess = files
    .filter((f) => !f.startsWith('.'))
    .filter((f) => !f.startsWith(skipPrefix));
  const out = [];
  for (const file of toProcess) {
    const ext = file.slice(file.lastIndexOf('.'));
    const baseName = file.slice(0, -ext.length);
    const path = join(docsDir, file);
    let content = '';
    let type = ext.toLowerCase();
    if (ext.toLowerCase() === '.pdf') {
      content = await extractPdfText(path);
    } else if (ext.toLowerCase() === '.docx') {
      content = extractDocxText(path);
    } else {
      continue;
    }
    out.push({
      id: slug(baseName),
      title: baseName,
      type: type === '.pdf' ? 'pdf' : 'docx',
      sourceFile: file,
      content: content.slice(0, 100000),
    });
  }
  const json = {
    source: 'Content Docs from Client',
    updated: new Date().toISOString().slice(0, 10),
    documents: out,
  };
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'client_docs.json'), JSON.stringify(json, null, 2), 'utf-8');
  console.log(`Wrote ${out.length} documents to data/client_docs.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
