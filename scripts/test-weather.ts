// Quick smoke test: npx tsx scripts/test-weather.ts
import { getStoreWeather } from '../lib/weather'

async function main() {
  console.log('Testing getStoreWeather("gangnam")...\n')
  const data = await getStoreWeather('gangnam')

  console.log(`storeId  : ${data.storeId}`)
  console.log(`archive  : ${data.archive.length} days  (${data.archive[0]?.date} → ${data.archive.at(-1)?.date})`)
  console.log(`forecast : ${data.forecast.length} days  (${data.forecast[0]?.date} → ${data.forecast.at(-1)?.date})`)
  console.log()
  console.log('Archive sample (first 3):')
  data.archive.slice(0, 3).forEach(p =>
    console.log(`  ${p.date}  tempMax=${p.tempMax}°C  precip=${p.precip}mm`),
  )
  console.log()
  console.log('Forecast (all 7 days):')
  data.forecast.forEach(p =>
    console.log(`  ${p.date}  tempMax=${p.tempMax}°C  precip=${p.precip}mm`),
  )
  console.log('\n✅ weather module OK — cache written to .cache/weather/')
}

main().catch(err => { console.error('❌', err); process.exit(1) })
