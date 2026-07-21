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

The repo ships with `public/sample-data.csv` — 5 Korean café stores × 375 days of synthetic sales data generated using real Open-Meteo historical weather and deterministic correlation rules (Mulberry32 PRNG seeded by date + store index). Correlations are genuine:

| Store | r(sales × precip) | r(iceRatio × temp) |
|-------|-------------------|---------------------|
| Gangnam | −0.495 | +0.824 |
| Hongdae | −0.459 | +0.825 |
| Pangyo  | −0.432 | +0.819 |
| Haeundae | −0.408 | +0.838 |
| Jeju    | −0.389 | +0.845 |

## Local Setup

```bash
git clone https://github.com/vantixofficialkr/weather-ops-copilot
cd weather-ops-copilot
npm install

# Create .env.local and add your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > .env.local

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **"샘플 데이터로 시작"** (Start with Sample Data) — no CSV upload required for the demo.

## Where AI Coding Assistant Accelerated the Workflow

This project was built in 7 focused sessions (~14 hours total) with **Claude Code** as the AI coding assistant. Key acceleration points:

### Synthetic Data Generation (saved ~3h)
The entire `scripts/generate-sample-data.ts` — Open-Meteo API integration, Mulberry32 PRNG seeding, and weather-correlated sales rules — was generated in one pass. Writing the PRNG seed logic and conditional sales modifier math manually would have required iterative debugging.

### Weather Pipeline (saved ~2h)
File-based caching with dual TTL (24h archive, 1h forecast) and OS-aware paths (`os.tmpdir()` for Vercel, `process.cwd()/.cache` for dev) including API failure fallback was produced without a debugging cycle.

### Pearson Correlation Engine (saved ~1.5h)
The `computeStoreAnalytics()` pure function — Pearson r, DOW index, z-score outlier detection — was immediately correct and confirmed against the synthetic data's generating rules without separate unit tests.

### Dashboard UI (saved ~4h)
Six Recharts components and the Leaflet map were scaffolded simultaneously. The AI identified and resolved the react-leaflet v5 / React 18 incompatibility (`render is not a function` runtime error) by downgrading to v4.2.1, saving a multi-hour debugging session.

### GPT-5.6 Prompt Engineering (saved ~1h)
Both structured-output routes — JSON schema definitions, minimal-context prompts, and formatter functions — were written in one pass. The decision to exclude the 375-row scatter array from GPT context (send summary stats only) was surfaced during prompt review, cutting token cost significantly.

## AI Coding Session

Built with **Claude Code** (Anthropic) as the AI coding workflow accelerator.  
GPT-5.6 is the in-product AI engine for all structured analytics and briefing output.

## License

MIT © 2026
