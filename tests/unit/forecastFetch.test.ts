/**
 * 이 파일이 하는 일: 단기예보 응답 항목을 하루 값으로 바꾸는 함수(weather/forecastFetch)의 테스트.
 * 입력: 실제 응답 형식과 같은 항목 목록 (강수량 글자, 기온, 강수확률, 하늘, 최저·최고)
 * 출력: 테스트 통과/실패
 * 주의점: 강수량 글자("강수없음", "1mm 미만", "30~50mm")를 숫자로 바꾸는지 확인합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { dayFromItems, parsePrecip, type ApiItem } from '../../weather/forecastFetch'

test('강수량 글자를 mm 숫자로 바꾼다', () => {
  assert.equal(parsePrecip('강수없음'), 0)
  assert.equal(parsePrecip('1mm 미만'), 0.5)
  assert.equal(parsePrecip('1.0mm'), 1)
  assert.equal(parsePrecip('30~50mm'), 40)
  assert.equal(parsePrecip('50mm 이상'), 50)
  assert.equal(parsePrecip('알 수 없음'), null)
  assert.equal(parsePrecip(undefined), null)
})

test('하루 값: 기온 최저·최고는 TMN, TMX를 쓰고, 강수확률은 샘플 최댓값, 하늘은 샘플 대표값', () => {
  const items: ApiItem[] = []
  const add = (category: string, fcstTime: string, fcstValue: string) => items.push({ category, fcstDate: '20261110', fcstTime, fcstValue })
  for (let h = 0; h < 24; h++) {
    const t = `${String(h).padStart(2, '0')}00`
    add('TMP', t, String(5 + (h % 3)))
    add('PCP', t, h === 3 ? '1mm 미만' : '강수없음')
  }
  for (const [t, p] of [['0000', '20'], ['0600', '70'], ['1200', '30'], ['1800', '10']] as const) add('POP', t, p)
  for (const [t, s] of [['0000', '3'], ['0600', '4'], ['1200', '3'], ['1800', '1']] as const) add('SKY', t, s)
  add('TMN', '0000', '3.0')
  add('TMX', '0000', '14.0')
  const r = dayFromItems('2026-11-10', items)
  assert.equal(r.day.tempMin, 3)
  assert.equal(r.day.tempMax, 14)
  assert.equal(r.day.precipMm, 0.5)
  assert.equal(r.day.popPct, 70)
  assert.equal(r.day.sky, 'cloudy')
  assert.equal(r.missingHours, 0)
})
