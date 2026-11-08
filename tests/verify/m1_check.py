"""
M1 검산 (제품 코드 아님). numpy 최소제곱으로 같은 설계 행렬을 풀어 TypeScript 계수와 비교합니다.
실행: python tests/verify/m1_check.py   (먼저 npx tsx tests/verify/exportM1.ts 로 입력을 만듭니다)
Python이나 numpy가 없으면 이 검산은 건너뜁니다 [실행 미검증].
"""
import csv, json, sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print("numpy가 없어 검산을 건너뜁니다 [실행 미검증]")
    sys.exit(0)

base = Path(__file__).parent
rows = list(csv.DictReader(open(base / "m1_design.csv", encoding="utf-8")))
cols = [c for c in rows[0].keys() if c not in ("date", "logy")]
X = np.array([[float(r[c]) for c in cols] for r in rows])
y = np.array([float(r["logy"]) for r in rows])
ts = json.load(open(base / "m1_ts_coef.json", encoding="utf-8"))
beta, *_ = np.linalg.lstsq(X, y, rcond=None)
worst = 0.0
for name, b in zip(cols, beta):
    diff = abs(b - ts["beta"][name])
    worst = max(worst, diff)
    print(f"{name:12s} numpy={b: .6f}  ts={ts['beta'][name]: .6f}  diff={diff:.2e}")
print("dropped (TS):", ts["dropped"] or "none", "| n =", len(rows))
ok = worst < 1e-6
print("결과:", "일치 (허용오차 1e-6)" if ok else "불일치", f"(최대 차이 {worst:.2e})")
sys.exit(0 if ok else 1)
