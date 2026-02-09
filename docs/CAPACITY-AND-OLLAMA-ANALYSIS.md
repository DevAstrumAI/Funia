# Capacity & Ollama Fallback Analysis

Analysis of **queries per minute (QPM)** the current setup can handle and **when Ollama is used**.

---

## 1. Current request flow (summary)

```
Request → [Greeting? → direct] 
       → [Wheelchair/FAQ/Shop? → direct]
       → Groq Model 1 (kimi-k2, 60 RPM)
            → 429? → Groq Model 2 (llama-4-scout, 30 RPM)
                        → 429? → Groq Model 3 (llama-3.1-8b-instant, 30 RPM)
                                    → 429? → Ollama (if configured) OR return 429 to user
       → Any other error on a model → try next model, then Ollama
```

---

## 2. Queries per minute (QPM) – Groq only

| Stage | Model | RPM limit | When it’s used |
|-------|--------|-----------|------------------|
| 1 | kimi-k2-instruct | **60** | Every request tries this first. |
| 2 | llama-4-scout-17b-16e-instruct | **30** | Only requests that got 429 on model 1. |
| 3 | llama-3.1-8b-instant | **30** | Only requests that got 429 on models 1 and 2. |

**Effective capacity (Groq):**

- **Up to ~60 QPM** with no 429s: all traffic stays on kimi-k2.
- **Up to ~90 QPM** with few 429s: 60 on kimi-k2, up to 30 on llama-4-scout.
- **Up to ~120 QPM** in theory: 60 + 30 + 30 across the three models. In practice this only happens when traffic in a given minute exceeds 60 and the “overflow” is sent to models 2 and 3.

**Safe target:** treat **60 QPM** as “comfortable” (no rate limits). **90–120 QPM** is possible with the hybrid but some requests will see a short retry (first 429, then success on the next model).

---

## 3. When Ollama is used

Ollama is used only as a **fallback**. It is called when:

| Condition | Result |
|-----------|--------|
| **No Groq API key** | Every chat request goes to Ollama (if `OLLAMA_BASE_URL` is set). |
| **429 on all Groq models** | Request 61+ in a busy minute (after kimi + scout + 8b-instant all return 429) → that request is sent to Ollama. |
| **Non-429 error** on current Groq model | Try next Groq model; if all fail → Ollama. |
| **Any unhandled error** in the Groq path | Final catch: try Ollama before returning 500. |

So in normal operation:

- **&lt; 60 QPM:** Ollama is **not** used (all served by Groq).
- **60–120 QPM:** Some requests hit models 2 and 3; Ollama is still **not** used as long as at least one Groq model succeeds.
- **&gt; 120 QPM (or all three models return 429):** The **overflow** requests are sent to Ollama (if configured). If Ollama is not configured or fails → user gets **429** “Rate limit reached…”.

---

## 4. Ollama capacity (when it is used)

- **No RPM limit** from the app; Ollama runs on your EC2 (or local) and is limited by CPU/RAM (and GPU if present).
- Typical **single-instance** behaviour: a few concurrent requests (e.g. 2–5) depending on model size and instance; more can queue and may hit the **90 s** request timeout.
- Rough ballpark on a **t3.small** (2 GB RAM) with a small model (e.g. 7B): **~2–6 QPM** when Ollama is the only backend; on **t3.medium** (4 GB) a bit more.

So: **Ollama is for occasional overflow and resilience**, not for sustaining high QPM.

---

## 5. Summary table

| Metric | Value |
|--------|--------|
| **Comfortable QPM (no 429)** | **60** (all on kimi-k2) |
| **Peak QPM with hybrid Groq** | **~90–120** (60 + 30 + 30 across 3 models) |
| **When Ollama is used** | When all 3 Groq models return 429, or Groq errors and no key |
| **Ollama’s role** | Fallback for overflow / failures; not for high sustained QPM |
| **If &gt; 120 QPM and no Ollama** | User sees **429** “Rate limit reached. Please try again in a few minutes.” |

---

## 6. Recommendations

- **&lt; 60 QPM:** Current setup is fine; Ollama rarely or never used.
- **60–120 QPM:** Hybrid already helps; expect some requests to use model 2 or 3; Ollama may still not be needed.
- **&gt; 120 QPM:** Either add Ollama for overflow (accept slower responses for those) or plan for multiple Groq keys / higher-tier limits if you need all traffic on Groq.
