# Weather-Driven Ops Copilot

> **OpenAI Build Week Hackathon** · Track: Work & Productivity
>
> A retail manager copilot that combines historical sales data with real-time weather to deliver AI-powered correlation insights and 7-day operational briefings — powered by **GPT-5.6 structured output**.

🔗 **Live Demo:** https://weather-ops-copilot.vercel.app

---

## The Problem

Café and retail store managers make daily decisions about inventory, staffing, and promotions largely on gut feeling — despite the fact that weather is one of the strongest predictors of foot traffic and sales. A rainy day (5mm+ precipitation) can suppress sales by ~20%. A heat wave above 30°C shifts the iced-drink ratio above 70%. Managers who can't act on this data ahead of time lose revenue every single day.

## What It Does

Upload your store's sales CSV. The copilot automatically:

1. **Fetches real weather data** from Open-Meteo (historical archive + 7-day forecast, no API key required)
2. **Computes Pearson correlations** between weather variables and sales metrics (precipitation × sales, temperature × ice-ratio, etc.)
3. **Visualizes patterns** via scatter charts, day-of-week bar charts, and a 1-year stacked sales timeline
4. **Generates two GPT-5.6 reports** using strict JSON schema structured output:
   - **Insight Report** — data-driven findings with r-values and executable weekly actions
   - **7-Day Operational Briefing** — daily sales forecasts with inventory, staffing, and promotion directives + a ready-to-paste Slack card

## How GPT-5.6 Is Used

Both AI endpoints use `response_format: { type: 'json_schema', strict: true }` to guarantee structured, hallucination-resistant output:

```typescript
// app/api/report/insight/route.ts
const completion = await openai.chat.completions.create({
  model: 'gpt-5.6',
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'insight_report', strict: true, schema: SCHEMA },
  },
  messages: [systemPrompt, userPrompt],
})
```

The prompts inject only the minimal context needed (Pearson r-values, DOW effect averages, top-5 outliers) — **not** the raw 375-row scatter dataset. This keeps token usage low while giving GPT-5.6 enough signal to cite real numbers in its analysis.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14 (App Router) | Server routes + static client bundle |
| AI | GPT-5.6 via OpenAI SDK v6 | Structured output, strict JSON schema |
| Weather | Open-Meteo (free, no key) | Archive 2025-07– present + 7-day forecast |
| Charts | Recharts | ScatterChart, BarChart, AreaChart |
| Map | react-leaflet v4.2.1 | Leaflet on React 18 without SSR issues |
| CSV | papaparse | Client-side parsing — raw sales data never leaves the browser |
| Deployment | Vercel | Serverless Node.js with file-based weather cache |

## Data Pipeline

```
User CSV (browser)
    └─ papaparse → SalesRow[]
                        │
         /api/weather ──┘── Open-Meteo API (cached: 24h archive / 1h forecast)
                        │
    computeStoreAnalytics() [client-side, pure math — no server upload]
                        │
               StoreAnalytics
                    │                   │
      /api/report/insight        /api/report/briefing
           (GPT-5.6)                  (GPT-5.6)
```

## Sample Data

Clicking **"Start with Sample Data"** calls `GET /api/sample-data`, which generates synthetic sales for 5 Korean café stores over a **rolling 365-day window ending ~2 days ago** — always "the most recent year," never a stale fixed date range. It's built from real Open-Meteo historical weather (the same archive fetch `/api/weather` already uses and file-caches) plus deterministic correlation rules (Mulberry32 PRNG seeded by date + store index), so re-running it on the same day reproduces the same numbers. `public/sample-data.csv` is kept only as an offline snapshot (regenerate it with `npm run generate-data`); the running app no longer reads it. Correlations are genuine:

| Store | r(sales × precip) | r(iceRatio × temp) |
|-------|-------------------|---------------------|
| Gangnam | −0.495 | +0.824 |
| Hongdae | −0.459 | +0.825 |
| Pangyo  | −0.432 | +0.819 |
| Haeundae | −0.408 | +0.838 |
| Jeju    | −0.389 | +0.845 |

## Local Setup

```bash
git clone https://github.com/te02065/weather-ops-copilot
cd weather-ops-copilot
npm install

# Create .env.local and add your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > .env.local

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **"샘플 데이터로 시작" / "Start with Sample Data"** — no CSV upload required for the demo. Use the 한국어 / EN toggle in the header to switch the UI language; GPT report generation (Insight Report, 7-Day Briefing) responds in whichever language is selected.

## How GPT-5.6 Accelerated Development

GPT-5.6's strict JSON schema mode was the core design decision that made this project viable within the hackathon timeframe:

- **Zero parsing failures** — `strict: true` guarantees every required field is present, eliminating defensive `try/catch` JSON parsing around LLM output
- **Formatter-ready output** — structured fields (`expectedSales`, `salesChangePercent`, `inventoryAction`) map directly to UI components without post-processing
- **Token efficiency** — sending only summary statistics (r-values, DOW averages, top-5 outliers) instead of 375 raw rows keeps each API call under 800 tokens while preserving full analytical quality

## License

MIT © 2026
