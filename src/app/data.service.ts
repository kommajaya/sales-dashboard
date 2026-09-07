import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SalesData, Row, Slicer, I } from './models';
import { cv } from './format';

@Injectable({ providedIn: 'root' })
export class DataService {
  data: SalesData | null = null;
  dims: SalesData['dims'] | null = null;
  rows: Row[] = [];
  RANKS: Record<string, Record<string, number>> = {};
  subcategoryParent = 'All';
  stateParent = 'All';

  constructor(private http: HttpClient) {}

  load(): Promise<void> {
    return this.http.get<SalesData>('data/sales-data.json').toPromise().then(res => {
      this.data = res!;
      this.dims = res!.dims;
      this.rows = res!.rows;
      this.precomputeRanks();
    }) as Promise<void>;
  }

  private uniq(col: number): string[] {
    const m: Record<string, boolean> = {};
    const o: string[] = [];
    for (const r of this.rows) {
      const k = String(r[col]);
      if (!m[k]) { m[k] = true; o.push(k); }
    }
    return o;
  }

  private uniqDim(arr: string[]): string[] {
    const m: Record<string, boolean> = {};
    const o: string[] = [];
    for (const v of arr) {
      if (!m[v]) { m[v] = true; o.push(v); }
    }
    return o;
  }

  /** Subcategories valid for a given category (or all if none selected). */
  subcategoriesFor(category: string): string[] {
    const asc = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    if (!this.rows.length) return [];
    if (category === 'All') return this.uniqDim(this.dims!.subcategory).sort(asc);
    const set = new Set<string>();
    for (const r of this.rows) {
      if (this.dims!.category[r[I.cat]] === category) set.add(this.dims!.subcategory[r[I.sub]]);
    }
    return Array.from(set).sort(asc);
  }

  /** States valid for a given country (or all if none selected). */
  statesFor(country: string): string[] {
    const asc = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    if (!this.rows.length) return [];
    if (country === 'All') return this.uniqDim(this.dims!.state).sort(asc);
    const set = new Set<string>();
    for (const r of this.rows) {
      if (this.dims!.country[r[I.ct]] === country) set.add(this.dims!.state[r[I.st]]);
    }
    return Array.from(set).sort(asc);
  }

  get SLICERS(): Slicer[] {
    const self = this;
    const asc = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    return [
      { key: 'year', label: 'Year', opts: () => ['All'].concat(self.uniq(I.Y).sort(asc)), test: (r, v) => v === 'All' || String(r[I.Y]) === v },
      { key: 'quarter', label: 'Quarter', opts: () => ['All'].concat(self.uniq(I.Q).sort((a, b) => +a - +b).map(q => 'Q' + q)), test: (r, v) => v === 'All' || ('Q' + r[I.Q]) === v },
      { key: 'channel', label: 'Channel', opts: () => ['All'].concat(self.uniqDim(self.dims!.channel).sort(asc)), test: (r, v) => v === 'All' || self.dims!.channel[r[I.ch]] === v },
      { key: 'category', label: 'Category', opts: () => ['All'].concat(self.uniqDim(self.dims!.category).sort(asc)), test: (r, v) => v === 'All' || self.dims!.category[r[I.cat]] === v },
      { key: 'subcategory', label: 'Subcategory', opts: () => ['All'].concat(self.subcategoriesFor(self.subcategoryParent)), test: (r, v) => v === 'All' || self.dims!.subcategory[r[I.sub]] === v },
      { key: 'brand', label: 'Brand', opts: () => ['All'].concat(self.uniqDim(self.dims!.brand).sort(asc)), test: (r, v) => v === 'All' || self.dims!.brand[r[I.br]] === v },
      { key: 'color', label: 'Color', opts: () => ['All'].concat(self.uniqDim(self.dims!.color).sort(asc)), test: (r, v) => v === 'All' || self.dims!.color[r[I.col]] === v },
      { key: 'country', label: 'Country', opts: () => ['All'].concat(self.uniqDim(self.dims!.country).sort(asc)), test: (r, v) => v === 'All' || self.dims!.country[r[I.ct]] === v },
      { key: 'state', label: 'State', opts: () => ['All'].concat(self.statesFor(self.stateParent)), test: (r, v) => v === 'All' || self.dims!.state[r[I.st]] === v },
      { key: 'storeSize', label: 'Store size', opts: () => ['All'].concat(self.uniqDim(self.dims!.storeSize).sort(asc)), test: (r, v) => v === 'All' || self.dims!.storeSize[r[I.ss]] === v },
    ];
  }

  filtered(filters: Record<string, string>): Row[] {
    const slicers = this.SLICERS;
    const out: Row[] = [];
    for (const r of this.rows) {
      let keep = true;
      for (const s of slicers) {
        if (!s.test(r, filters[s.key])) { keep = false; break; }
      }
      if (keep) out.push(r);
    }
    return out;
  }

  private precomputeRanks(): void {
    const DONUT_KEYS: Record<string, number> = { channel: I.ch, category: I.cat, color: I.col, storeSize: I.ss };
    const LABEL: Record<string, string[]> = {
      channel: this.dims!.channel, category: this.dims!.category,
      color: this.dims!.color, storeSize: this.dims!.storeSize
    };
    this.RANKS = {};
    for (const [k, col] of Object.entries(DONUT_KEYS)) {
      const dim = LABEL[k];
      const map: Record<string, number> = {};
      for (const r of this.rows) {
        const key = dim[r[col]];
        map[key] = (map[key] || 0) + r[I.sale];
      }
      const list = Object.keys(map).sort((a, b) => map[b] - map[a]);
      this.RANKS[k] = {};
      for (let i = 0; i < list.length; i++) this.RANKS[k][list[i]] = i + 1;
    }
  }

  donutSegments(key: string, items: { name: string; value: number }[], maxSeg = 6): { name: string; value: number; color: string }[] {
    const C = [cv('--s1'), cv('--s2'), cv('--s3'), cv('--s4'), cv('--s5'), cv('--s6'), cv('--s7'), cv('--s8')];
    function colorOf(rank: number): string { return (rank >= 1 && rank <= 8) ? C[rank - 1] : cv('--other'); }

    const sorted = items.slice().sort((a, b) => b.value - a.value);
    const main = sorted.slice(0, maxSeg - 1);
    let rest = sorted.slice(maxSeg - 1);
    if (rest.length === 1) { main.push(rest[0]); rest = []; }

    const out = main.map(it => ({ name: it.name, value: it.value, color: colorOf(this.RANKS[key]?.[it.name] || 99) }));
    if (rest.length) {
      const rv = rest.reduce((a, s) => a + s.value, 0);
      out.push({ name: 'Other (' + rest.length + ')', value: rv, color: cv('--other') });
    }
    return out;
  }
}
