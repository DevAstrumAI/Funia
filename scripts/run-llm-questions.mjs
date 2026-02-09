#!/usr/bin/env node
/**
 * Sends a list of questions to the chatbot API and prints Q&A to the terminal
 * with proper formatting and line breaks.
 *
 * Usage: node scripts/run-llm-questions.mjs
 * Ensure the server is running (npm start) and .env has GROQ_API_KEY or Ollama.
 */

import 'dotenv/config';

const QUESTIONS = [
  "Bietet Functiomed au Rheumatologie und Innere Medizin aa, und für weli Beschwerde isch das sinnvoll?",
  "Für weli Situation isch e Stammzelle-Behandlig (swiss stem cells) i de Orthopädie relevant?",
  "Was isch dr Unterschied zwüsche Osteopathie und Etiopathie bi Functiomed?",
  "Weli Problem im Kiefergelenk oder im Gesichtsbereich chönd mit Kiefertherapie behandlet werde?",
  "Für was isch d'Colon-Hydro-Therapie gedacht und wie lauft so e Behandlig ab?",
  "Was isch NUMO Orthopedic Systems und wie hilft das bi Lauf- oder Ganganalyse?",
  "Was umfasst FunctioTraining genau (Usduur, Koordination, Kraft, Beweglichkeit), und wie lauft es ab?",
  "Wänn sind d'Öffnigsziite vo de Trainingsflächi (FunctioTraining), und sind die anders als s'Sekretariat?",
  "Git es bi Functiomed es Notfall-System für akuti Beschwerde vom Bewegigsapparat?",
  "Wie chani online en Termin bueche, und für weli Aagebot gaht das?",
];

const BASE_URL = process.env.CHATBOT_URL || `http://localhost:${process.env.PORT || 3001}`;
const SEPARATOR = '\n' + '─'.repeat(80) + '\n';
const QUESTION_HEADER = '\n  ❓ FRAGE:\n  ';
const ANSWER_HEADER = '\n  📌 ANTWORT:\n\n  ';

async function ask(question) {
  const url = `${BASE_URL}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: question }],
      language: 'de',
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return (data?.message?.content ?? '').trim();
}

/** Strip markdown so output is plain text for pasting into docs (no ** or #). */
function stripMarkdown(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')       // *italic* -> italic
    .replace(/__([^_]+)__/g, '$1')       // __bold__
    .replace(/_([^_]+)_/g, '$1')        // _italic_
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // [text](url) -> text
    .replace(/`([^`]+)`/g, '$1');        // `code` -> code
  out = out.split('\n').map((line) => {
    const trimmed = line.trimStart();
    const headingMatch = trimmed.match(/^(#{1,6})\s*(.*)$/);
    if (headingMatch) return headingMatch[2].trim();
    if (/^\*\s+/.test(trimmed)) return trimmed.replace(/^\*\s+/, '• ');
    if (/^-\s+/.test(trimmed)) return trimmed.replace(/^-\s+/, '• ');
    return line;
  }).join('\n');
  return out;
}

function formatAnswer(text) {
  if (!text) return '(keine Antwort)';
  const plain = stripMarkdown(text);
  return plain
    .split(/\n+/)
    .map((line) => '  ' + line)
    .join('\n');
}

async function main() {
  console.log('\n' + '═'.repeat(80));
  console.log('  LLM-Antworten zu den definierten Fragen (Functiomed Chatbot)');
  console.log('  Base URL:', BASE_URL);
  console.log('═'.repeat(80));

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const num = i + 1;
    console.log(SEPARATOR);
    console.log(`  [${num}/${QUESTIONS.length}]`);
    console.log(QUESTION_HEADER + q);
    try {
      const answer = await ask(q);
      console.log(ANSWER_HEADER + formatAnswer(answer));
    } catch (err) {
      console.log(ANSWER_HEADER + '  ⚠ Fehler: ' + (err?.message || err));
    }
  }

  console.log(SEPARATOR);
  console.log('  Ende der Ausgabe.\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
