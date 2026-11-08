/**
 * 이 파일이 하는 일: 작은 선형 회귀 행렬을 풉니다 (정규방정식 XᵀX β = Xᵀy).
 * 입력: 설계 행렬 X (행마다 같은 길이), 종속변수 y, 작은 ridge 값
 * 출력: 계수 목록(랭크 부족으로 뺀 항은 null), 뺀 열 번호 목록
 * 주의점: 랭크가 부족하면(두 열이 같은 정보를 가짐) 그 열을 빼고 다시 풉니다. 빠진 열은 dropped에 기록합니다.
 *         외부 패키지 없이 가우스 소거법으로 풉니다. 작은 행렬(열 15개 이하)용입니다.
 *         ridge 값(1e-8)은 analysis/config.ts의 ridgeLambda에서 가져옵니다.
 */

export interface SolveResult {
  beta: Array<number | null> // 열마다 계수. 뺀 열은 null
  dropped: number[]          // 랭크 부족으로 뺀 열 번호
}

export function solveNormal(X: number[][], y: number[], ridge: number): SolveResult {
  const p = X[0]?.length ?? 0
  const XtX = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => X.reduce((s, row) => s + row[i]! * row[j]!, 0)))
  const Xty = Array.from({ length: p }, (_, i) => X.reduce((s, row, k) => s + row[i]! * y[k]!, 0))
  let active = Array.from({ length: p }, (_, i) => i)
  const dropped: number[] = []
  for (;;) {
    const rhs = active.map((i) => Xty[i]!)
    // 특이 여부는 ridge를 더하기 전 행렬로 판정합니다. ridge가 있으면 특이함이 가려지기 때문입니다.
    const exact = active.map((i) => active.map((j) => XtX[i]![j]!))
    const check = gaussSolve(exact, rhs)
    if (check.singularAt === -1) {
      const sub = active.map((i) => active.map((j) => XtX[i]![j]! + (i === j ? ridge : 0)))
      const result = gaussSolve(sub, rhs)
      const beta: Array<number | null> = Array.from({ length: p }, () => null)
      active.forEach((col, k) => { beta[col] = result.x[k]! })
      return { beta, dropped }
    }
    const col = active[check.singularAt]!
    dropped.push(col)
    active = active.filter((c) => c !== col)
  }
}

/** 가우스 소거법 (부분 선택). 피벗이 거의 0이면 그 위치를 singularAt에 돌려줍니다. */
function gaussSolve(A: number[][], b: number[]): { x: number[]; singularAt: number } {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]!])
  const scale = Math.max(1, ...A.flat().map((v) => Math.abs(v)))
  for (let c = 0; c < n; c++) {
    let pivot = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[pivot]![c]!)) pivot = r
    if (Math.abs(M[pivot]![c]!) < 1e-10 * scale) return { x: [], singularAt: c }
    ;[M[c], M[pivot]] = [M[pivot]!, M[c]!]
    for (let r = c + 1; r < n; r++) {
      const f = M[r]![c]! / M[c]![c]!
      for (let k = c; k <= n; k++) M[r]![k] = M[r]![k]! - f * M[c]![k]!
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r]![n]!
    for (let k = r + 1; k < n; k++) s -= M[r]![k]! * x[k]!
    x[r] = s / M[r]![r]!
  }
  return { x, singularAt: -1 }
}
