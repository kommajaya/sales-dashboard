import { Component, signal, computed, OnInit, afterNextRender } from '@angular/core';
import { DecimalPipe, CurrencyPipe } from '@angular/common';
import { DataService } from './data.service';
import { AggService } from './agg.service';
import { ThemeService } from './theme.service';
import { Row, KPI, Card, PageView, I } from './models';
import { cv, currencyM, intFmt, pctFmt, compact } from './format';
import { HbarComponent } from './charts/hbar.component';
import { ColchartComponent } from './charts/colchart.component';
import { LinechartComponent } from './charts/linechart.component';
import { YoychartComponent } from './charts/yoychart.component';
import { DonutComponent } from './charts/donut.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HbarComponent, ColchartComponent, LinechartComponent, YoychartComponent, DonutComponent, DecimalPipe, CurrencyPipe],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  loading = signal(true);
  pageId = signal('exec');
  filter = signal<Record<string, string>>({});
  pages = [
    { id: 'exec', name: 'Executive Summary' },
    { id: 'product', name: 'Product Analysis' },
    { id: 'store', name: 'Store Analysis' },
    { id: 'compare', name: 'Sales Comparison' }
  ];

  filteredRows = signal<Row[]>([]);
  rowCount = signal(0);
  sum = signal({ sales: 0, cost: 0, qty: 0, gp: 0, orders: 0, customers: 0 });
  allFiltered = signal(true);
  view = signal<PageView | null>(null);

  constructor(
    public data: DataService,
    private agg: AggService,
    public theme: ThemeService
  ) {
    afterNextRender(() => {
      const sel = document.querySelector<HTMLSelectElement>('.theme-select');
      if (sel) sel.value = this.theme.theme();
    });
  }

  ngOnInit(): void {
    const filters: Record<string, string> = {};
    this.data.SLICERS.forEach(s => { filters[s.key] = 'All'; });
    this.filter.set(filters);

    this.data.load().then(() => {
      this.loading.set(false);
      this.refresh();
    });
  }

  refresh(): void {
    const f = this.filter();
    this.data.subcategoryParent = f['category'] || 'All';
    this.data.stateParent = f['country'] || 'All';
    const rows = this.data.filtered(f);
    this.filteredRows.set(rows);
    this.rowCount.set(rows.length);
    this.sum.set(this.agg.sums(rows));
    this.allFiltered.set(rows.length === this.data.rows.length);
    this.view.set(this.buildView());
  }

  setPage(id: string): void {
    this.pageId.set(id);
    this.refresh();
  }

  resetFilters(): void {
    const filters: Record<string, string> = {};
    this.data.SLICERS.forEach(s => { filters[s.key] = 'All'; });
    this.filter.set(filters);
    this.refresh();
  }

  updateFilter(key: string, value: string): void {
    const f = { ...this.filter(), [key]: value };
    // Cascade: reset child when parent changes
    if (key === 'category' && value !== f['subcategory']) {
      f['subcategory'] = 'All';
    }
    if (key === 'country' && value !== f['state']) {
      f['state'] = 'All';
    }
    this.filter.set(f);
    this.refresh();
  }

  setTheme(name: string): void {
    this.theme.set(name as any);
    this.refresh();
  }

  // ---- Card builders ----

  private kpi(label: string, value: string, color: string, hero = false): KPI {
    return { label, value, color, hero };
  }

  private hbarCard(title: string, sub: string, rows: Row[], keyFn: (r: Row) => string | number, valFn: (r: Row) => number, fmt: string, color: string, maxLabel?: number): Card {
    const map = this.agg.groupSum(rows, keyFn, valFn);
    let items = Object.keys(map).map(n => ({ name: n, value: map[n] })).sort((a, b) => b.value - a.value);
    if (maxLabel) items = items.slice(0, maxLabel);
    return { title, sub, type: 'hbar', color, fmt, items };
  }

  private colCard(title: string, sub: string, cats: string[], series: { name: string; color: string; values: number[] }[], fmt: string): Card {
    return { title, sub, type: 'col', fmt, cats, series };
  }

  private lineCard(title: string, sub: string, rows: Row[], keyFn: (r: Row) => string | number, valFns: ((r: Row) => number)[], names: string[], colors: string[], fmt: string): Card {
    const mapped: Record<string, number[]> = {};
    for (const r of rows) {
      const k = String(keyFn(r));
      if (!mapped[k]) { mapped[k] = valFns.map(() => 0); }
      for (let j = 0; j < valFns.length; j++) mapped[k][j] += valFns[j](r);
    }
    const keys = Object.keys(mapped).sort((a, b) => +a - +b);
    const series = valFns.map((_, si) => ({
      name: names[si], color: colors[si], values: keys.map(k => mapped[k][si])
    }));
    return { title, sub, type: 'line', fmt, keys, series };
  }

  private donutCard(title: string, sub: string, rows: Row[], keyFn: (r: Row) => string | number, valFn: (r: Row) => number, fmt: string, keyName: string): Card {
    const map = this.agg.groupSum(rows, keyFn, valFn);
    const segs = this.data.donutSegments(keyName, Object.keys(map).map(n => ({ name: n, value: map[n] })));
    const total = segs.reduce((a, s) => a + s.value, 0);
    return { title, sub, type: 'donut', fmt, segments: segs, total };
  }

  private tableCard(title: string, sub: string, cols: string[], rowsData: (string | number)[][]): Card {
    return { title, sub, type: 'table', cols, rows: rowsData };
  }

  // ---- Table data builders ----

  private productTableData(rows: Row[]): (string | number)[][] {
    const map = this.agg.groupObj(rows,
      r => this.data.dims!.product[r[I.pr]],
      () => ({ s: 0, q: 0, c: 0 }),
      (acc, r) => { acc.s += r[I.sale]; acc.q += r[I.qty]; acc.c += r[I.cost]; }
    );
    return Object.keys(map).map(n => {
      const m = map[n];
      return { n, s: m.s, q: m.q, g: m.s - m.c };
    }).sort((a, b) => b.s - a.s).slice(0, 10)
      .map(it => [it.n, currencyM(it.s), intFmt(it.q), currencyM(it.g)]);
  }

  private prodProfitTableData(rows: Row[]): (string | number)[][] {
    const map = this.agg.groupObj(rows,
      r => this.data.dims!.category[r[I.cat]],
      () => ({ s: 0, q: 0, c: 0 }),
      (acc, r) => { acc.s += r[I.sale]; acc.q += r[I.qty]; acc.c += r[I.cost]; }
    );
    return Object.keys(map).map(n => {
      const m = map[n];
      return { n, s: m.s, q: m.q, g: m.s - m.c };
    }).sort((a, b) => b.s - a.s)
      .map(it => [it.n, currencyM(it.s), intFmt(it.q), currencyM(it.g), pctFmt(it.s ? it.g / it.s : 0)]);
  }

  private storeTableData(rows: Row[]): (string | number)[][] {
    const map = this.agg.groupObj(rows,
      r => this.data.dims!.country[r[I.ct]],
      () => ({ s: 0, q: 0, o: {} as Record<string, boolean>, c: 0 }),
      (acc, r) => { acc.s += r[I.sale]; acc.q += r[I.qty]; acc.o[r[I.O]] = true; acc.c += r[I.cost]; }
    );
    return Object.keys(map).map(n => {
      const m = map[n];
      return { n, s: m.s, o: Object.keys(m.o).length, g: m.s - m.c };
    }).sort((a, b) => b.s - a.s)
      .map(it => [it.n, currencyM(it.s), intFmt(it.o), currencyM(it.g), pctFmt(it.s ? it.g / it.s : 0)]);
  }

  private yearCmpTableData(rows: Row[]): (string | number)[][] {
    const map = this.agg.groupObj(rows,
      r => String(r[I.Y]),
      () => ({ s: 0, c: 0, o: {} as Record<string, boolean> }),
      (acc, r) => { acc.s += r[I.sale]; acc.c += r[I.cost]; acc.o[r[I.O]] = true; }
    );
    const years = Object.keys(map).sort((a, b) => +a - +b);
    return years.map(y => {
      const p = map[String(+y - 1)] ? map[String(+y - 1)].s : 0;
      const d = map[y].s - p;
      return [y, currencyM(map[y].s), currencyM(p), (d >= 0 ? '+' : '') + currencyM(d), p ? pctFmt(d / p) : '—', intFmt(Object.keys(map[y].o).length)];
    });
  }

  // ---- Page view builders ----

  private buildView(): PageView {
    const rows = this.filteredRows();
    const sum = this.sum();

    if (this.pageId() === 'exec') {
      const aov = sum.orders ? sum.sales / sum.orders : 0;
      const margin = sum.sales ? sum.gp / sum.sales : 0;
      return {
        kpis: [
          this.kpi('Total Sales', currencyM(sum.sales), cv('--s1'), true),
          this.kpi('Total Cost', currencyM(sum.cost), cv('--muted')),
          this.kpi('Total Quantity', intFmt(sum.qty), cv('--s5')),
          this.kpi('Gross Profit', currencyM(sum.gp), cv('--s3')),
          this.kpi('Profit Margin %', pctFmt(margin), cv('--s2')),
          this.kpi('Avg Order Value', currencyM(aov), cv('--s7'))
        ],
        gridrows: [
          [
            this.lineCard('Sales Trend', 'Total sales by year', rows, r => r[I.Y], [r => r[I.sale]], ['Total Sales'], [cv('--s1')], 'money'),
            this.hbarCard('Sales by Channel', '', rows, r => this.data.dims!.channel[r[I.ch]], r => r[I.sale], 'money', cv('--s1'))
          ],
          [
            this.hbarCard('Top Countries by Sales', '', rows, r => this.data.dims!.country[r[I.ct]], r => r[I.sale], 'money', cv('--s1'), 9),
            this.donutCard('Sales by Category', '', rows, r => this.data.dims!.category[r[I.cat]], r => r[I.sale], 'money', 'category')
          ],
          [
            this.tableCard('Top Products', 'Best sellers by revenue', ['Product', 'Sales', 'Quantity', 'Gross Profit'], this.productTableData(rows))
          ]
        ]
      };
    }

    if (this.pageId() === 'product') {
      const pmargin = sum.sales ? sum.gp / sum.sales : 0;
      const cats = Array.from(new Set(rows.map(r => this.data.dims!.category[r[I.cat]]))).sort();
      const byCatS = (c: string) => rows.filter(r => this.data.dims!.category[r[I.cat]] === c).reduce((a, r) => a + r[I.sale], 0);
      const byCatG = (c: string) => rows.filter(r => this.data.dims!.category[r[I.cat]] === c).reduce((a, r) => a + r[I.sale] - r[I.cost], 0);
      return {
        kpis: [
          this.kpi('Total Sales', currencyM(sum.sales), cv('--s1'), true),
          this.kpi('Total Quantity', intFmt(sum.qty), cv('--s5')),
          this.kpi('Gross Profit', currencyM(sum.gp), cv('--s3')),
          this.kpi('Profit Margin %', pctFmt(pmargin), cv('--s2'))
        ],
        gridrows: [
          [
            this.colCard('Sales & Profit by Category', '', cats, [
              { name: 'Total Sales', color: cv('--s1'), values: cats.map(byCatS) },
              { name: 'Gross Profit', color: cv('--s3'), values: cats.map(byCatG) }
            ], 'money'),
            this.hbarCard('Sales by Brand', 'Top 10', rows, r => this.data.dims!.brand[r[I.br]], r => r[I.sale], 'money', cv('--s1'), 10)
          ],
          [
            this.donutCard('Sales by Color', '', rows, r => this.data.dims!.color[r[I.col]], r => r[I.sale], 'money', 'color'),
            this.lineCard('Sales Trend', 'Total sales by year', rows, r => r[I.Y], [r => r[I.sale]], ['Total Sales'], [cv('--s1')], 'money')
          ],
          [
            this.tableCard('Product Profitability', 'By category', ['Category', 'Sales', 'Quantity', 'Gross Profit', 'Margin %'], this.prodProfitTableData(rows))
          ]
        ]
      };
    }

    if (this.pageId() === 'store') {
      const countries = Array.from(new Set(rows.map(r => this.data.dims!.country[r[I.ct]]))).sort();
      const byCS = (c: string) => rows.filter(r => this.data.dims!.country[r[I.ct]] === c).reduce((a, r) => a + r[I.sale], 0);
      const byCG = (c: string) => rows.filter(r => this.data.dims!.country[r[I.ct]] === c).reduce((a, r) => a + r[I.sale] - r[I.cost], 0);
      return {
        kpis: [
          this.kpi('Total Sales', currencyM(sum.sales), cv('--s1'), true),
          this.kpi('Total Orders', intFmt(sum.orders), cv('--s5')),
          this.kpi('Active Customers', intFmt(sum.customers), cv('--s7')),
          this.kpi('Gross Profit', currencyM(sum.gp), cv('--s3'))
        ],
        gridrows: [
          [
            this.colCard('Sales & Profit by Country', '', countries, [
              { name: 'Total Sales', color: cv('--s1'), values: countries.map(byCS) },
              { name: 'Gross Profit', color: cv('--s3'), values: countries.map(byCG) }
            ], 'money'),
            this.hbarCard('Sales by Channel', '', rows, r => this.data.dims!.channel[r[I.ch]], r => r[I.sale], 'money', cv('--s1'))
          ],
          [
            this.donutCard('Sales by Store Size', '', rows, r => this.data.dims!.storeSize[r[I.ss]], r => r[I.sale], 'money', 'storeSize'),
            this.hbarCard('Sales by Country', '', rows, r => this.data.dims!.country[r[I.ct]], r => r[I.sale], 'money', cv('--s1'), 9)
          ],
          [
            this.tableCard('Store Performance', 'By country', ['Country', 'Sales', 'Orders', 'Gross Profit', 'Margin %'], this.storeTableData(rows))
          ]
        ]
      };
    }

    // compare
    const years = Array.from(new Set(rows.map(r => r[I.Y]))).sort((a, b) => a - b);
    const maxYear = years.length ? Math.max(...years) : null;
    const totY = this.agg.groupSum(rows, r => r[I.Y], r => r[I.sale]);
    let py = 0;
    if (maxYear && totY[maxYear - 1]) py = totY[maxYear - 1];
    const cur = maxYear ? (totY[maxYear] || 0) : 0;
    const yoy = cur - py;
    const yoyp = py ? yoy / py : 0;
    let ytdGP = 0;
    rows.forEach(r => { if (r[I.Y] === maxYear) ytdGP += r[I.sale] - r[I.cost]; });

    return {
      kpis: [
        this.kpi('Total Sales', currencyM(sum.sales), cv('--s1'), true),
        this.kpi('Sales PY', currencyM(py), cv('--muted')),
        this.kpi('Sales YoY', currencyM(yoy), yoy >= 0 ? cv('--ok') : cv('--s8')),
        this.kpi('Sales YoY %', pctFmt(yoyp), yoyp >= 0 ? cv('--ok') : cv('--s8')),
        this.kpi('Sales YTD', currencyM(cur), cv('--s5')),
        this.kpi('Gross Profit YTD', currencyM(ytdGP), cv('--s3'))
      ],
      gridrows: [
        [
          this.colCard('Sales vs Previous Year', 'By year', years.map(String), [
            { name: 'Total Sales', color: cv('--s1'), values: years.map(y => totY[y] || 0) },
            { name: 'Sales PY', color: cv('--muted'), values: years.map(y => totY[y - 1] || 0) }
          ], 'money'),
          this.lineCard('Sales & Profit Trend', '', rows, r => r[I.Y],
            [r => r[I.sale], r => r[I.sale] - r[I.cost]],
            ['Total Sales', 'Gross Profit'], [cv('--s1'), cv('--s3')], 'money')
        ],
        [
          this.donutCard('Sales by Channel', '', rows, r => this.data.dims!.channel[r[I.ch]], r => r[I.sale], 'money', 'channel'),
          {
            title: 'YoY Growth %', sub: 'By year', type: 'yoy', fmt: 'pct',
            keys: years.map(String),
            values: years.map(y => { const p = totY[y - 1]; return p ? ((totY[y] || 0) - p) / p : null; })
          } as Card
        ],
        [
          this.tableCard('Yearly Sales Comparison', '', ['Year', 'Sales', 'Sales PY', 'YoY', 'YoY %', 'Orders'], this.yearCmpTableData(rows))
        ]
      ]
    };
  }
}
