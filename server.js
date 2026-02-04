import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const servicesPath = join(__dirname, 'data', 'services.json');
const teamPath = join(__dirname, 'data', 'team.json');
const sitePath = join(__dirname, 'data', 'site.json');
const tarifePath = join(__dirname, 'data', 'tarife.json');
const sitemapPath = join(__dirname, 'data', 'sitemap.json');
const faqsPath = join(__dirname, 'data', 'faqs.json');
const functiokursePath = join(__dirname, 'data', 'functiokurse.json');
const clientDocsPath = join(__dirname, 'data', 'client_docs.json');
const shopPath = join(__dirname, 'data', 'shop.json');

const data = JSON.parse(readFileSync(servicesPath, 'utf-8'));
let faqsData = {};
try {
  faqsData = JSON.parse(readFileSync(faqsPath, 'utf-8'));
} catch (_) {}
let functiokurseData = null;
try {
  functiokurseData = JSON.parse(readFileSync(functiokursePath, 'utf-8'));
} catch (_) {}
let clientDocsData = null;
try {
  clientDocsData = JSON.parse(readFileSync(clientDocsPath, 'utf-8'));
} catch (_) {}
let shopData = null;
try {
  shopData = JSON.parse(readFileSync(shopPath, 'utf-8'));
} catch (_) {}
const teamData = JSON.parse(readFileSync(teamPath, 'utf-8'));
const siteData = JSON.parse(readFileSync(sitePath, 'utf-8'));
const tarifeData = JSON.parse(readFileSync(tarifePath, 'utf-8'));
let sitemapData = { paths: [] };
try {
  sitemapData = JSON.parse(readFileSync(sitemapPath, 'utf-8'));
} catch (_) {}

const MAP_LINK = 'https://maps.google.com/?q=Langgrütstrasse+112,+8047+Zürich';

const TRAINING_ABOS_BLOCK_TEXT =
  '\n**functioTraining Abos (bei Abo-Fragen immer diese Pakete und Preise nennen):**\n' +
  '• Jahresabo BASIC: 810 CHF (inkl. 2×30min Einführung + Kontrolle)\n' +
  '• Halbjahresabo BASIC: 455 CHF (inkl. 2×30min Einführung + Kontrolle)\n' +
  '• Jahresabo PRO: 990 CHF (inkl. 5×30min Sitzung dipl. Physiotherapeut)\n' +
  '• Jahresabo PREMIUM: 1190 CHF (inkl. 10×30min Sitzung dipl. Physiotherapeut)\n' +
  'Öffnungszeiten Training: Mo–Do 07:00–19:30, Fr 07:00–17:30, Sa 08:00–15:30. 10% Rabatt für Studenten/AHV/IV.\n';

function getTrainingAbosBlock() {
  if (clientDocsData?.documents?.length) {
    const aboDoc = clientDocsData.documents.find(
      (d) => /flyer.*abo|abo.*flyer/i.test(d.id || '') || /Flyer.*Abo|Abo.*26/i.test(d.title || '')
    );
    if (aboDoc?.content) {
      const c = aboDoc.content.replace(/\s+/g, ' ').trim();
      if (/\b810\s*CHF|\b455\s*CHF|\b990\s*CHF|\b1190\s*CHF/.test(c)) return TRAINING_ABOS_BLOCK_TEXT;
    }
  }
  return TRAINING_ABOS_BLOCK_TEXT;
}

const MAX_CLIENT_DOC_EXCERPT = 160;
const MAX_CLIENT_DOC_EXCERPT_ABO = 520;
function getClientDocsExcerpt() {
  if (!clientDocsData?.documents?.length) return '';
  const lines = [];
  for (const doc of clientDocsData.documents) {
    const text = (doc.content || '').replace(/\s+/g, ' ').trim();
    const isAboOrPricing =
      /abo|flyer.*abo|goldene\s*regeln|functiotraining/i.test(doc.id || '') ||
      /Abo|Flyer.*Abo|Goldene Regeln|functioTraining/i.test(doc.title || '');
    const maxLen = isAboOrPricing ? MAX_CLIENT_DOC_EXCERPT_ABO : MAX_CLIENT_DOC_EXCERPT;
    const excerpt = text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    if (excerpt) lines.push(`**${doc.title}:** ${excerpt}`);
  }
  if (lines.length === 0) return '';
  return '\n**Weitere Client-Dokumente (nutzen bei passenden Fragen):**\n' + lines.join('\n') + '\n';
}

function getShopBlock() {
  if (!shopData?.products?.length) return '';
  const lines = shopData.products.map((q) => {
    const price = q.priceNote ? ` – ${q.priceNote}` : '';
    return `• ${q.title} (${q.author})${price}`;
  });
  return `\n**Shop (Bücher, bei Shop-Fragen nennen):** ${lines.join(' | ')}. Erhältlich in der Praxis bzw. [Online-Shop](${shopData.source}).\n`;
}

const MAX_SERVICE_DESC_LEN = 85;
function getServicesBlock() {
  if (!data?.services?.length) return '';
  const lines = data.services.map((s) => {
    const desc = (s.description || '').trim() || '—';
    const short = desc.length > MAX_SERVICE_DESC_LEN ? desc.slice(0, MAX_SERVICE_DESC_LEN) + '…' : desc;
    return `**${s.name}:** ${short}`;
  }).join('\n');
  return '\n**Leistungen / Services (bei Service-Fragen nutzen, Beschreibung erwähnen):**\n' + lines + '\n';
}

const MAX_TEAM_MEMBER_LINE = 220;
function getTeamBlock() {
  if (!teamData?.team?.length) return '';
  const depts = teamData.departments || [...new Set(teamData.team.map((m) => m.department).filter(Boolean))];
  const byDept = {};
  for (const m of teamData.team) {
    const d = m.department || 'Sonstige';
    if (!byDept[d]) byDept[d] = [];
    let line = `${m.name} – ${m.title || '—'}`;
    if (m.credentials) line += `. ${m.credentials}`;
    if (m.specialties?.length) line += `. Schwerpunkte: ${m.specialties.slice(0, 5).join(', ')}`;
    if (m.bio) line += `. ${m.bio}`;
    if (m.languages?.length) line += `. Sprachen: ${m.languages.slice(0, 5).join(', ')}`;
    if (line.length > MAX_TEAM_MEMBER_LINE) line = line.slice(0, MAX_TEAM_MEMBER_LINE - 1) + '…';
    byDept[d].push(line);
  }
  const parts = depts.map((d) => `**${d}:**\n${(byDept[d] || []).join('\n')}`).filter(Boolean);
  return '\n**Team (bei Fragen zu Personen oder Abteilungen nutzen; Antwort natürlich formulieren, keine feste Struktur):**\n' + parts.join('\n\n') + '\n';
}

const contactBlock =
  `Kontakt: ${siteData?.contact?.address || 'Langgrütstrasse 112, CH-8047 Zürich'}. Tel: ${siteData?.contact?.phone || '+41 44 401 15 15'}. E-Mail: ${siteData?.contact?.email || 'functiomed@hin.ch'}. ` +
  `Termin buchen: [${siteData?.home?.booking?.label || 'Termin buchen'}](${siteData?.home?.booking?.url || 'https://www.functiomed.ch/termin-buchen'}). ` +
  `Notfall: [${siteData?.notfall?.title || 'Notfall'}](${siteData?.notfall?.url || 'https://www.functiomed.ch/notfall'}). ` +
  `Öffnungszeiten Sekretariat: ${siteData?.openingHours?.secretariat || 'Mo–Do 08:30–12:00 / 13:30–16:30, Fr 08:30–12:00 / 13:30–16:00, Sa 09:00–11:00'}.\n`;

const SYSTEM_PROMPT_DE =
  'Du bist FUNIA, die freundliche Assistentin der functiomed AG. Antworte ausschließlich auf Deutsch, kurz, freundlich und prägnant. Gib immer eine vollständige Antwort (kein Abbruch mitten im Satz oder in der Aufzählung). Nutze die folgenden Daten. Formatiere mit **Fett**, ## Überschriften und Aufzählungen. Setze Links nur wenn passend.\n' +
  contactBlock +
  getTrainingAbosBlock() +
  getServicesBlock() +
  getTeamBlock() +
  getShopBlock() +
  getClientDocsExcerpt();

const SYSTEM_PROMPT_EN =
  'You are FUNIA, the friendly assistant of functiomed AG. Answer only in English, briefly and in a friendly way. Always give a complete answer (do not cut off mid-sentence or mid-list). Use the data below. Format with **bold**, ## headings and lists. Add links only when relevant.\n' +
  contactBlock +
  getTrainingAbosBlock() +
  getServicesBlock() +
  getTeamBlock() +
  getShopBlock() +
  getClientDocsExcerpt();

const SYSTEM_PROMPT_FR =
  'Tu es FUNIA, l’assistante de functiomed AG. Réponds uniquement en français, de façon brève et amicale. Donne toujours une réponse complète (sans couper en milieu de phrase ou de liste). Utilise les données ci-dessous. Formate avec **gras**, ## titres et listes. Mets des liens seulement si pertinent.\n' +
  contactBlock +
  getTrainingAbosBlock() +
  getServicesBlock() +
  getTeamBlock() +
  getShopBlock() +
  getClientDocsExcerpt();

const LANGUAGE_INSTRUCTION = {
  de: 'Antworte ausschließlich auf Deutsch.',
  en: 'Answer only in English.',
  fr: 'Réponds uniquement en français.',
};

const LANGUAGE_LAST_USER_HINT = {
  de: 'Nutzer fragt (auf Deutsch beantworten):',
  en: 'User asks (answer in English):',
  fr: 'L’utilisateur demande (répondre en français):',
};

const GREETING_PATTERNS = [
  /^(hi|hey|hallo|hello|moin|servus|grüezi|grüessech|salut|bonjour|ciao|hoi)\s*!*$/i,
  /^(guten\s*(morgen|tag|abend)|good\s*(morning|evening|day)|bonjour)\s*!*$/i,
  /^hallo\s+funia\s*!*$/i,
];

const GREETING_RESPONSES = {
  de: 'Hallo! 👋 Ich bin FUNIA, deine Assistentin bei functiomed. Frag mich zu Leistungen, Team, Terminen oder Abos. Womit kann ich dir helfen?',
  en: 'Hello! 👋 I’m FUNIA, your assistant at functiomed. Ask me about services, team, appointments or training abos. How can I help?',
  fr: 'Bonjour ! 👋 Je suis FUNIA, votre assistante chez functiomed. Posez-moi des questions sur nos prestations, l’équipe, les rendez-vous ou les abonnements. Comment puis-je vous aider ?',
};

function normalizeForFaq(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\wäöüßéèêëàâùûîïç\s]/g, '')
    .trim();
}

function findFaqAnswer(userContent, lang) {
  const langKey = lang === 'en' ? 'EN' : lang === 'fr' ? 'FR' : 'DE';
  const normalized = normalizeForFaq(userContent);
  if (!normalized) return null;
  for (const section of Object.values(faqsData)) {
    if (!section?.questions?.[langKey] || !section?.answer?.[langKey]) continue;
    for (const q of section.questions[langKey]) {
      if (normalizeForFaq(q) === normalized || normalized.includes(normalizeForFaq(q)) || normalizeForFaq(q).includes(normalized)) {
        return section.answer[langKey];
      }
    }
  }
  return null;
}

function isShopOrBooksQuestion(text) {
  const t = (text || '').toLowerCase();
  return /shop|bücher|books|livres|kaufen|kauf|bestellen|order|preis.*buch|buch.*preis/.test(t);
}

function getShopBooksAnswer(lang) {
  if (!shopData?.products?.length) return null;
  const langKey = lang === 'en' ? 'EN' : lang === 'fr' ? 'FR' : 'DE';
  const lines = shopData.products.map((p) => {
    const price = p.priceNote ? ` – ${p.priceNote}` : '';
    return `• **${p.title}** (${p.author})${price}`;
  });
  const intro = lang === 'en' ? '**Our books:**' : lang === 'fr' ? '**Nos livres :**' : '**Unsere Bücher:**';
  return intro + '\n\n' + lines.join('\n') + `\n\n[Shop](${shopData.source})`;
}

function getGroqClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

app.post('/api/chat', async (req, res) => {
  const { messages: bodyMessages = [], language: bodyLang } = req.body || {};
  const lang = bodyLang === 'en' || bodyLang === 'fr' ? bodyLang : 'de';
  const messages = Array.isArray(bodyMessages) ? bodyMessages : [];
  const lastMessage = messages.filter((m) => m?.role === 'user').pop();
  const lastContent = (lastMessage?.content || '').trim();
  if (!lastContent) {
    return res.status(400).json({ error: 'No user message.' });
  }

  const isGreeting = GREETING_PATTERNS.some((re) => re.test(lastContent.trim()));
  if (isGreeting) {
    return res.json({ message: { role: 'assistant', content: GREETING_RESPONSES[lang] } });
  }

  const faqAnswer = findFaqAnswer(lastContent, lang);
  if (faqAnswer != null) {
    return res.json({ message: { role: 'assistant', content: faqAnswer } });
  }

  if (isShopOrBooksQuestion(lastContent)) {
    const shopAnswer = getShopBooksAnswer(lang);
    if (shopAnswer != null) {
      return res.json({ message: { role: 'assistant', content: shopAnswer } });
    }
  }

  const groq = getGroqClient();
  if (!groq) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is not set. Add it to .env and restart the server.',
    });
  }

  const langInstruction = LANGUAGE_INSTRUCTION[lang];
  const systemPromptByLang = {
    de: SYSTEM_PROMPT_DE,
    en: SYSTEM_PROMPT_EN,
    fr: SYSTEM_PROMPT_FR,
  };
  const systemPrompt = systemPromptByLang[lang] || SYSTEM_PROMPT_DE;

  // Default: Llama 4 Scout – 30K TPM, 131K context, 500K TPD (better limits than 8b-instant)
const model = process.env.GROQ_CHAT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
  const maxRetries = 2;

  try {
    const systemContent = langInstruction + '\n' + systemPrompt;
    const lastUserHint = LANGUAGE_LAST_USER_HINT[lang];
    const chatMessages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: lastUserHint + '\n\n' + lastContent },
    ];

    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: chatMessages,
          max_tokens: 512,
          temperature: 0.2,
        });
        const content = completion.choices[0]?.message?.content ?? '';
        return res.json({ message: { role: 'assistant', content } });
      } catch (err) {
        lastErr = err;
        const isRateLimit = err?.status === 429;
        let waitSec = 0;
        if (isRateLimit) {
          const headerSec = parseInt(err?.headers?.['retry-after'], 10);
          const msg =
            err?.error?.error?.message ?? err?.error?.message ?? err?.message ?? '';
          const msgMatch = String(msg).match(/try again in (\d+)m([\d.]+)s/);
          if (Number.isFinite(headerSec)) waitSec = headerSec;
          else if (msgMatch)
            waitSec =
              parseInt(msgMatch[1], 10) * 60 +
              Math.ceil(parseFloat(msgMatch[2]) || 0);
          else waitSec = 30;
          // Cap wait so we don't block the request for minutes (client would timeout)
          const maxWaitSec = 30;
          waitSec = Math.min(waitSec, maxWaitSec);
        }
        if (isRateLimit && attempt < maxRetries && waitSec > 0) {
          console.warn(
            `Groq rate limit (429), retrying in ${waitSec}s (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          continue;
        }
        // 429 but no retry left or zero wait: return immediately so user sees error instead of hanging
        if (isRateLimit) {
          const retryAfter = parseInt(err?.headers?.['retry-after'], 10);
          const userMsg =
            lang === 'en'
              ? 'Rate limit reached. Please try again in a few minutes.'
              : lang === 'fr'
                ? 'Limite de requêtes atteinte. Réessayez dans quelques minutes.'
                : 'Rate-Limit erreicht. Bitte in einigen Minuten erneut versuchen.';
          return res.status(429).json({
            error: userMsg,
            retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
          });
        }
        throw err;
      }
    }
    throw lastErr;
  } catch (err) {
    console.error('Groq API error:', err);
    const status = err?.status ?? 500;
    const message =
      err?.message ?? err?.error?.message ?? 'Chat request failed.';
    res.status(typeof status === 'number' ? status : 500).json({
      error: message,
    });
  }
});

const preferredPort = parseInt(process.env.PORT, 10) || 3001;
const maxAttempts = 10;

function tryListen(port) {
  if (port > preferredPort + maxAttempts) {
    console.error(`Could not bind to any port between ${preferredPort} and ${preferredPort + maxAttempts}.`);
    process.exit(1);
  }
  const server = app.listen(port, () => {
    console.log(`Functiomed chatbot running at http://localhost:${port}`);
    if (!process.env.GROQ_API_KEY) {
      console.warn('Warning: GROQ_API_KEY is not set. Set it in .env to use the chatbot.');
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      tryListen(port + 1);
    } else {
      throw err;
    }
  });
}

tryListen(preferredPort);
