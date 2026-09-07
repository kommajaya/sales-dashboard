export function cv(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function compact(n: number): string {
  const s = n < 0 ? -1 : 1;
  const a = Math.abs(n);
  let v: string;
  if (a >= 1e9) v = (a / 1e9).toFixed(2) + 'B';
  else if (a >= 1e6) v = (a / 1e6).toFixed(2) + 'M';
  else if (a >= 1e3) v = (a / 1e3).toFixed(1) + 'K';
  else v = a.toFixed(0);
  return (s < 0 ? '-' : '') + v;
}

export function currencyM(n: number): string {
  return '$' + compact(n);
}

export function intFmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function pctFmt(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

export function fmt(name: string): (n: number) => string {
  const map: Record<string, (n: number) => string> = { money: currencyM, pct: pctFmt, int: intFmt };
  return map[name] || currencyM;
}

export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  let m = 1;
  if (n > 1 && n <= 2) m = 2;
  else if (n > 2 && n <= 2.5) m = 2.5;
  else if (n > 2.5 && n <= 5) m = 5;
  else if (n > 5) m = 10;
  return m * p;
}

export function ticks(max: number, count = 4): number[] {
  const step = niceMax(max / count);
  const out: number[] = [];
  for (let i = 0; i <= max + 0.0001; i += step) {
    out.push(Math.round(i * 100) / 100);
  }
  return out;
}

export function shortLabel(t: string): string {
  return t.length > 16 ? t.slice(0, 15) + '…' : t;
}

export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
