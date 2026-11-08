/**
 * 이 파일이 하는 일: 두 위경도 사이의 직선거리(km)를 구합니다 (하버사인 공식).
 * 입력: { lat, lon } 두 개 (도 단위)
 * 출력: 거리 (km)
 * 주의점: 지구를 구로 보고 계산한 근사값입니다. 관측소 30km 경고 같은 용도에는 충분합니다.
 */

const DEG = Math.PI / 180

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  earthRadiusKm: number,
): number {
  const dLat = (b.lat - a.lat) * DEG
  const dLon = (b.lon - a.lon) * DEG
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)))
}
