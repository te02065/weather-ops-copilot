/**
 * 이 파일이 하는 일: 날씨(KMA) 쪽에서 쓰는 데이터 모양(타입)을 정의합니다.
 * 입력: 없음 (타입 정의만 있습니다)
 * 출력: WeatherObs(하루 관측), StationRecord(관측소), StationList(관측소 목록과 확정 여부)
 * 주의점: 관측소 번호는 코드에 직접 쓰지 않습니다. 지점정보 조회로 확정한 값만 씁니다.
 */

/** 하루 관측값. 값이 없으면 null입니다 (0으로 바꾸지 않음). */
export interface WeatherObs {
  date: string              // YYYY-MM-DD
  stationId: string         // 관측소 번호 (확정 전이면 "[확인 필요]")
  precipMm: number | null   // 일강수량 (RN_DAY)
  tempAvg: number | null    // 평균 기온 (TA_AVG)
  tempMax: number | null    // 최고 기온 (TA_MAX)
  tempMin: number | null    // 최저 기온 (TA_MIN)
  stale: boolean            // true = 갱신 실패로 예전 캐시를 쓴 값
}

export interface StationRecord {
  id: string
  name: string
  lat: number
  lon: number
}

export interface StationList {
  confirmed: boolean        // 지점정보 조회로 확정했는지 (false면 사용하지 않음)
  stations: StationRecord[]
}
