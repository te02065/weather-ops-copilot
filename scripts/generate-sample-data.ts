/**
 * CLI snapshot of the dynamic sample generator (lib/sampleData.ts) — writes
 * the current rolling-window sample data to public/sample-data.csv for
 * offline use. The running app no longer depends on this static file
 * (it calls GET /api/sample-data instead, which always reflects "today"),
 * but this script is kept for manual export / offline demos.
 *
 * Usage: npm run generate-data
 * Output: public/sample-data.csv
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { generateSampleSalesRows, rowsToCsv } from '../lib/sampleData'
import { getRollingArchiveRange } from '../lib/dateRange'

async function main() {
  const { startDate, endDate } = getRollingArchiveRange()

  console.log('╔══════════════════════════════════════════════╗')
  console.log('║   Weather-Driven Ops Copilot — Data Gen     ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log(`Period : ${startDate} → ${endDate} (rolling window)`)
  console.log()

  const rows = await generateSampleSalesRows()
  const csv = rowsToCsv(rows)

  const publicDir = resolve(process.cwd(), 'public')
  mkdirSync(publicDir, { recursive: true })
  const outPath = resolve(publicDir, 'sample-data.csv')
  writeFileSync(outPath, csv, 'utf-8')

  const storeCount = new Set(rows.map((r) => r.store_id)).size
  console.log(`✅ ${rows.length} rows → public/sample-data.csv`)
  console.log(`   (${storeCount} stores × ~${Math.floor(rows.length / (storeCount || 1))} days each)`)
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err)
  process.exit(1)
})
