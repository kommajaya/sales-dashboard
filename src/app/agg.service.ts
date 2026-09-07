import { Injectable } from '@angular/core';
import { Row, AggResult, I } from './models';

@Injectable({ providedIn: 'root' })
export class AggService {
  sums(rows: Row[]): AggResult {
    let s = 0, c = 0, q = 0;
    const o: Record<string, boolean> = {};
    const u: Record<string, boolean> = {};
    for (const r of rows) {
      s += r[I.sale]; c += r[I.cost]; q += r[I.qty];
      o[r[I.O]] = true; u[r[I.C]] = true;
    }
    return { sales: s, cost: c, qty: q, gp: s - c, orders: Object.keys(o).length, customers: Object.keys(u).length };
  }

  groupSum(rows: Row[], keyFn: (r: Row) => string | number, valFn: (r: Row) => number): Record<string, number> {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const k = String(keyFn(r));
      m[k] = (m[k] || 0) + valFn(r);
    }
    return m;
  }

  groupObj<T>(rows: Row[], keyFn: (r: Row) => string, initFn: () => T, addFn: (acc: T, r: Row) => void): Record<string, T> {
    const m: Record<string, T> = {};
    for (const r of rows) {
      const k = keyFn(r);
      if (!m[k]) m[k] = initFn();
      addFn(m[k], r);
    }
    return m;
  }
}
