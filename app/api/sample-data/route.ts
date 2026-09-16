import { generateSampleSalesRows, rowsToCsv } from '@/lib/sampleData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await generateSampleSalesRows()
    const csv = rowsToCsv(rows)
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
