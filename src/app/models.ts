export interface Dims {
  channel: string[];
  category: string[];
  subcategory: string[];
  brand: string[];
  color: string[];
  country: string[];
  state: string[];
  storeSize: string[];
  product: string[];
  store: string[];
}

export interface SalesData {
  dims: Dims;
  rows: Row[];
}

// [OrderNumber, CustomerKey, Year, Quarter, ich, icat, isub, ibr, icol, ict, ist, iss, ipr, istore, qty, sales, cost]
export type Row = [string, string, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export const I = {
  O: 0, C: 1, Y: 2, Q: 3, ch: 4, cat: 5, sub: 6, br: 7, col: 8,
  ct: 9, st: 10, ss: 11, pr: 12, store: 13, qty: 14, sale: 15, cost: 16
} as const;

export interface KPI {
  label: string;
  value: string;
  color: string;
  hero?: boolean;
}

export type ChartType = 'hbar' | 'col' | 'line' | 'yoy' | 'donut' | 'table';

export interface Card {
  title: string;
  sub?: string;
  type: ChartType;
  fmt?: string;
  items?: { name: string; value: number }[];
  color?: string;
  cats?: string[];
  series?: { name: string; color: string; values: number[] }[];
  keys?: string[];
  values?: (number | null)[];
  segments?: { name: string; value: number; color: string }[];
  total?: number;
  cols?: string[];
  rows?: (string | number)[][];
}

export interface PageView {
  kpis: KPI[];
  gridrows: Card[][];
}

export interface Slicer {
  key: string;
  label: string;
  opts: () => string[];
  test: (r: Row, v: string) => boolean;
}

export interface AggResult {
  sales: number;
  cost: number;
  qty: number;
  gp: number;
  orders: number;
  customers: number;
}
