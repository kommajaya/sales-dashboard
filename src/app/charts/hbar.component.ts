import { Component, input, ElementRef, OnDestroy, effect } from '@angular/core';
import * as d3 from 'd3';
import { cv, compact, shortLabel, niceMax } from '../format';
import { TooltipService } from '../tooltip.service';
import { ThemeService } from '../theme.service';

@Component({
  selector: 'app-hbar',
  standalone: true,
  template: `<div #container class="plot"></div>`
})
export class HbarComponent implements OnDestroy {
  items = input<{ name: string; value: number }[]>([]);
  color = input('');
  fmt = input('money');

  private tipHtml = (cat: string, val: string) =>
    `<div class="tt-title">${cat}</div><div class="tv">${val}</div>`;

  constructor(private el: ElementRef, private tip: TooltipService, private theme: ThemeService) {
    effect(() => {
      this.items();
      this.color();
      this.fmt();
      this.theme.theme();
      this.render();
    });
  }

  ngOnDestroy(): void { this.clear(); }

  private clear(): void {
    d3.select(this.el.nativeElement).select('.plot').selectAll('*').remove();
  }

  private render(): void {
    this.clear();
    const items = this.items();
    if (!items.length) {
      d3.select(this.el.nativeElement).select('.plot')
        .html('<div style="padding:20px;color:var(--muted)">No data for current filters</div>');
      return;
    }
    const fmt = this.fmt();
    const fmtFn = (n: number) => {
      if (fmt === 'money') return '$' + compact(n);
      if (fmt === 'pct') return (n * 100).toFixed(2) + '%';
      return Math.round(n).toLocaleString('en-US');
    };
    const max = niceMax(items[0].value);
    const W = 480;
    const L = Math.min(150, Math.max(88, items.reduce((a, it) => Math.max(a, it.name.length * 6), 0)));
    const R = W - L - 60;
    const barH = 10, gap = 5;
    const H = 16 * items.length + 22;
    const nameColor = cv('--secondary');
    const valColor = cv('--muted');
    const barColor = this.color() || cv('--s1');

    const svg = d3.select(this.el.nativeElement).select('.plot')
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('role', 'img');

    const g = svg.append('g');

    items.forEach((it, idx) => {
      const y = 14 + idx * (barH + gap);
      const w = (it.value / max) * R;

      g.append('rect')
        .attr('x', L).attr('y', y).attr('width', w).attr('height', barH)
        .attr('rx', 5).attr('fill', barColor)
        .on('mouseenter', (e: MouseEvent) => this.tip.show(e, this.tipHtml(it.name, fmtFn(it.value))))
        .on('mousemove', (e: MouseEvent) => this.tip.move(e))
        .on('mouseleave', () => this.tip.hide());

      g.append('text')
        .attr('x', L - 6).attr('y', y + barH - 2)
        .attr('text-anchor', 'end').attr('fill', nameColor).attr('font-size', 11)
        .text(shortLabel(it.name));

      g.append('text')
        .attr('x', L + w + 5).attr('y', y + barH - 2)
        .attr('fill', valColor).attr('font-size', 11)
        .text(fmtFn(it.value));
    });
  }
}
