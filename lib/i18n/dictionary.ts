export type Lang = 'ko' | 'en'

export const DOW_LABELS: Record<Lang, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

export interface Dict {
  appSubtitle: string
  uploadNewFile: string
  heroTitle: string
  heroDesc: string
  startSample: string
  analyzing: string
  uploadCsv: string
  csvFormatLabel: string
  loadingWeather: string
  selectStore: string
  avg: string
  precipR: string
  pearsonTitle: string
  badgeSalesPrecip: string
  badgeSalesPrecipDesc: string
  badgeIceTemp: string
  badgeIceTempDesc: string
  badgeSalesTemp: string
  badgeSalesTempDesc: string
  badgeSalesApparent: string
  badgeSalesApparentDesc: string
  strong: string
  moderate: string
  weak: string
  positiveCorr: string
  negativeCorr: string
  scatterSectionTitle: string
  precipVsSalesTitle: string
  tempVsIceRatioTitle: string
  precipitation: string
  maxTemp: string
  dailySales: string
  iceRatio: string
  dowChartTitle: string
  dowChartDesc: string
  timelineTitleSuffix: string
  timelineDesc: string
  iced: string
  hot: string
  reportSectionTitle: string
  insightTitle: string
  insightSubtitle: string
  briefingTitle: string
  briefingSubtitle: string
  generate: string
  generating: string
  generatingHint: string
  clickGenerate: string
  errorPrefix: string
}

export const UI: Record<Lang, Dict> = {
  ko: {
    // Header
    appSubtitle: '매출 × 날씨 분석 & 7일 운영 브리핑',
    uploadNewFile: '↩ 새 파일 업로드',

    // Upload / hero
    heroTitle: 'Weather-Driven Ops Copilot',
    heroDesc:
      '매장 판매 CSV를 업로드하세요. 실제 기상 데이터와 결합해 상관관계 인사이트와 GPT-5.6 기반 7일 운영 브리핑을 생성합니다.',
    startSample: '샘플 데이터로 시작',
    analyzing: '분석 중…',
    uploadCsv: 'CSV 파일 업로드',
    csvFormatLabel: 'CSV 컬럼 형식',
    loadingWeather: '날씨 데이터를 불러오고 상관관계를 계산하는 중…',

    // Store selector / map
    selectStore: '매장 선택',
    avg: '일평균',
    precipR: '강수 r',

    // Correlation badges
    pearsonTitle: '피어슨 상관계수',
    badgeSalesPrecip: '매출 × 강수량',
    badgeSalesPrecipDesc: '비 오는 날 매출 감소',
    badgeIceTemp: '아이스비율 × 기온',
    badgeIceTempDesc: '더울수록 아이스 음료 증가',
    badgeSalesTemp: '매출 × 기온',
    badgeSalesTempDesc: '장마 혼재 효과',
    badgeSalesApparent: '매출 × 체감온도',
    badgeSalesApparentDesc: '체감온도 영향',
    strong: '강함',
    moderate: '보통',
    weak: '약함',
    positiveCorr: '양의 상관',
    negativeCorr: '음의 상관',

    // Scatter charts
    scatterSectionTitle: '날씨 × 매출 산점도',
    precipVsSalesTitle: '강수량 × 일 매출',
    tempVsIceRatioTitle: '최고기온 × 아이스비율',
    precipitation: '강수량',
    maxTemp: '최고기온',
    dailySales: '일 매출',
    iceRatio: '아이스비율',

    // DOW chart
    dowChartTitle: '요일별 평균 매출',
    dowChartDesc: '점선: 전체 평균  |  주황: 주말',

    // Sales timeline
    timelineTitleSuffix: '— 1년 매출 추이',
    timelineDesc: '아이스(파랑) + 핫(주황)',
    iced: '아이스',
    hot: '핫',

    // Report section
    reportSectionTitle: 'GPT-5.6 리포트 생성',
    insightTitle: '📊 인사이트 리포트',
    insightSubtitle: '데이터 기반 인사이트 3~5개 + 실행 액션',
    briefingTitle: '📅 7일 운영 브리핑',
    briefingSubtitle: '예보 기반 매출 예측 + 재고·인력·프로모션 액션',
    generate: '생성하기',
    generating: '생성 중…',
    generatingHint: 'GPT-5.6이 분석 중입니다…',
    clickGenerate: '"생성하기"를 눌러 GPT-5.6 리포트를 받아보세요',

    // Generic
    errorPrefix: '오류',
  },
  en: {
    // Header
    appSubtitle: 'Sales × Weather Analytics & 7-Day Briefing',
    uploadNewFile: '↩ Upload new file',

    // Upload / hero
    heroTitle: 'Weather-Driven Ops Copilot',
    heroDesc:
      'Upload your store sales CSV. The copilot combines it with real weather data to generate correlation insights and a 7-day operational briefing via GPT-5.6.',
    startSample: 'Start with Sample Data',
    analyzing: 'Analyzing…',
    uploadCsv: 'Upload CSV File',
    csvFormatLabel: 'CSV Column Format',
    loadingWeather: 'Loading weather data & computing correlations…',

    // Store selector / map
    selectStore: 'Select Store',
    avg: 'Avg',
    precipR: 'Precip r',

    // Correlation badges
    pearsonTitle: 'Pearson Correlation Coefficients',
    badgeSalesPrecip: 'Sales × Precipitation',
    badgeSalesPrecipDesc: 'Sales drop on rainy days',
    badgeIceTemp: 'Ice Ratio × Temperature',
    badgeIceTempDesc: 'Hotter → more iced drinks',
    badgeSalesTemp: 'Sales × Temperature',
    badgeSalesTempDesc: 'Mixed monsoon effect',
    badgeSalesApparent: 'Sales × Apparent Temp',
    badgeSalesApparentDesc: 'Apparent temperature effect',
    strong: 'Strong',
    moderate: 'Moderate',
    weak: 'Weak',
    positiveCorr: 'positive correlation',
    negativeCorr: 'negative correlation',

    // Scatter charts
    scatterSectionTitle: 'Weather × Sales Scatter',
    precipVsSalesTitle: 'Precipitation × Daily Sales',
    tempVsIceRatioTitle: 'Max Temp × Ice Ratio',
    precipitation: 'Precipitation',
    maxTemp: 'Max Temp',
    dailySales: 'Daily Sales',
    iceRatio: 'Ice Ratio',

    // DOW chart
    dowChartTitle: 'Avg Sales by Day of Week',
    dowChartDesc: 'Dashed: overall avg  |  Orange: weekend',

    // Sales timeline
    timelineTitleSuffix: '— 1-Year Sales Trend',
    timelineDesc: 'Iced (blue) + Hot (orange)',
    iced: 'Iced',
    hot: 'Hot',

    // Report section
    reportSectionTitle: 'GPT-5.6 Report Generation',
    insightTitle: '📊 Insight Report',
    insightSubtitle: '3–5 data-backed insights + action plan',
    briefingTitle: '📅 7-Day Operational Briefing',
    briefingSubtitle: 'Forecast-based sales prediction + inventory / staffing / promo actions',
    generate: 'Generate',
    generating: 'Generating…',
    generatingHint: 'GPT-5.6 analyzing…',
    clickGenerate: 'Click Generate — GPT-5.6 will write the report',

    // Generic
    errorPrefix: 'Error',
  },
}
