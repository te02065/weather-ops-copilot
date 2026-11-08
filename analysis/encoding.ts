/**
 * 이 파일이 하는 일: CSV 파일의 바이트(원본)를 글자로 바꿉니다.
 * 입력: Uint8Array (파일 원본 바이트)
 * 출력: { ok, text, encoding } — encoding은 'utf-8', 'utf-8-bom', 'windows-949' 중 하나
 * 주의점: 순서는 UTF-8을 엄격하게(fatal) 먼저 읽고, 실패하면 CP949(windows-949)로 읽습니다.
 *         둘 다 실패하면 ok: false이고, 호출하는 쪽이 E_CSV_PARSE를 냅니다.
 *         UTF-8 BOM(EF BB BF)이 있으면 글자로 바꾸기 전에 제거합니다. 엑셀 "CSV UTF-8" 저장 파일에 자주 붙어 있습니다.
 *         TextDecoder는 브라우저와 Node 양쪽에 있으므로 이 파일은 분석 폴더에 둡니다.
 */

export type CsvEncoding = 'utf-8' | 'utf-8-bom' | 'windows-949'

export type DecodeResult =
  | { ok: true; text: string; encoding: CsvEncoding }
  | { ok: false }

const BOM = [0xef, 0xbb, 0xbf]

export function decodeCsvBytes(bytes: Uint8Array): DecodeResult {
  const hasBom = bytes.length >= 3 && BOM.every((b, i) => bytes[i] === b)
  const utf8Body = hasBom ? bytes.subarray(BOM.length) : bytes
  const utf8 = tryDecode('utf-8', utf8Body)
  if (utf8 !== null) return { ok: true, text: utf8, encoding: hasBom ? 'utf-8-bom' : 'utf-8' }
  // Node의 windows-949 디코더는 깨진 바이트를 오류 없이 버리므로, 바이트 구조를 먼저 확인합니다
  if (isStructurallyCp949(bytes)) {
    const cp949 = tryDecode('windows-949', bytes)
    if (cp949 !== null) return { ok: true, text: cp949, encoding: 'windows-949' }
  }
  return { ok: false }
}

/**
 * CP949 바이트 구조 검사 (글자 표 전체를 보지는 않습니다).
 * ASCII(0x00~0x7F)는 한 바이트, 0x81~0xFE는 뒤에 0x41~0xFE 한 바이트가 와야 합니다.
 */
export function isStructurallyCp949(bytes: Uint8Array): boolean {
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i]!
    if (b < 0x80) {
      i += 1
    } else if (b >= 0x81 && b <= 0xfe) {
      const next = bytes[i + 1]
      if (next === undefined || next < 0x41 || next > 0xfe || next === 0x7f) return false
      i += 2
    } else {
      return false
    }
  }
  return true
}

/** 엄격 모드로 읽습니다. 잘못된 바이트가 있으면 null을 돌려줍니다. */
function tryDecode(label: string, bytes: Uint8Array): string | null {
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}
