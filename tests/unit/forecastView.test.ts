/**
 * 이 파일이 하는 일: 예보 아이콘·날씨 줄(analysis/forecastView), 하루 집계(weather/forecastDay), 하늘상태 해석 테스트.
 * 입력: 작은 예보 값들
 * 출력: 테스트 통과/실패
 * 주의점: 아이콘 기준(0.1mm, 30%, 60%)과 하늘상태 코드 1·3·4 매핑을 확인합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { weatherView, rainLevelOf } from '../../analysis/forecastView'
import { aggregateDay, skyFromKma, skyFromText } from '../../weather/forecastDay'
import type { DailyWeather } from '../../analysis/types'

const base = (over: Partial<DailyWeather>): DailyWeather => ({ date: '2026-11-09', precipMm: 0, tempAvg: 10, tempMax: 14, tempMin: 6, windMs: null, ...over })

test('비 예보(0.1mm 이상)는 우산 아이콘과 mm를 쓴다', () => {
  const v = weatherView(base({ precipMm: 3.2, sky: 'overcast', popPct: 80 }))
  assert.equal(v.icon, '☂️')
  assert.equal(v.rain, '비 예보 3.2mm')
  assert.equal(v.line, '비 예보 3.2mm · 흐림 · 최저 6℃ · 최고 14℃')
})

test('강수확률 60% 이상이면 우산, 30~59%면 해 뒤 비 아이콘, 그 밖이면 하늘 아이콘', () => {
  assert.equal(weatherView(base({ precipMm: 0, popPct: 60 })).icon, '☂️')
  assert.equal(weatherView(base({ precipMm: 0, popPct: 40 })).icon, '🌦️')
  assert.equal(weatherView(base({ precipMm: 0, popPct: 10, sky: 'clear' })).icon, '☀️')
  assert.equal(weatherView(base({ precipMm: 0, popPct: 10, sky: 'cloudy' })).icon, '⛅')
})

test('중기예보처럼 강수량 없이 확률만 있으면 확률로 말한다', () => {
  const v = weatherView(base({ precipMm: null, rainProbPct: 60, popPct: 60, sky: null }))
  assert.equal(v.rain, '비 올 확률 60%')
  assert.equal(v.sky, '')
  assert.equal(v.icon, '☂️')
})

test('예보가 없으면 예보 없음으로 말한다', () => {
  assert.equal(weatherView(null).line, '예보 없음')
  assert.equal(rainLevelOf(base({ precipMm: null, popPct: null, rainProbPct: null })).level, 'unknown')
})

test('하루 집계: 강수확률은 샘플 최댓값, 하늘은 많이 나온 값, 기온은 있는 시간만', () => {
  const temps = [5, 7, null, 9]
  const precips = [0, 0.5, null, 1]
  const d = aggregateDay('2026-11-09', temps, precips, { pops: [20, 70, 30, null], skys: [1, 3, 3, 4] })
  assert.equal(d.tempMin, 5)
  assert.equal(d.tempMax, 9)
  assert.equal(d.precipMm, 1.5)
  assert.equal(d.popPct, 70)
  assert.equal(d.sky, 'cloudy')
})

test('하늘 코드 1·3·4와 중기예보 글자를 같은 값으로 바꾼다', () => {
  assert.equal(skyFromKma(1), 'clear')
  assert.equal(skyFromKma(3), 'cloudy')
  assert.equal(skyFromKma(4), 'overcast')
  assert.equal(skyFromKma(2), null)
  assert.equal(skyFromText('구름많음'), 'cloudy')
  assert.equal(skyFromText('흐리고 비'), 'overcast')
  assert.equal(skyFromText('맑음'), 'clear')
  assert.equal(skyFromText(undefined), null)
})
