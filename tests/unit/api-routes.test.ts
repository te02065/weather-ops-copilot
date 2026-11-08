/**
 * 이 파일이 하는 일: app/api 라우트를 직접 호출해서 응답 모양을 확인합니다 (서버를 띄우지 않고, 외부 요청 없음).
 * 입력: 테스트 안에서 만든 Request 객체
 * 출력: 테스트 통과/실패
 * 주의점: 기상청과 OpenAI는 호출하지 않습니다. 허용되지 않은 항목(상호명)은 AI 호출 전에 거절되는지 확인합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { GET as sampleGet } from '../../app/api/sample-data/route'
import { lastDateOf } from '../../analysis/sampleShift'
import { addDaysIso, daysBetween, localTodayIso } from '../../analysis/dates'
import { POST as locationPost } from '../../app/api/location/route'
import { GET as observedGet } from '../../app/api/weather/observed/route'
import { POST as briefingPost } from '../../app/api/briefing/route'

test('샘플 API: 합성 데이터임을 표시한다', async () => {
  const res = sampleGet()
  const body = (await res.json()) as { source: string; sales: string; weather: string }
  assert.equal(body.source, 'synthetic')
  assert.ok(body.sales.startsWith('date,sales'))
  assert.ok(body.weather.startsWith('date,precipMm'))
})

test('샘플 API: 날짜가 오늘 기준으로 옮겨져 마지막 날이 어제 근처에 온다 (과거 날짜 예측 방지)', async () => {
  const res = sampleGet()
  const body = (await res.json()) as { shiftDays: number; sales: string }
  assert.equal(body.shiftDays % 7, 0)
  const last = lastDateOf(body.sales)!
  const gap = daysBetween(last, addDaysIso(localTodayIso(), -1))
  assert.ok(Math.abs(gap) < 7, `마지막 날(${last})이 어제와 7일 이상 차이 납니다`)
})

test('주소 변환 API: 업체가 정해지지 않았으므로 501과 안내', async () => {
  const res = locationPost()
  assert.equal(res.status, 501)
  const body = (await res.json()) as { code: string }
  assert.equal(body.code, 'E_GEOCODE_NOT_CONFIGURED')
})

test('관측 날씨 API: 잘못된 요청은 400 (기상청을 부르지 않음)', async () => {
  const res = await observedGet(new Request('http://localhost/api/weather/observed?stationId=abc&start=2026-01-01&end=2026-01-02'))
  assert.equal(res.status, 400)
})

test('브리핑 API: 상호명이 섞인 요청은 AI 호출 전에 400으로 거절한다', async () => {
  const req = new Request('http://localhost/api/briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facts: { storeCode: 'CAFE-A', storeName: '오로밋' } }),
  })
  const res = await briefingPost(req)
  assert.equal(res.status, 400)
  const body = (await res.json()) as { code: string; message: string }
  assert.equal(body.code, 'E_FACT_FORBIDDEN')
  assert.ok(body.message.includes('storeName'))
})
