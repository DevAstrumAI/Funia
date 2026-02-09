# Groq Chat Models – Comparison & Rate Limits

Comparison of chat-suitable models on Groq (Developer plan).  
Source: [Groq Rate Limits](https://console.groq.com/docs/rate-limits).  
Check your org’s exact limits: [console.groq.com/settings/limits](https://console.groq.com/settings/limits).

## Limits explained

| Abbreviation | Meaning |
|-------------|--------|
| **RPM** | Requests per minute |
| **RPD** | Requests per day |
| **TPM** | Tokens per minute |
| **TPD** | Tokens per day |

You hit a limit when the **first** of these is reached (e.g. 30 requests in 1 minute → 429 even if TPM is still under limit).

---

## Chat models comparison

| Model | RPM | RPD | TPM | TPD | Best for |
|-------|-----|-----|-----|-----|----------|
| **moonshotai/kimi-k2-instruct** | **60** | 1,000 | **10,000** | 300,000 | Fewer 429s (60 RPM), good TPM |
| **moonshotai/kimi-k2-instruct-0905** | **60** | 1,000 | **10,000** | 300,000 | Same as above (newer variant) |
| llama-3.1-8b-instant | 30 | **14,400** | 6,000 | 500,000 | High daily volume (RPD), fast |
| meta-llama/llama-4-scout-17b-16e-instruct | 30 | 1,000 | **30,000** | 500,000 | Large context, high TPM |
| meta-llama/llama-4-maverick-17b-128e-instruct | 30 | 1,000 | 6,000 | 500,000 | Llama 4, 128K context |
| llama-3.3-70b-versatile | 30 | 1,000 | 12,000 | 100,000 | Strongest quality, 70B |
| openai/gpt-oss-20b | 30 | 1,000 | 8,000 | 200,000 | GPT-OSS 20B |
| openai/gpt-oss-120b | 30 | 1,000 | 8,000 | 200,000 | GPT-OSS 120B |
| qwen/qwen3-32b | **60** | 1,000 | 6,000 | 500,000 | 60 RPM (you asked not to use) |

---

## Recommendation for this chatbot

- **Avoid 429 (rate limit) when many users ask at once**  
  → Use **60 RPM** models: **moonshotai/kimi-k2-instruct** (or **-0905**).  
  Current default in this project: `moonshotai/kimi-k2-instruct`.

- **Need highest daily request volume (RPD)**  
  → **llama-3.1-8b-instant** (14,400 RPD, 30 RPM).  
  Good if you hit the *daily* limit, not the per-minute one.

- **Need very large context and high TPM**  
  → **meta-llama/llama-4-scout-17b-16e-instruct** (30K TPM, 131K context).  
  Stays at 30 RPM, so 429s can still happen under burst traffic.

- **Best quality, fewer requests per day**  
  → **llama-3.3-70b-versatile** (30 RPM, 1K RPD, 12K TPM).  
  Strongest model in the table; RPD is low.

---

## How to change the model

In `.env`:

```bash
# 60 RPM (fewer 429s) – current default
GROQ_CHAT_MODEL=moonshotai/kimi-k2-instruct

# Or: highest RPD (14.4K/day)
# GROQ_CHAT_MODEL=llama-3.1-8b-instant

# Or: highest TPM + big context (30K TPM, 131K context)
# GROQ_CHAT_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

Restart the server after changing.
