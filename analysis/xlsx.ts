/**
 * 이 파일이 하는 일: 엑셀(.xlsx) 파일을 패키지 없이 읽어 시트별 표(행 배열)로 바꿉니다.
 * 입력: 파일 바이트 (Uint8Array)
 * 출력: { 시트 이름: 행 배열 }. 빈 칸은 null. 행 길이는 시트마다 다를 수 있습니다 (끝의 빈 칸은 생략될 수 있음).
 * 주의점: 브라우저와 서버(Node) 모두에서 돌아갑니다. 압축 해제는 DecompressionStream('deflate-raw')를 씁니다.
 *         암호가 걸린 파일, 매크로, 그림은 다루지 않습니다. 열 이름 찾기는 이 파일이 하지 않습니다 (호출하는 쪽이 합니다).
 *         응답 값은 글자(문자열)로 돌려줍니다. 숫자로 바꾸는 것은 호출하는 쪽이 합니다.
 */

export type SheetRows = Array<Array<string | null>>

interface ZipEntry { name: string; method: number; compSize: number; localOffset: number }

const EOCD_SIG = 0x06054b50
const CEN_SIG = 0x02014b50
const LOC_SIG = 0x04034b50

export async function readXlsx(bytes: Uint8Array): Promise<Record<string, SheetRows>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = readCentralDirectory(bytes, view)
  const files = new Map<string, Uint8Array>()
  for (const e of entries) files.set(e.name, await readEntry(bytes, view, e))
  const text = (name: string) => new TextDecoder('utf-8').decode(files.get(name) ?? new Uint8Array())
  const shared = parseSharedStrings(text('xl/sharedStrings.xml'))
  const sheets: Record<string, SheetRows> = {}
  for (const { name, target } of parseSheetList(text('xl/workbook.xml'), text('xl/_rels/workbook.xml.rels'))) {
    const xml = files.get(target)
    if (!xml) continue
    sheets[name] = parseSheet(new TextDecoder('utf-8').decode(xml), shared)
  }
  return sheets
}

function readCentralDirectory(bytes: Uint8Array, view: DataView): ZipEntry[] {
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 65557; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('엑셀 파일 형식이 아닙니다 (압축 목록을 찾지 못했습니다).')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const out: ZipEntry[] = []
  for (let k = 0; k < count; k++) {
    if (view.getUint32(p, true) !== CEN_SIG) throw new Error('엑셀 파일의 압축 목록이 깨졌습니다.')
    const method = view.getUint16(p + 10, true)
    const compSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + nameLen))
    out.push({ name, method, compSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

async function readEntry(bytes: Uint8Array, view: DataView, e: ZipEntry): Promise<Uint8Array> {
  if (view.getUint32(e.localOffset, true) !== LOC_SIG) throw new Error('엑셀 파일의 내용이 깨졌습니다.')
  const start = e.localOffset + 30 + view.getUint16(e.localOffset + 26, true) + view.getUint16(e.localOffset + 28, true)
  const data = bytes.subarray(start, start + e.compSize)
  if (e.method === 0) return data
  if (e.method !== 8) throw new Error(`지원하지 않는 압축 방식입니다: ${e.method}`)
  const stream = new Blob([Uint8Array.from(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g), (m) =>
    unescapeXml(Array.from(m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (t) => t[1]!).join('')))
}

function parseSheetList(workbook: string, rels: string): Array<{ name: string; target: string }> {
  const targets = new Map<string, string>()
  for (const m of Array.from(rels.matchAll(/<Relationship\b[^>]*>/g))) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1]
    const target = /Target="([^"]+)"/.exec(m[0])?.[1]
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  }
  return Array.from(workbook.matchAll(/<sheet\b[^>]*>/g), (m) => {
    const name = unescapeXml(/name="([^"]*)"/.exec(m[0])?.[1] ?? '')
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1] ?? ''
    return { name, target: targets.get(rid) ?? '' }
  }).filter((s) => s.target !== '')
}

function parseSheet(xml: string, shared: string[]): SheetRows {
  const rows: SheetRows = []
  for (const rowMatch of Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g))) {
    const cells: Array<string | null> = []
    for (const c of Array.from(rowMatch[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g))) {
      const ref = /r="([A-Z]+)\d+"/.exec(c[1]!)?.[1]
      if (!ref) continue
      cells[colIndex(ref)] = cellValue(c[1]!, c[2] ?? '', shared)
    }
    rows.push(Array.from(cells, (v) => (v === undefined ? null : v)))
  }
  return rows
}

function cellValue(attrs: string, body: string, shared: string[]): string | null {
  const type = /t="(\w+)"/.exec(attrs)?.[1]
  if (type === 'inlineStr') return unescapeXml(Array.from(body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (t) => t[1]!).join(''))
  const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
  if (v === undefined) return null
  if (type === 's') return shared[Number(v)] ?? null
  return unescapeXml(v)
}

function colIndex(letters: string): number {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function unescapeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}
