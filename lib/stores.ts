export const STORES = [
  { id: 'gangnam',   name: '강남점',        lat: 37.4979, lon: 127.0276 },
  { id: 'hongdae',   name: '홍대점',        lat: 37.5563, lon: 126.9236 },
  { id: 'pangyo',    name: '판교점',        lat: 37.3943, lon: 127.1110 },
  { id: 'haeundae',  name: '부산 해운대점', lat: 35.1587, lon: 129.1603 },
  { id: 'jeju',      name: '제주점',        lat: 33.4996, lon: 126.5312 },
] as const

export type StoreId = (typeof STORES)[number]['id']
export type Store   = (typeof STORES)[number]
