# Functiomed Chatbot

A small chatbot for **functiomed AG** (Zentrum für funktionelle Medizin, Zürich) that answers questions about treatments, opening hours, and contact using the [Groq API](https://console.groq.com/).

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Groq API key**
   - Get an API key at [console.groq.com](https://console.groq.com/).
   - Copy `.env.example` to `.env` and set your key:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and set `GROQ_API_KEY=your_key_here`.

3. **Run the server**
   ```bash
   npm start
   ```
   Or with auto-restart during development:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3001](http://localhost:3001) in your browser.

## Data

- **`data/services.json`** – Practice info and treatments (from [functiomed.ch/angebot](https://www.functiomed.ch/angebot)).
- **`data/team.json`** – Team by department ([functiomed.ch/team](https://www.functiomed.ch/team)).
- **`data/site.json`** – Homepage, notfall, navigation ([functiomed.ch](https://www.functiomed.ch)).
- **`data/tarife.json`** – Tariffs and insurance ([functiomed.ch/tarife](https://www.functiomed.ch/tarife)).
- **`data/sitemap.json`** – All site URLs from [functiomed.ch/sitemap.xml](https://www.functiomed.ch/sitemap.xml). To refresh: download the sitemap to `data/sitemap_raw.xml`, then run `node scripts/parse-sitemap.js`.

## Tech

- **Backend:** Node.js, Express, [groq-sdk](https://www.npmjs.com/package/groq-sdk)
- **Model:** `llama-3.1-8b-instant` (Groq)
- **Frontend:** Plain HTML/CSS/JS chat UI
