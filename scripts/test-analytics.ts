// Smoke test: npx tsx scripts/test-analytics.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'papaparse'
import { getStoreWeather } from '../lib/weather'
import { computeStoreAnalytics, type SalesRow } from '../lib/analytics'
import { STORES } from '../lib/stores'

interface CsvRow {
  date: string
  store_id: string
  store_name: string
  lat: string
  lon: string
  total_sales: string
  ice_sales: string
  hot_sales: string
  transactions: string
}

function toCsvRow(r: CsvRow): SalesRow {
  return {
    date:         r.date,
    storeId:      r.store_id,
    storeName:    r.store_name,
    totalSales:   parseInt(r.total_sales),
    iceSales:     parseInt(r.ice_sales),
    hotSales:     parseInt(r.hot_sales),
    transactions: parseInt(r.transactions),
  }
}

function bar(index: number, width = 20): string {
  const filled = Math.round(index * width)
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled))
}

async function main() {
  const csv   = readFileSync(join(process.cwd(), 'public', 'sample-data.csv'), 'utf-8')
  const { data } = parse<CsvRow>(csv, { header: true, skipEmptyLines: true })
  const allSales  = data.map(toCsvRow)

  for (const store of STORES) {
    const storeSales = allSales.filter((r) => r.storeId === store.id)
    const wx         = await getStoreWeather(store.id)
    const a          = computeStoreAnalytics(storeSales, wx.archive)

    console.log(`\n${'═'.repeat(56)}`)
    console.log(`  ${a.storeName}  (${a.period.start} → ${a.period.end}, ${a.period.days}d)`)
    console.log('═'.repeat(56))

    console.log(`  평균 일매출: ₩${a.summary.avgDailySales.toLocaleString()}`)
    console.log(`  최고/최저:  ₩${a.summary.maxDailySales.toLocaleString()} / ₩${a.summary.minDailySales.toLocaleString()}`)

    console.log('\n  ─── 피어슨 상관계수 ───────────────────────')
    const c = a.correlations
    const rLine = (label: string, r: number) => {
      const sign = r >= 0 ? '+' : ''
      const bar20 = r >= 0
        ? '  ' + '▶'.repeat(Math.round(Math.abs(r) * 10))
        : '◀'.repeat(Math.round(Math.abs(r) * 10)) + '  '
      console.log(`  ${label.padEnd(16)} r=${sign}${r.toFixed(3)}  ${bar20}`)
    }
    rLine('매출 × 기온',    c.salesVsTemp)
    rLine('매출 × 강수',    c.salesVsPrecip)
    rLine('아이스율 × 기온', c.iceRatioVsTemp)
    rLine('매출 × 체감온도', c.salesVsApparentTemp)

    console.log('\n  ─── 요일 효과 ─────────────────────────────')
    a.dowEffect.forEach((d) => {
      const idx = d.index.toFixed(2)
      console.log(`  ${d.label} [${bar(d.index, 12)}] ${idx}x  ₩${d.avgSales.toLocaleString()}`)
    })

    if (a.outliers.length > 0) {
      console.log('\n  ─── 이상치 Top 5 ──────────────────────────')
      a.outliers.slice(0, 5).forEach((o) => {
        const dir = o.zScore > 0 ? '↑' : '↓'
        console.log(`  ${o.date}  ${dir}z=${o.zScore.toFixed(1)}  ₩${o.totalSales.toLocaleString()}  [${o.tags.join(' ')}]`)
      })
    }
  }

  console.log('\n✅ analytics OK')
}

main().catch((err) => { console.error('❌', err); process.exit(1) })
