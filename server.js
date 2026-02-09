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
const ARZTE_DEPARTMENT = 'Ärzte';
const GESCHAEFTSLEITUNG_MIT_AERZTLICHER = 'Geschäftsleitung mit ärztlicher Kompetenz';
const GESCHAEFTSLEITUNG = 'Geschäftsleitung';

function formatTeamMemberLine(m) {
  let line = `${m.name} – ${m.title || '—'}`;
  if (m.credentials) line += `. ${m.credentials}`;
  if (m.specialties?.length) line += `. Schwerpunkte: ${m.specialties.slice(0, 5).join(', ')}`;
  if (m.bio) line += `. ${m.bio}`;
  if (m.languages?.length) line += `. Sprachen: ${m.languages.slice(0, 5).join(', ')}`;
  if (line.length > MAX_TEAM_MEMBER_LINE) line = line.slice(0, MAX_TEAM_MEMBER_LINE - 1) + '…';
  return line;
}

function getTeamBlock() {
  if (!teamData?.team?.length) return '';
  const byDept = {};
  const doctorNames = new Set([
    'Dr. med. Manuel Haag',
    'Dr. med. Christoph Lienhard',
    'Dr. medic. (RO) Violeta Marinescu',
    'Praktische Ärztin Sophie Steger',
  ]);
  const managementWithMedicalName = 'Prof. Martin Spring';

  for (const m of teamData.team) {
    const d = m.department || 'Sonstige';
    const line = formatTeamMemberLine(m);

    if (d === GESCHAEFTSLEITUNG) {
      if (m.name === managementWithMedicalName) {
        if (!byDept[GESCHAEFTSLEITUNG_MIT_AERZTLICHER]) byDept[GESCHAEFTSLEITUNG_MIT_AERZTLICHER] = [];
        byDept[GESCHAEFTSLEITUNG_MIT_AERZTLICHER].push(line);
      } else {
        if (!byDept[GESCHAEFTSLEITUNG]) byDept[GESCHAEFTSLEITUNG] = [];
        byDept[GESCHAEFTSLEITUNG].push(line);
      }
      if (doctorNames.has(m.name)) {
        if (!byDept[ARZTE_DEPARTMENT]) byDept[ARZTE_DEPARTMENT] = [];
        byDept[ARZTE_DEPARTMENT].push(line);
      }
      continue;
    }
    if (doctorNames.has(m.name)) {
      if (!byDept[ARZTE_DEPARTMENT]) byDept[ARZTE_DEPARTMENT] = [];
      byDept[ARZTE_DEPARTMENT].push(line);
    }
    if (!byDept[d]) byDept[d] = [];
    byDept[d].push(line);
  }

  const osteopathieDept = 'Osteopathie │ Etiopathie';
  if (byDept[GESCHAEFTSLEITUNG_MIT_AERZTLICHER]?.length && byDept[osteopathieDept]) {
    const martinSpringLine = byDept[GESCHAEFTSLEITUNG_MIT_AERZTLICHER][0];
    byDept[osteopathieDept].unshift(martinSpringLine);
  }

  const orderFirst = [ARZTE_DEPARTMENT, GESCHAEFTSLEITUNG_MIT_AERZTLICHER, GESCHAEFTSLEITUNG];
  const restDepts = (teamData.departments || []).filter(
    (d) => !orderFirst.includes(d) && byDept[d]?.length
  );
  const deptsOrdered = [...orderFirst.filter((d) => byDept[d]?.length), ...restDepts];
  const parts = deptsOrdered.map((d) => `**${d}:**\n${(byDept[d] || []).join('\n')}`).filter(Boolean);
  const teamLinkLine =
    '\n**When the user asks about the team (e.g. who is the team / wer ist das Team):** (1) Structure your answer by departments (e.g. Ärzte/doctors, Geschäftsleitung mit ärztlicher Kompetenz/Management with medical competence, Geschäftsleitung/Management, Osteopathie, Physiotherapie, Empfang/reception, etc.). (2) Include the **Ärzte** section and **Geschäftsleitung mit ärztlicher Kompetenz** so management doctors appear in the list. (3) Mention that the team includes doctors, therapists, reception staff and other specialists. (4) Always end with a short sentence that says further information on the team can be found on the website (no separate team site): (DE) "Weitere Informationen zu unserem Team findest du auf unserer Website: https://www.functiomed.ch." / (EN) "Further information on our team can be found on our website (https://www.functiomed.ch)." / (FR) "Vous trouvez plus d\'informations sur notre équipe sur notre site web : https://www.functiomed.ch." Do NOT add this closing line when the user asks about directions, location, contact, bus, services, or appointments.\n';
  return '\n**Team (bei Fragen zu Personen oder Abteilungen nutzen; Antwort nach Abteilungen strukturieren: zuerst Ärzte, dann Geschäftsleitung mit ärztlicher Kompetenz, dann Geschäftsleitung, dann weitere Abteilungen; am Ende Team-Link):**\n' + parts.join('\n\n') + teamLinkLine;
}

const practiceName = (siteData?.title && siteData.title.split('|')[0].trim()) || 'functiomed AG';

const contactBlock =
  `Kontakt: ${siteData?.contact?.address || 'Langgrütstrasse 112, CH-8047 Zürich'}. Tel: ${siteData?.contact?.phone || '+41 (0) 44 401 15 15'}. E-Mail: ${siteData?.contact?.email || 'functiomed@hin.ch'}. ` +
  `Termin buchen: [${siteData?.home?.booking?.label || 'Termin buchen'}](${siteData?.home?.booking?.url || 'https://www.functiomed.ch/termin-buchen'}). ` +
  `Notfall: [${siteData?.notfall?.title || 'Notfall'}](${siteData?.notfall?.url || 'https://www.functiomed.ch/notfall'}). ` +
  `Öffnungszeiten Sekretariat: ${siteData?.openingHours?.secretariat || 'Mo–Do 08:30–12:00 / 13:30–16:30, Fr 08:30–12:00 / 13:30–16:00, Sa 09:00–11:00'}. ` +
  `Anreise-Hinweis: Wenn du beschreibst, wie man zur Praxis kommt, nenne ausschließlich **Bus Nr. 33** (nie Tram) und die Haltestelle **Schulhaus Altweg** als nächstgelegene Station. Sage immer „Bus Nr. 33, Haltestelle Schulhaus Altweg“, nie „Tram“ oder „Tramlinie“, und füge immer den Google‑Maps‑Link https://maps.google.com/?q=Langgrütstrasse+112,+8047+Zürich hinzu. ` +
  `**Wichtig:** Sage niemals „kontaktiere mich“ oder „contact me“ oder „feel free to contact me“; immer „kontaktiert uns“ / „contact us“ / „feel free to contact us“ (z. B. mit Telefon oder E-Mail) verwenden. Gib die Telefonnummer immer im Format +41 (0) 44 401 15 15 an (mit (0) für die Inlandswahl). **Parken:** Bei Fragen zu Parkplätzen oder Parkieren immer angeben: Es gibt Parkplätze direkt vor der Praxis sowie in der blauen Zone (Parkkarte erforderlich). Formuliere z. B. „Parking is available around the building – some spaces are our own, some are in the blue zone (parking disc required)“ (EN) bzw. sinngemäß auf Deutsch/Französisch.\n`;

const scopeLineDE = `Jede Frage bezieht sich auf ${practiceName}. Antworte nur anhand der folgenden Daten.\n`;
const scopeLineEN = `Every question refers to ${practiceName}. Answer only using the data below.\n`;
const scopeLineFR = `Chaque question concerne ${practiceName}. Réponds uniquement à l’aide des données ci-dessous.\n`;

// Formal rule: osteopathy is not covered by basic health insurance; never state that it is.
const OSTEOPATHY_INSURANCE_RULE_FR =
  " **Règle assurance / ostéopathie :** L'ostéopathie n'est pas prise en charge par l'assurance de base ; ne jamais indiquer que l'ostéopathie est couverte par l'assurance de base. Pour toute question sur l'ostéopathie et l'assurance, préciser qu'elle n'est pas incluse dans l'assurance de base ; une prise en charge peut éventuellement exister en assurance complémentaire selon le contrat.";

const TEAM_LINK_INSTRUCTION_FR =
  " Quand l'utilisateur demande qui est l'équipe : structure ta réponse par départements (p. ex. direction, médecins, ostéopathie, physiothérapie, réception), mentionne que l'équipe comprend des médecins, des thérapeutes, le personnel de réception et d'autres spécialistes, et termine toujours par une phrase du type : « Vous trouvez plus d'informations sur notre équipe sur notre site web : https://www.functiomed.ch. » Ne parle pas d'un site d'équipe séparé. N'ajoute pas cette phrase de clôture pour l'itinéraire, le contact, les prestations ou les rendez-vous. Lorsque l'utilisateur demande des renseignements sur le parking ou le stationnement, mentionne toujours : places devant le cabinet et en zone bleue (disque de stationnement requis) ; par ex. « en partie nos places, en partie zone bleue (disque requis) ».";

const TEAM_LINK_INSTRUCTION_EN =
  ' When the user asks about the team (e.g. who is the team): structure your answer by departments (e.g. Management, doctors, osteopathy, physiotherapy, reception), mention that the team includes doctors, therapists, reception staff and other specialists, and always end with a short sentence like: "Further information on our team can be found on our website (https://www.functiomed.ch)." Do not speak about a separate team site. Do NOT add this closing line for directions, contact, services, or appointments.';

const CONTACT_US_RULE_FR =
  " Ne dis jamais « contactez-moi » ou « contact me » ; dis toujours « contactez-nous » (p. ex. n'hésitez pas à nous contacter par téléphone ou e-mail).";

const PARKING_RULE_DE =
  ' Bei Fragen zu Parkplätzen oder Parkieren immer erwähnen: Parkplätze direkt vor der Praxis sowie in der blauen Zone (Parkkarte erforderlich); z. B. einige Plätze sind unsere eigenen, einige in der blauen Zone (Parkkarte erforderlich).';

const PARKING_RULE_EN =
  ' When the user asks about parking or park spaces, always state that parking is available around the building – some spaces are our own, some are in the blue zone (parking disc required); do not give a reply that only mentions parking in front of the practice without mentioning the blue zone.';

const WHEELCHAIR_ACCESSIBILITY_NOTE_DE =
  ' Bei Fragen zur Rollstuhlgängigkeit oder Barrierefreiheit: immer erwähnen, dass die Praxis rollstuhlgängig und stufenlos zugänglich ist, und immer diesen Hinweis anfügen: Es steht kein Invaliden-WC zur Verfügung.';
const WHEELCHAIR_ACCESSIBILITY_NOTE_EN =
  ' When the user asks about wheelchair accessibility or whether the practice/clinic is accessible: always state that the practice is wheelchair accessible and step-free, and always add this note: There is no dedicated accessible toilet (disabled WC) available.';
const WHEELCHAIR_ACCESSIBILITY_NOTE_FR =
  " Lorsque l'utilisateur demande si le cabinet est accessible en fauteuil roulant ou sans barrières : indique toujours que le cabinet est accessible en fauteuil roulant et sans marches, et ajoute toujours cette remarque : il n'y a pas de toilettes adaptées aux personnes en situation de handicap.";

const FUNCTIOMED_CASE_RULE_DE =
  ' Schreibe den Namen der Praxis immer als functiomed (mit kleinem f), nie Functiomed oder FUNCTIOMED.';
const FUNCTIOMED_CASE_RULE_EN =
  ' Always write the name of the clinic as functiomed (lowercase f), never Functiomed or FUNCTIOMED.';
const FUNCTIOMED_CASE_RULE_FR =
  " Écris toujours le nom du centre comme functiomed (f minuscule), jamais Functiomed ou FUNCTIOMED.";

const ENGLISH_NO_GERMAN_RULE =
  ' Your reply must be in English only. Do not use any German words or phrases. If the data contains German terms (e.g. Geschäftsleitung, Öffnungszeiten, Termin, Sekretariat, Physiotherapie, Osteopathie, Empfang), always use the English equivalent (Management, opening hours, appointment, reception, physiotherapy, osteopathy, reception). Never copy German headings or labels into your answer.';

const WHY_FUNCTIOMED_DIFFERENT_DE =
  ' Wenn der Nutzer fragt, was functiomed von anderen unterscheidet, warum functiomed wählen, was uns besonders macht oder ähnlich: Antworte im Stil der folgenden Struktur. (1) Konsequent interdisziplinäre Struktur und Breite des medizinischen Angebots. (2) functiomed AG als eines der grössten interdisziplinären Gesundheitszentren der Schweiz, über 50 Fachpersonen aus Medizin, Therapie und Training – nenne die Bereiche: Orthopädie & Traumatologie, Rheumatologie, Sportmedizin, Physiotherapie, Osteopathie, Ergotherapie, Akupunktur, Homöopathie, Orthopädietechnik, medizinische Massagen, integrative Medizin, Ernährungsberatung, Mental Coaching, functioTraining / MTT. (3) Ganzheitliche Abklärung und gezielte Behandlung ohne unnötige Schnittstellen oder externe Überweisungen; Diagnostik, Therapie und Training greifen ineinander. (4) Moderne Infrastruktur: Röntgen, Ultraschall, C-Bogen, Labor, Stosswellentherapie; enge fachliche Abstimmung im Team. (5) Klare Zuständigkeiten, kurze Entscheidungswege, individuell abgestimmte Behandlungspläne; medizinisch sinnvolle, evidenzbasierte Lösungen. Ziel: hochwertige, nachhaltige Versorgung für Gesundheit, Belastbarkeit und Leistungsfähigkeit.';
const WHY_FUNCTIOMED_DIFFERENT_EN =
  ' When the user asks what makes functiomed different from other health centers, why choose functiomed, what is special about functiomed or similar: draft your answer in this style. Start with: what makes functiomed different is our consistently interdisciplinary structure and the breadth of our medical offering. Then: functiomed AG is one of the largest interdisciplinary health centers in Switzerland; more than 50 specialists from medicine, therapy and training work closely together – including orthopedics & traumatology, rheumatology, sports medicine, physiotherapy, osteopathy, occupational therapy, acupuncture, homeopathy, orthopedic technology, medical massage, integrative medicine, nutritional counseling, mental coaching and functioTraining / MTT. Then: this diversity allows us to assess and treat complaints holistically and in a targeted way, without unnecessary interfaces or external referrals; diagnostics, therapy and training are directly interconnected. Then: we use modern infrastructure such as X-ray, ultrasound, C-arm, laboratory diagnostics and shockwave therapy; the decisive factor is not just the technology but the close professional coordination within the team. Then: patients benefit from clear responsibilities, short decision paths and individually tailored treatment plans – no standard program, but medically meaningful, evidence-based and transparent solutions. End with: our goal is high-quality, sustainable medical care that improves health, resilience and performance in the long term.';
const WHY_FUNCTIOMED_DIFFERENT_FR =
  " Lorsque l'utilisateur demande ce qui distingue functiomed des autres centres, pourquoi choisir functiomed, ce qui est spécial chez functiomed ou similaire : rédige ta réponse selon cette structure. (1) Structure résolument interdisciplinaire et étendue de l'offre médicale. (2) functiomed AG parmi les plus grands centres de santé interdisciplinaires de Suisse, plus de 50 professionnels en médecine, thérapie et entraînement – cite les domaines : orthopédie & traumatologie, rhumatologie, médecine du sport, physiothérapie, ostéopathie, ergothérapie, acupuncture, homéopathie, technique orthopédique, massages médicaux, médecine intégrative, conseil nutritionnel, coaching mental, functioTraining / MTT. (3) Évaluation et traitement globaux et ciblés, sans interfaces inutiles ni renvois externes ; diagnostic, thérapie et entraînement sont reliés. (4) Infrastructure moderne : radiologie, échographie, arceau C, laboratoire, thérapie par ondes de choc ; coordination étroite au sein de l'équipe. (5) Responsabilités claires, voies de décision courtes, plans de traitement individualisés ; solutions médicalement pertinentes et fondées sur les preuves. Objectif : soins médicaux de haute qualité et durables pour la santé, la résistance et les performances.";

const SYSTEM_PROMPT_DE =
  'Du bist FUNIA, die freundliche Assistentin der functiomed AG. Du sprichst mit Menschen in der Schweiz. Dein Ton ist stets **einfühlsam und sehr weich**: warm, verständnisvoll und behutsam; vermeide harte oder rein sachliche Formulierungen. Antworte ausschließlich auf Deutsch, kurz, freundlich und prägnant. Gib immer eine vollständige Antwort (kein Abbruch mitten im Satz oder in der Aufzählung). Nutze die folgenden Daten. Formatiere mit **Fett**, ## Überschriften und Aufzählungen. Setze Links nur wenn passend. Wenn der Nutzer nach Anreise, Wegbeschreibung oder wie er zur Praxis kommen kann fragt, erwähne immer ausdrücklich, dass man uns mit **Bus Nr. 33, Haltestelle Schulhaus Altweg** erreicht (sage nie Tram oder Tramlinie, immer Bus Nr. 33, Haltestelle Schulhaus Altweg) **und füge immer den Google-Maps-Link https://maps.google.com/?q=Langgrütstrasse+112,+8047+Zürich hinzu**; nenne kein anderes öffentliches Verkehrsmittel. Wenn der Nutzer nach Kostenübernahme oder Versicherung (Grundversicherung, Zusatzversicherung, Unfallversicherung usw.) fragt, gib eine **ausführliche, aber präzise** Antwort: erkläre, welche Leistungen in der Regel gedeckt sind, was häufig nicht vollständig gedeckt ist, welche Rolle individuelle Verträge spielen und dass sich Bedingungen ändern können. **Wichtig:** Osteopathie ist keine Leistung der Grundversicherung; sage niemals, dass Osteopathie von der Grundversicherung übernommen wird. Bei Fragen zu Osteopathie und Versicherung stets klarstellen: keine Grundversicherung, allenfalls Zusatzversicherung je nach Vertrag. Ermutige immer dazu, die eigene Versicherung vorab direkt zu kontaktieren, und gib keine konkreten Zusagen, die nicht explizit in den Daten stehen. Wenn der Nutzer fragt, welche Sprachen gesprochen werden, antworte immer, dass wir **Deutsch** und **Englisch** sprechen und füge hinzu, dass wir bei Bedarf gerne prüfen, ob Unterstützung in einer anderen Sprache möglich ist. Sage niemals kontaktiere mich oder contact me; immer kontaktiert uns bzw. kontaktieren Sie uns (z. B. mit Telefon oder E-Mail). Nur wenn der Nutzer nach dem Team fragt (z. B. wer ist das Team): Strukturiere die Antwort nach Abteilungen (z. B. Geschäftsleitung, Ärzte, Osteopathie, Physiotherapie, Empfang), erwähne dass das Team Ärztinnen und Ärzte, Therapeutinnen und Therapeuten, Empfang und weitere Fachpersonen umfasst, und schliesse immer mit einem Satz im Stil von: Weitere Informationen zu unserem Team findest du auf unserer Website: https://www.functiomed.ch. Bei allen anderen Fragen (Anreise, Kontakt, Bus, Leistungen, Termine) diese Abschlussformulierung nicht verwenden.' +
  PARKING_RULE_DE + '\n' + WHEELCHAIR_ACCESSIBILITY_NOTE_DE + '\n' + WHY_FUNCTIOMED_DIFFERENT_DE + '\n' + FUNCTIOMED_CASE_RULE_DE + '\n' +
  scopeLineDE +
  contactBlock +
  getServicesBlock() +
  getTeamBlock() +
  getShopBlock() +
  getClientDocsExcerpt();

const SYSTEM_PROMPT_EN =
  'You are FUNIA, the friendly assistant of functiomed AG. You are talking to people in Switzerland. Your tone is always empathetic and very soft: warm, understanding and gentle; avoid harsh or purely factual phrasing. Answer only in British English (use British spelling and usage: e.g. colour, centre, organisation, favour, practise for verb, towards, whilst, specialised instead of specialized, -ise endings like organise/recognise/realise, -our endings like behaviour/honour/labour, -re endings like theatre/metre/litre). Whenever you mention this therapy, spell it exactly as Accupunture (with double c), never Acupuncture or Acupunture. Answer briefly and in a friendly way. Always give a complete answer (do not cut off mid-sentence or mid-list). Use the data below. Format with bold, headings and lists. Add links only when relevant. When the user asks how to get to the clinic, how to reach you, or for directions or location, always explicitly mention that the clinic is reachable by bus no. 33, stop Schulhaus Altweg, **and always include the Google Maps link https://maps.google.com/?q=Langgrütstrasse+112,+8047+Zürich**; do not mention any other public transport lines. When the user asks about insurance or cost coverage (e.g. basic insurance, supplementary insurance, accident insurance), give a detailed but precise answer: explain what is typically covered, what may not be fully covered, how much depends on the individual contract, and that conditions can change. **Important:** Osteopathy is not covered by basic health insurance; you must never state that osteopathy is covered by basic health insurance. For questions about osteopathy and insurance, always state clearly that it is not included in basic insurance; coverage may be available under supplementary insurance depending on the individual policy. Always recommend that the user confirm details directly with their insurer and never invent specific reimbursement percentages or guarantees that are not in the data. When you close an answer and a follow-up contact is helpful, add a short sentence inviting the user to contact the clinic using the phone number, e-mail address and practice address given in the contact data. Never write contact me or feel free to contact me; always write contact us or feel free to contact us (e.g. feel free to contact us at the number or e-mail above). When the user asks which languages are spoken, always answer that we speak German and English, and add that if they need assistance in another language, they should let us know so we can see what is possible. When the user asks about the team (e.g. who is the team): structure your answer by departments (Management, doctors, osteopathy, physiotherapy, reception, etc.), mention that the team includes doctors, therapists, reception and other specialists, and always end with the team link https://www.functiomed.ch/team. Do not add the team link for directions, contact, services, or appointments.' +
  PARKING_RULE_EN + TEAM_LINK_INSTRUCTION_EN + '\n' + WHEELCHAIR_ACCESSIBILITY_NOTE_EN + '\n' + FUNCTIOMED_CASE_RULE_EN + '\n' + ENGLISH_NO_GERMAN_RULE + '\n' +
  scopeLineEN +
  contactBlock +
  getServicesBlock() +
  getTeamBlock() +
  getShopBlock() +
  getClientDocsExcerpt();

const SYSTEM_PROMPT_FR =
  'Tu es FUNIA, l’assistante de functiomed AG. Tu t\'adresses à des personnes en Suisse. Ton ton est toujours **empathique et très doux** : chaleureux, bienveillant et délicat ; évite les formulations dures ou purement factuelles. Réponds uniquement en français, de façon brève et amicale. Donne toujours une réponse complète (sans couper en milieu de phrase ou de liste). Utilise les données ci-dessous. Formate avec **gras**, ## titres et listes. Mets des liens seulement si pertinent. Lorsque l’utilisateur demande comment venir à la clinique, comment vous rejoindre ou pour un itinéraire/localisation, mentionne toujours explicitement que la clinique est accessible en **bus no 33**, arrêt Schulhaus Altweg (ne dis jamais « tram », toujours « bus no 33 ») **et indique toujours le lien Google Maps https://maps.google.com/?q=Langgrütstrasse+112,+8047+Zürich** ; ne cite aucune autre ligne de transport public. Lorsque l’utilisateur pose des questions sur l’assurance ou la prise en charge des coûts (p. ex. assurance de base, complémentaire, assurance accident), donne une réponse **détaillée mais précise** : explique ce qui est en général couvert, ce qui peut ne pas l’être entièrement, ce qui dépend du contrat individuel et le fait que les conditions peuvent évoluer. ' + OSTEOPATHY_INSURANCE_RULE_FR + ' Recommande toujours de vérifier les détails directement auprès de l’assureur et ne promets jamais de pourcentages de remboursement ou de garanties qui ne figurent pas explicitement dans les données. Lorsque l’utilisateur demande quelles langues sont parlées, réponds toujours que nous parlons **allemand** et **anglais**, et ajoute que si une autre langue est nécessaire, il suffit de nous le signaler afin que nous puissions voir ce qui est possible.' +   CONTACT_US_RULE_FR + TEAM_LINK_INSTRUCTION_FR + '\n' + WHEELCHAIR_ACCESSIBILITY_NOTE_FR + '\n' + WHY_FUNCTIOMED_DIFFERENT_FR + '\n' +
  CONTACT_US_RULE_FR + TEAM_LINK_INSTRUCTION_FR + '\n' + WHEELCHAIR_ACCESSIBILITY_NOTE_FR + '\n' + WHY_FUNCTIOMED_DIFFERENT_FR + '\n' + FUNCTIOMED_CASE_RULE_FR + '\n' +
  scopeLineFR +
  contactBlock +
  getServicesBlock() +
  getTeamBlock() +
  getShopBlock() +
  getClientDocsExcerpt();

const LANGUAGE_INSTRUCTION = {
  de: 'Antworte ausschließlich auf Deutsch.',
  en: 'Answer only in British English (British spelling and usage). Do not use any German words; use English only.',
  fr: 'Réponds uniquement en français.',
};

const LANGUAGE_LAST_USER_HINT = {
  de: 'Nutzer fragt (auf Deutsch beantworten):',
  en: 'User asks (answer in British English):',
  fr: 'L’utilisateur demande (répondre en français):',
};

const OLLAMA_SYSTEM_LANG = {
  de: 'Antworte ausschließlich auf Deutsch. Jedes Wort auf Deutsch. Bei Kontext in anderer Sprache: ins Deutsche übersetzen.',
  en: 'CRITICAL: Your entire response must be in British English only. Use British spelling and usage at all times (e.g. colour, centre, organisation, behaviour, theatre, practise as verb, -ise endings). Never use American spelling. Never use any German words or phrases; use only English. Always translate German terms to English: Geschäftsleitung→Management, Schwerpunkte→specialties, Öffnungszeiten→opening hours, Sekretariat→reception, Termin→appointment, Physiotherapie→physiotherapy, Osteopathie→osteopathy, Empfang→reception, Mitglied→member, Fachärztin→specialist physician, Innere Medizin→Internal Medicine, Inhaber→owner. Do not copy German headings or labels; use English equivalents. Give complete sentences; do not cut off mid-sentence.',
  fr: 'Réponds uniquement en français. Chaque mot en français. Si le contexte est dans une autre langue, traduis en français.',
};

const OLLAMA_QUESTION_LANG = {
  de: 'Frage',
  en: 'Question',
  fr: 'Question',
};

const OLLAMA_END_LANG = {
  de: '\n\n[Response language: German only.]',
  en: '\n\n[Response language: British English only. Use British spelling. Do not use any German words; translate all German terms to English. Complete your answer; do not truncate.]',
  fr: '\n\n[Response language: French only.]',
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

const ERROR_EMPTY_RESPONSE = {
  de: 'Die Anfrage konnte nicht beantwortet werden. Bitte versuchen Sie es in Kürze erneut.',
  en: 'The request could not be answered. Please try again in a moment.',
  fr: 'La requête n’a pas pu être traitée. Veuillez réessayer dans un instant.',
};

function normalizeForFaq(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\wäöüßéèêëàâùûîïç\s]/g, '')
    .trim();
}

function isWheelchairAccessibilityQuestion(text) {
  const t = (text || '').toLowerCase();
  return /\brollstuhl|barrierefrei|wheelchair|fauteuil\s*roulant|accessible\s*(en\s*fauteuil|for\s*wheelchair|aux?\s*fauteuils)?|invaliden\s*wc|disabled\s*wc|toilette?\s*handicap/i.test(t);
}

function getWheelchairAccessAnswer(lang) {
  const section = faqsData?.wheelchair_access;
  if (!section?.answer) return null;
  const langKey = lang === 'en' ? 'EN' : lang === 'fr' ? 'FR' : 'DE';
  return section.answer[langKey] || null;
}

function isWhyFunctiomedDifferentQuestion(text) {
  const t = (text || '').toLowerCase();
  return /\bdistinguishes?\b.*(functiomed|you|us|other\s+health)\b|\b(functiomed|you|us)\b.*\bdistinguishes?\b|distinguishes?.*from\s+other\s+health|what\s+makes\s+(you|functiomed)\s+different|different\s+from\s+other\s+health|why\s+choose\s+functiomed|what('s|\s+is)\s+special\s+about\s+functiomed|what\s+sets\s+functiomed\s+apart|was\s+unterscheidet|was\s+macht\s+(euch|functiomed)\s+anders|wodurch\s+unterscheidet|warum\s+functiomed|en\s+quoi.*différent|qu'est-ce\s+qui\s+distingue|pourquoi\s+(choisir\s+)?functiomed/i.test(t);
}

function getWhatMakesYouDifferentAnswer(lang) {
  const section = faqsData?.what_makes_you_different;
  if (!section?.answer) return null;
  const langKey = lang === 'en' ? 'EN' : lang === 'fr' ? 'FR' : 'DE';
  return section.answer[langKey] || null;
}

function isAppointmentRescheduleCancelQuestion(text) {
  const t = (text || '').toLowerCase();
  return /\b(reschedule|cancel|change|shift|move|postpone)\b.*\b(appointment|termin|rendez-vous|booking)\b|\b(appointment|termin|rendez-vous|booking)\b.*\b(reschedule|cancel|change|shift|move|postpone)\b|verschieben|absagen|verschieben.*termin|termin.*absagen|reporter|annuler|annuler.*rendez-vous|rendez-vous.*annuler/i.test(t);
}

function getAppointmentChangeAnswer(lang) {
  const section = faqsData?.appointment_change;
  if (!section?.answer) return null;
  const langKey = lang === 'en' ? 'EN' : lang === 'fr' ? 'FR' : 'DE';
  return section.answer[langKey] || null;
}

function findFaqAnswer(userContent, lang) {
  const langKey = lang === 'en' ? 'EN' : lang === 'fr' ? 'FR' : 'DE';
  const normalized = normalizeForFaq(userContent);
  if (!normalized) return null;
  for (const section of Object.values(faqsData)) {
    if (!section?.questions?.[langKey] || !section?.answer?.[langKey]) continue;
    for (const q of section.questions[langKey]) {
      const qNorm = normalizeForFaq(q);
      if (qNorm === normalized || qNorm.includes(normalized)) return section.answer[langKey];
      if (normalized.includes(qNorm)) {
        const asWord = new RegExp('\\b' + qNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (asWord.test(normalized)) return section.answer[langKey];
      }
    }
  }
  return null;
}

function isPaymentOrBankTransferQuestion(text) {
  const t = (text || '').toLowerCase();
  return /\bbank\b|\btransfer\b|überweisung|zahlung|payment|invoice|rechnung|how to pay|wie (kann ich )?zahlen|pay\s+(for|required)|invoice|facture/.test(t);
}

function isShopOrBooksQuestion(text) {
  const t = (text || '').toLowerCase();
  if (isPaymentOrBankTransferQuestion(t)) return false;
  return /\bshop\b|bücher|books|livres|kaufen|kauf|bestellen|preis.*buch|buch.*preis|\b(book|books)\s+(order|bestellen|kaufen)|order\s+(book|books)/.test(t);
}

function isFunctioTrainingSubscriptionQuestion(text) {
  const t = (text || '').toLowerCase();
  const isTraining = /functiotraining|functio-training|functio training|training\s*abo/.test(t);
  const isSubscription =
    /abo|abonnement|subscription|paket|package|preis|price|tarif|tarife|cost|kosten|preise|prices|tarife|kostet|kostenpflichtig|gebühr(en)?/.test(
      t
    );
  return isTraining && isSubscription;
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
  if (process.env.USE_OLLAMA_ONLY === '1' || process.env.USE_OLLAMA_ONLY === 'true') return null;
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const OLLAMA_TIMEOUT_MS = 90000;
const OLLAMA_TRANSLATE_TIMEOUT_MS = 45000;
const OLLAMA_MAX_CONTEXT_CHARS = 22000;
const OLLAMA_MAX_TRANSLATE_CHARS = 4000;

function normalizeEszett(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\u00DF/g, 'ss'); // ß -> ss
}

function stripLeadingHeading(content) {
  if (!content || typeof content !== 'string') return content;
  const lines = content.split(/\n/);
  while (lines.length > 0) {
    const line = lines[0].trim();
    const looksLikeHeading =
      line.length > 0 &&
      line.length < 70 &&
      (/\s\/\s/.test(line) || /^[\w\s&'-]+$/.test(line) && !/[.!?]$/.test(line)) &&
      (line.split(/\s+/).length <= 6 || /\s\/\s/.test(line));
    if (!looksLikeHeading) break;
    lines.shift();
    if (lines.length > 0 && lines[0].trim() === '') lines.shift();
  }
  return lines.join('\n').trim() || content;
}

function normalizeDashes(text) {
  if (typeof text !== 'string') return text;
  const lines = text.split(/\r?\n/).map((line) => {
    let prefix = '';
    let rest = line;
    const m = line.match(/^(\s*[-•]\s+)/);
    if (m) {
      prefix = m[1];
      rest = line.slice(prefix.length);
    }
    // Remove en/em dashes and spaced hyphens inside sentences
    rest = rest.replace(/[–—]/g, ' ');
    rest = rest.replace(/\s-\s/g, ' ');
    rest = rest.replace(/\s{2,}/g, ' ');
    return prefix + rest;
  });
  return lines.join('\n');
}

async function translateWithOllama(text, targetLang) {
  if (!text || !OLLAMA_BASE_URL || targetLang === 'de') return text;
  const toTranslate = text.length > OLLAMA_MAX_TRANSLATE_CHARS ? text.slice(0, OLLAMA_MAX_TRANSLATE_CHARS) + '…' : text;
  const prompt = targetLang === 'fr'
    ? 'Translate the following text to French. Preserve meaning, structure and formatting. Output only the translation, no explanation.\n\n'
    : 'Translate the following text to British English. Use British spelling and usage (e.g. colour, centre, organisation, behaviour, theatre, -ise endings). Do not leave any German words; translate every German term to English (e.g. Geschäftsleitung→Management, Öffnungszeiten→opening hours, Termin→appointment, Sekretariat→reception). Preserve meaning, structure and formatting. Output only the translation, no explanation.\n\n';
  const url = `${OLLAMA_BASE_URL}/api/chat`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TRANSLATE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt + toTranslate }],
        stream: false,
        options: { num_predict: 1024, temperature: 0.1, num_ctx: 8192 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return text;
    const data = await res.json();
    const translated = normalizeEszett((data?.message?.content ?? '').trim());
    return translated || text;
  } catch (_) {
    clearTimeout(timeoutId);
    return text;
  }
}

function buildOllamaMessages(messages, lang) {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const userParts = messages.filter((m) => m.role === 'user').map((m) => m.content);
  if (systemParts.length > 0 && userParts.length > 0) {
    const question = userParts.join('\n').trim();
    let context = systemParts.join('\n\n');
    if (context.length > OLLAMA_MAX_CONTEXT_CHARS) {
      context = context.slice(0, OLLAMA_MAX_CONTEXT_CHARS) + '\n\n[Further context omitted for faster response.]';
    }
    const langKey = (lang && (lang === 'en' || lang === 'fr')) ? lang : 'de';
    const questionLabel = OLLAMA_QUESTION_LANG[langKey] || OLLAMA_QUESTION_LANG.en;
    const endLang = OLLAMA_END_LANG[langKey] || OLLAMA_END_LANG.en;
    const langFirst = (lang && LANGUAGE_INSTRUCTION[lang]) ? LANGUAGE_INSTRUCTION[lang] : LANGUAGE_INSTRUCTION.en;
    const instructionShort =
      'Using ONLY the context above, answer the question below. Match the question to the right section (Team = people/roles/departments; Contact = address/phone/hours/booking; Services/shop/documents = offerings). Do not invent or assume anything not stated in the context. Do not start your answer with a heading or category line (e.g. "Services / Shop", "Team", "Documents"). Answer directly in a natural, flowing way. If the answer is in the context, give it directly; if not, say you do not have that information.';
    const combined =
      langFirst + '\n\n---\nContext (use this in full; do not hallucinate):\n' + context + '\n\n---\n' + instructionShort + '\n\n' + questionLabel + ': ' + question + endLang;
    const langSystem = (lang && OLLAMA_SYSTEM_LANG[lang]) ? OLLAMA_SYSTEM_LANG[lang] : OLLAMA_SYSTEM_LANG.en;
    return [
      { role: 'system', content: langSystem },
      { role: 'user', content: combined },
    ];
  }
  return messages;
}

async function callOllamaChat(messages, lang) {
  const ollamaMessages = buildOllamaMessages(messages, lang);
  const url = `${OLLAMA_BASE_URL}/api/chat`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
        options: {
          num_predict: 1024,
          temperature: 0.2,
          num_ctx: 8192,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = new Error(`Ollama ${res.status}: ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return data?.message?.content ?? '';
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`Ollama request timed out (${OLLAMA_TIMEOUT_MS / 1000}s). Is Ollama running?`);
    throw err;
  }
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

  console.log('[chat] query:', lastContent.slice(0, 80) + (lastContent.length > 80 ? '...' : ''));

  const isGreeting = GREETING_PATTERNS.some((re) => re.test(lastContent.trim()));
  if (isGreeting) {
    const g = normalizeEszett(GREETING_RESPONSES[lang]);
    console.log('[chat] response: greeting (direct)');
    return res.json({ message: { role: 'assistant', content: g } });
  }

  // Wheelchair/accessibility: always return FAQ answer so the "no accessible toilet" note is never missed
  if (isWheelchairAccessibilityQuestion(lastContent)) {
    const wheelchairAnswer = getWheelchairAccessAnswer(lang);
    if (wheelchairAnswer) {
      console.log('[chat] response: wheelchair FAQ (direct)');
      return res.json({ message: { role: 'assistant', content: normalizeEszett(wheelchairAnswer) } });
    }
  }

  // "What distinguishes functiomed / why different / what's special": always return full detailed FAQ answer
  if (isWhyFunctiomedDifferentQuestion(lastContent)) {
    const differentAnswer = getWhatMakesYouDifferentAnswer(lang);
    if (differentAnswer) {
      console.log('[chat] response: what-makes-different FAQ (direct)');
      return res.json({ message: { role: 'assistant', content: normalizeDashes(normalizeEszett(differentAnswer)) } });
    }
  }

  // Reschedule / cancel appointment: return appointment_change FAQ (avoid matching "hours" via "schedule" in "reschedule")
  if (isAppointmentRescheduleCancelQuestion(lastContent)) {
    const appointmentChangeAnswer = getAppointmentChangeAnswer(lang);
    if (appointmentChangeAnswer) {
      console.log('[chat] response: appointment-change FAQ (direct)');
      return res.json({ message: { role: 'assistant', content: normalizeDashes(normalizeEszett(appointmentChangeAnswer)) } });
    }
  }

  const faqAnswer = findFaqAnswer(lastContent, lang);
  if (faqAnswer != null) {
    const a = normalizeDashes(normalizeEszett(faqAnswer));
    console.log('[chat] response: FAQ (direct)');
    return res.json({ message: { role: 'assistant', content: a } });
  }

  if (isShopOrBooksQuestion(lastContent)) {
    const shopAnswer = getShopBooksAnswer(lang);
    if (shopAnswer != null) {
      const s = normalizeDashes(normalizeEszett(shopAnswer));
      console.log('[chat] response: shop (direct)');
      return res.json({ message: { role: 'assistant', content: s } });
    }
  }

  const langInstruction = LANGUAGE_INSTRUCTION[lang];
  const systemPromptByLang = {
    de: SYSTEM_PROMPT_DE,
    en: SYSTEM_PROMPT_EN,
    fr: SYSTEM_PROMPT_FR,
  };
  const systemPrompt = systemPromptByLang[lang] || SYSTEM_PROMPT_DE;
  const trainingAbosIfRelevant = isFunctioTrainingSubscriptionQuestion(lastContent) ? getTrainingAbosBlock() : '';
  const systemContent = langInstruction + '\n' + systemPrompt + trainingAbosIfRelevant;
  const lastUserHint = LANGUAGE_LAST_USER_HINT[lang];
  const chatMessages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: lastUserHint + '\n\n' + lastContent },
  ];
  // Same system prompt and data for both Groq and Ollama (chatMessages passed to each)
  // Local: set USE_OLLAMA_ONLY=1 in .env to test Ollama instead of Groq

  const groq = getGroqClient();
  const useOllamaAsFallback = !!OLLAMA_BASE_URL;

  let lastOllamaError = null;
  async function tryOllama() {
    try {
      let content = (await callOllamaChat(chatMessages, lang) || '').trim();
      if (content) {
        if (lang === 'en' || lang === 'fr') {
          const translated = await translateWithOllama(content, lang);
          if (translated) content = translated;
        }
        content = normalizeDashes(normalizeEszett(stripLeadingHeading(content)));
        console.log('[chat] response: Ollama');
        return res.json({ message: { role: 'assistant', content } });
      }
    } catch (ollamaErr) {
      lastOllamaError = ollamaErr?.message || String(ollamaErr);
      console.warn('Ollama fallback failed:', lastOllamaError);
    }
    return null;
  }

  function sendEmptyResponseError() {
    return res.status(503).json({
      error: ERROR_EMPTY_RESPONSE[lang] || ERROR_EMPTY_RESPONSE.en,
    });
  }

  if (!groq) {
    const fallback = await tryOllama();
    if (fallback) return fallback;
    console.log('[chat] response: error (no Groq, Ollama failed or unavailable)');
    const ollamaHint = lastOllamaError
      ? ` Ollama failed: ${lastOllamaError}. `
      : ' ';
    return res.status(500).json({
      error: 'No API key set and Ollama is not answering.' + ollamaHint + 'Start Ollama with: ollama run ' + OLLAMA_MODEL + ' (or add GROQ_API_KEY to .env).',
    });
  }

  // Hybrid: try models in order; when one hits 429, instantly try the next (no wait)
  const groqModels = process.env.GROQ_CHAT_MODELS
    ? process.env.GROQ_CHAT_MODELS.split(',').map((m) => m.trim()).filter(Boolean)
    : [
        'moonshotai/kimi-k2-instruct',           // 60 RPM
        'meta-llama/llama-4-scout-17b-16e-instruct', // 30 RPM, 30K TPM
        'llama-3.1-8b-instant',                 // 30 RPM, 14.4K RPD
      ];

  try {
    let lastErr;
    for (let modelIndex = 0; modelIndex < groqModels.length; modelIndex++) {
      const model = groqModels[modelIndex];
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: chatMessages,
          max_tokens: 1024,
          temperature: 0.2,
        });
        let content = (completion.choices[0]?.message?.content ?? '').trim();
        if (content) {
          content = normalizeDashes(normalizeEszett(stripLeadingHeading(content)));
          console.log('[chat] response: Groq', model);
          return res.json({ message: { role: 'assistant', content } });
        }
        if (useOllamaAsFallback) {
          const fallback = await tryOllama();
          if (fallback) return fallback;
        }
        console.log('[chat] response: empty (503)');
        return sendEmptyResponseError();
      } catch (err) {
        lastErr = err;
        const isRateLimit = err?.status === 429;
        if (isRateLimit && modelIndex < groqModels.length - 1) {
          console.warn(
            `[chat] Groq 429 on ${model}, trying next model: ${groqModels[modelIndex + 1]}`
          );
          continue;
        }
        if (isRateLimit) {
          if (useOllamaAsFallback) {
            const fallback = await tryOllama();
            if (fallback) return fallback;
          }
          const retryAfter = parseInt(err?.headers?.['retry-after'], 10);
          const userMsg =
            lang === 'en'
              ? 'Rate limit reached. Please try again in a few minutes.'
              : lang === 'fr'
                ? 'Limite de requêtes atteinte. Réessayez dans quelques minutes.'
                : 'Rate-Limit erreicht. Bitte in einigen Minuten erneut versuchen.';
          console.log('[chat] response: rate limit (429) all models exhausted');
          return res.status(429).json({
            error: userMsg,
            retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
          });
        }
        if (modelIndex < groqModels.length - 1) {
          console.warn(
            `[chat] Groq error on ${model}:`, err?.message || err,
            '; trying next model.'
          );
          continue;
        }
        if (useOllamaAsFallback) {
          console.warn('[chat] Groq failed, trying Ollama fallback:', err?.message || err);
          const fallback = await tryOllama();
          if (fallback) return fallback;
        }
        throw err;
      }
    }
    throw lastErr;
  } catch (err) {
    if (useOllamaAsFallback) {
      const fallback = await tryOllama();
      if (fallback) return fallback;
    }
    console.log('[chat] response: error (Groq/Ollama failed)');
    console.error('[chat] Groq API error:', err);
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
      console.warn('Warning: GROQ_API_KEY is not set. Set it in .env or run Ollama locally (ollama run llama3.2) as fallback.');
    }
    if (OLLAMA_BASE_URL) {
      console.log(`Ollama fallback: ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
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
