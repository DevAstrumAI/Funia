#!/usr/bin/env node
/**
 * Test Ollama fallback locally.
 * 1. Checks Ollama is running on localhost:11434
 * 2. Starts the app with GROQ_API_KEY unset (so only Ollama is used)
 * 3. Sends a test chat request
 * 4. Passes if the response contains assistant content
 *
 * Run from project root: node scripts/test-ollama-fallback.mjs
 * Requires: Ollama running (ollama serve or Ollama app), and a model pulled (e.g. ollama pull gemma2:2b)
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const PORT = 31999;
const BASE = `http://127.0.0.1:${PORT}`;

async function checkOllama() {
  try {
    const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    if (!r.ok) throw new Error(`Ollama returned ${r.status}`);
    const data = await r.json();
    const models = data?.models?.map((m) => m.name) || [];
    if (models.length === 0) throw new Error('No models found. Run: ollama pull gemma2:2b');
    console.log('  Ollama: OK (models:', models.slice(0, 3).join(', '), models.length > 3 ? '...' : '', ')');
    return true;
  } catch (e) {
    console.error('  Ollama: FAIL –', e.message);
    console.error('  Start Ollama (e.g. run the Ollama app or: ollama serve) and pull a model: ollama pull gemma2:2b');
    return false;
  }
}

function waitForServer(ms = 5000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const go = async () => {
      try {
        const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(500) });
        resolve(r.ok || r.status === 304);
        return;
      } catch (_) {}
      if (Date.now() - start > ms) {
        resolve(false);
        return;
      }
      setTimeout(go, 300);
    };
    go();
  });
}

async function runTest() {
  console.log('\n=== Testing Ollama fallback locally ===\n');

  if (!(await checkOllama())) {
    process.exit(1);
  }

  const server = spawn(process.execPath, [join(rootDir, 'server.js')], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(PORT), GROQ_API_KEY: '', OLLAMA_MODEL: 'qwen2.5:7b' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  server.stderr.on('data', (d) => { stderr += d; });

  const serverReady = waitForServer(15000);
  const code = new Promise((resolve) => server.on('close', resolve));

  const ready = await serverReady;
  if (!ready) {
    console.error('  Server: FAIL – did not start in time');
    server.kill('SIGTERM');
    await code;
    process.exit(1);
  }
  console.log('  Server: OK (started without GROQ_API_KEY)\n');

  let ok = false;
  try {
    const r = await fetch(BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Who is the CEO?' }],
        language: 'en',
      }),
      signal: AbortSignal.timeout(90000),
    });
    const data = await r.json().catch(() => ({}));
    const content = (data?.message?.content ?? '').trim();
    if (r.ok && content.length > 0) {
      console.log('  Chat response (Ollama):', content.slice(0, 200) + (content.length > 200 ? '...' : ''));
      const usedContext = !/which company|name of the company|company you're interested|company you are referring/i.test(content);
      if (usedContext) {
        console.log('\n  Result: PASS – Ollama fallback working and answer used context.\n');
      } else {
        console.log('\n  Result: PASS (fallback works) – For better answers from context use OLLAMA_MODEL=qwen2.5:7b.\n');
      }
      ok = true;
    } else {
      console.error('  Chat: FAIL –', r.status, data?.error || content || 'empty response');
    }
  } catch (e) {
    console.error('  Chat: FAIL –', e.message);
  }

  server.kill('SIGTERM');
  await code;
  process.exit(ok ? 0 : 1);
}

runTest();
