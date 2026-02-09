(function () {
  const translations = {
    de: {
      headerSubtitle: 'Zentrum für funktionelle Medizin',
      welcomeTitle: 'Willkommen',
      welcomeText: 'Frag uns alles zu unseren Leistungen oder buche direkt einen Termin.',
      placeholder: 'schreibe hier deine Frage.....',
      listen: 'Anhören',
      faq: [
        'Welche Leistungen bieten Sie an?',
        'Erzählen Sie mir etwas über Physiotherapie',
        'Wie buche ich einen Termin?',
        'Wie kann ich Sie kontaktieren?',
        'Wie sind Ihre Öffnungszeiten?',
        'Wer sind die Ärzte bei functiomed?',
        'Gibt es Parkmöglichkeiten bei functiomed?',
        'Welche Sprachen sprechen Sie?',
        'Brauche ich eine Überweisung?',
        'Werden die Kosten von der Krankenkasse übernommen?',
      ],
      greeting: 'Hallo! 👋 Ich bin FUNIA, deine freundliche Assistentin bei functiomed. Ich bin für dich da und beantworte Fragen zur functiomed AG. Hast du Fragen zu unseren Therapeuten, unseren Leistungen oder wie du einen Termin buchen kannst? Womit kann ich dir heute helfen?',
      errorGeneric: 'Verbindungsfehler. Bitte später erneut versuchen.',
      errorTimeout: 'Die Anfrage hat zu lange gedauert. Bitte erneut versuchen.',
      errorEmpty: 'Keine Antwort erhalten. Bitte erneut versuchen.',
    },
    en: {
      headerSubtitle: 'Center for Functional Medicine',
      welcomeTitle: 'Welcome',
      welcomeText: 'Ask us anything about our services or book an appointment directly.',
      placeholder: 'write your question here.....',
      listen: 'Listen',
      faq: [
        'What services do you offer?',
        'Tell me about physiotherapy',
        'How do I book an appointment?',
        'How can I contact you?',
        'What are your opening hours?',
        'Who are the doctors at the clinic?',
        'Is there parking available at functiomed?',
        'Which languages do you speak?',
        'Do I need a referral for an appointment?',
        'Are the costs covered by health insurance?',
      ],
      greeting: 'Hello! 👋 I am FUNIA, your friendly assistant at functiomed. I am here to support you and answer your questions about functiomed AG. Do you have questions about our therapists, our services, or how you can book an appointment? How can I help you today?',
      errorGeneric: 'Connection error. Please try again later.',
      errorTimeout: 'The request took too long. Please try again.',
      errorEmpty: 'No response received. Please try again.',
    },
    fr: {
      headerSubtitle: 'Centre de médecine fonctionnelle',
      welcomeTitle: 'Bienvenue',
      welcomeText: 'Posez-nous toutes vos questions sur nos prestations ou réservez directement un rendez-vous.',
      placeholder: 'écrivez votre question ici.....',
      listen: 'Écouter',
      faq: [
        'Quels services proposez-vous ?',
        'Parlez-moi de la physiothérapie',
        'Comment réserver un rendez-vous ?',
        'Comment vous contacter ?',
        'Quels sont vos horaires d\'ouverture ?',
        'Qui sont les médecins de la clinique ?',
        'Le parking est-il disponible chez functiomed ?',
        'Quelles langues parlez-vous ?',
        'Ai-je besoin d\'une ordonnance pour un rendez-vous ?',
        'Les coûts sont-ils couverts par l\'assurance maladie ?',
      ],
      greeting: 'Bonjour ! 👋 Je suis FUNIA, votre assistante à functiomed. Je suis là pour vous aider et répondre à vos questions sur functiomed AG. Avez-vous des questions sur nos thérapeutes, nos prestations ou la réservation d\'un rendez-vous ? Comment puis-je vous aider aujourd\'hui ?',
      errorGeneric: 'Erreur de connexion. Veuillez réessayer plus tard.',
      errorTimeout: 'La requête a pris trop de temps. Veuillez réessayer.',
      errorEmpty: 'Aucune réponse reçue. Veuillez réessayer.',
    },
  };

  const CHAT_REQUEST_TIMEOUT_MS = 90000;

  let currentLang = 'de';
  const messages = [];
  let speechSynth = null;
  let currentUtterance = null;

  const chatToggle = document.getElementById('chatToggle');
  const chatWidget = document.getElementById('chatWidget');
  const chatClose = document.getElementById('chatClose');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const typingIndicator = document.getElementById('typingIndicator');
  const errorBanner = document.getElementById('errorBanner');
  const faqSection = document.getElementById('faqSection');
  const faqContainer = document.getElementById('faqContainer');

  function t(key) {
    return (translations[currentLang] && translations[currentLang][key]) || translations.de[key];
  }

  function renderUiLanguage() {
    document.documentElement.lang = currentLang === 'de' ? 'de' : currentLang === 'fr' ? 'fr' : 'en';
    document.getElementById('headerSubtitle').textContent = t('headerSubtitle');
    document.getElementById('welcomeTitle').textContent = t('welcomeTitle');
    document.getElementById('welcomeText').textContent = t('welcomeText');
    chatInput.placeholder = t('placeholder');
    document.querySelectorAll('.language-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
    faqContainer.innerHTML = '';
    (t('faq') || []).forEach((label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'faq-button';
      b.textContent = label;
      b.addEventListener('click', () => sendMessage(label));
      faqContainer.appendChild(b);
    });
    var greetingEl = document.getElementById('greetingMessage');
    if (greetingEl) {
      var contentEl = greetingEl.querySelector('.message-content');
      if (contentEl) contentEl.textContent = t('greeting');
      greetingEl.dataset.ttsText = t('greeting');
    }
    var listenLabel = t('listen');
    document.querySelectorAll('.message.bot .speaker-button span').forEach(function (span) {
      span.textContent = listenLabel;
    });
  }

  function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function getVoiceForLang(lang) {
    if (!speechSynth) speechSynth = window.speechSynthesis;
    const voices = speechSynth.getVoices();
    const preferred = { de: 'de-', en: 'en-', fr: 'fr-' }[lang] || 'de-';
    const forLang = voices.filter((v) => v.lang.startsWith(preferred));
    const female = forLang.find(
      (v) =>
        (v.gender && v.gender === 'female') ||
        (v.name && /female|woman|samantha|anna|helena|zira|karen|victoria|moira/i.test(v.name))
    );
    return female || forLang[0] || voices.find((v) => v.lang.startsWith('de')) || voices[0];
  }

  function speakText(text, lang) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = stripHtml(text);
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : 'en-GB';
    u.rate = 0.95;
    u.pitch = 1;
    speechSynthesis.getVoices(); // trigger load
    setTimeout(() => {
      const voice = getVoiceForLang(lang);
      if (voice) u.voice = voice;
      currentUtterance = u;
      window.speechSynthesis.speak(u);
    }, 50);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    currentUtterance = null;
    document.querySelectorAll('.speaker-button.speaking').forEach((b) => b.classList.remove('speaking'));
  }

  function syncRenderMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    if (typeof marked === 'undefined') return escapeHtml(text);
    try {
      if (typeof marked.use === 'function') marked.use({ gfm: true, breaks: true });
      var out = typeof marked.parse === 'function' ? marked.parse(text) : marked(text);
      if (typeof out === 'string') return out;
      return escapeHtml(text);
    } catch (_) {
      return escapeHtml(text);
    }
  }

  function typeIntoElement(contentEl, text, delayMs) {
    delayMs = delayMs || 10;
    var chunk = text.length > 400 ? 2 : 1;
    var cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    return new Promise(function (resolve) {
      var i = 0;
      function addNext() {
        if (i >= text.length) {
          resolve();
          return;
        }
        i = Math.min(i + chunk, text.length);
        var visible = text.slice(0, i);
        contentEl.innerHTML = syncRenderMarkdown(visible);
        contentEl.appendChild(cursor);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        if (i >= text.length) {
          cursor.remove();
          resolve();
          return;
        }
        setTimeout(addNext, delayMs);
      }
      addNext();
    });
  }

  function appendMessage(role, content, options) {
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user' : 'bot'}`;
    if (options && options.id) div.id = options.id;
    const isBot = role === 'assistant' || role === 'bot';
    const html = options && options.html != null ? options.html : escapeHtml(content || '');
    div.innerHTML = '<div class="message-content">' + html + '</div>';
    if (isBot && (content || options?.raw)) {
      const raw = options?.raw || content || '';
      div.dataset.ttsText = raw;
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      const listenBtn = document.createElement('button');
      listenBtn.type = 'button';
      listenBtn.className = 'action-button speaker-button';
      listenBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg><span>' + t('listen') + '</span>';
      listenBtn.addEventListener('click', function () {
        if (this.classList.contains('speaking')) {
          stopSpeaking();
          return;
        }
        var msg = this.closest('.message');
        var textToSpeak = (msg && msg.dataset.ttsText) || raw;
        document.querySelectorAll('.speaker-button.speaking').forEach((b) => b.classList.remove('speaking'));
        this.classList.add('speaking');
        speakText(textToSpeak, currentLang);
        const onEnd = () => {
          this.classList.remove('speaking');
          if (window.speechSynthesis) window.speechSynthesis.onend = null;
        };
        if (window.speechSynthesis) window.speechSynthesis.onend = onEnd;
      });
      actions.appendChild(listenBtn);
      div.appendChild(actions);
    }
    const typing = document.getElementById('typingIndicator');
    if (typing && typing.parentNode === chatMessages) {
      chatMessages.insertBefore(div, typing);
    } else {
      chatMessages.appendChild(div);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addBotMessageActions(div, raw) {
    if (!raw) return;
    div.dataset.ttsText = raw;
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const listenBtn = document.createElement('button');
    listenBtn.type = 'button';
    listenBtn.className = 'action-button speaker-button';
    listenBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg><span>' + t('listen') + '</span>';
    listenBtn.addEventListener('click', function () {
      if (this.classList.contains('speaking')) {
        stopSpeaking();
        return;
      }
      var msg = this.closest('.message');
      var textToSpeak = (msg && msg.dataset.ttsText) || raw;
      document.querySelectorAll('.speaker-button.speaking').forEach(function (b) { b.classList.remove('speaking'); });
      this.classList.add('speaking');
      speakText(textToSpeak, currentLang);
      var onEnd = function () {
        this.classList.remove('speaking');
        if (window.speechSynthesis) window.speechSynthesis.onend = null;
      }.bind(this);
      if (window.speechSynthesis) window.speechSynthesis.onend = onEnd;
    });
    actions.appendChild(listenBtn);
    div.appendChild(actions);
  }

  async function appendMessageWithTyping(role, rawContent, options) {
    const div = document.createElement('div');
    div.className = 'message bot';
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    div.appendChild(contentEl);
    const typing = document.getElementById('typingIndicator');
    if (typing && typing.parentNode === chatMessages) {
      chatMessages.insertBefore(div, typing);
    } else {
      chatMessages.appendChild(div);
    }
    typingIndicator.classList.remove('active');
    await typeIntoElement(contentEl, rawContent, 8);
    contentEl.innerHTML = options.html != null ? options.html : escapeHtml(rawContent);
    addBotMessageActions(div, options.raw || rawContent);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function normalizeMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    let s = text.trim();
    s = s.replace(/([^\n])(##+ )/g, '$1\n\n$2');
    s = s.replace(/([^\n])(\n[-•*] )/g, '$1\n$2');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s;
  }

  async function renderMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    if (typeof marked === 'undefined') return escapeHtml(text);
    try {
      if (typeof marked.use === 'function') marked.use({ gfm: true, breaks: true });
      const out = marked.parse ? await marked.parse(text) : marked(text);
      return out || escapeHtml(text);
    } catch (_) {
      return escapeHtml(text);
    }
  }

  function getSelectedLanguage() {
    var active = document.querySelector('.language-btn.active');
    return (active && active.dataset.lang) ? active.dataset.lang : currentLang;
  }

  async function sendMessage(text) {
    const trimmed = (typeof text === 'string' ? text : chatInput.value).trim();
    if (!trimmed) return;
    chatInput.value = '';
    errorBanner.style.display = 'none';
    currentLang = getSelectedLanguage();
    appendMessage('user', trimmed);
    messages.push({ role: 'user', content: trimmed });
    typingIndicator.classList.add('active');
    sendBtn.disabled = true;

    try {
      var langToSend = getSelectedLanguage();
      if (!langToSend) langToSend = currentLang;
      var payloadMessages = messages.map(function (m, i) {
        if (i === 0 && m.role === 'assistant' && m.content && m.content.length > 200) {
          return { role: 'assistant', content: '[Greeting]' };
        }
        return { role: m.role, content: m.content };
      });
      const controller = new AbortController();
      const timeoutId = setTimeout(function () { controller.abort(); }, CHAT_REQUEST_TIMEOUT_MS);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages, language: langToSend }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      var reply = (data.message?.content ?? '').trim();
      // Convert any literal "\n" sequences from backend into real newlines
      if (reply && reply.indexOf('\\n') !== -1) {
        reply = reply.replace(/\\n/g, '\n');
      }
      if (!res.ok && data.error) {
        reply = data.error;
      }
      if (!reply) {
        reply = t('errorEmpty');
      }
      reply = normalizeMarkdown(reply);
      messages.push({ role: 'assistant', content: reply });
      const html = typeof marked !== 'undefined' ? await renderMarkdown(reply) : escapeHtml(reply);
      await appendMessageWithTyping('assistant', reply, { html, raw: reply });
    } catch (err) {
      var errMsg = err.name === 'AbortError' ? t('errorTimeout') : (err.message || t('errorGeneric'));
      errorBanner.textContent = errMsg;
      errorBanner.style.display = 'block';
      messages.push({ role: 'assistant', content: errMsg });
      appendMessage('assistant', errMsg, { html: escapeHtml(errMsg), raw: errMsg });
    } finally {
      typingIndicator.classList.remove('active');
      sendBtn.disabled = false;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  chatToggle.addEventListener('click', function () {
    chatWidget.classList.toggle('open');
    this.classList.toggle('active', chatWidget.classList.contains('open'));
    if (chatWidget.classList.contains('open')) chatInput.focus();
  });
  chatClose.addEventListener('click', () => {
    chatWidget.classList.remove('open');
    chatToggle.classList.remove('active');
    stopSpeaking();
  });

  sendBtn.addEventListener('click', () => sendMessage());
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.querySelectorAll('.language-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      currentLang = this.dataset.lang || 'de';
      renderUiLanguage();
    });
  });

  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {};
  }

  renderUiLanguage();
  appendMessage('assistant', t('greeting'), { raw: t('greeting'), id: 'greetingMessage' });
  messages.push({ role: 'assistant', content: t('greeting') });
})();
