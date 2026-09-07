import { Component, input, ElementRef, effect } from '@angular/core';
import * as d3 from 'd3';
import { cv, compact, shortLabel, niceMax, ticks as genTicks, fmt as fmtFn } from '../format';
import { TooltipService } from '../tooltip.service';
import { ThemeService } from '../theme.service';

@Component({
  selector: 'app-colchart',
  standalone: true,
  template: `<div #container class="plot"></div>`
})
export class ColchartComponent {
  cats = input<string[]>([]);
  series = input<{ name: string; color: string; values: number[] }[]>([]);
  fmt = input('money');

  private tipHtml = (cat: string, name: string, v: string, col: string) =>
    `<div class="tt-title">${cat}</div><div class="row"><span class="key" style="background:${col}"></span>${name}<span class="tv">${v}</span></div>`;

  constructor(private el: ElementRef, private tip: TooltipService, private theme: ThemeService) {
    effect(() => { this.cats(); this.series(); this.fmt(); this.theme.theme(); this.render(); });
  }

  private render(): void {
    const cont = d3.select(this.el.nativeElement).select('.plot');
    cont.selectAll('*').remove();
    if (!this.cats().length) {
      cont.html('<div style="padding:20px;color:var(--muted)">No data for current filters</div>');
      return;
    }
    const cats = this.cats(), series = this.series();
    const formatter = fmtFn(this.fmt());
    let maxV = 0;
    cats.forEach((_, ci) => series.forEach(s => { maxV = Math.max(maxV, s.values[ci]); }));
    const max = niceMax(maxV);
    const W = 520, H = 240, L = 46, B = 34, T = 10, plotW = W - L - 12, plotH = H - T - B;
    const tw = plotW / cats.length;
    const gw = Math.min(40, tw * 0.58);
    const bw = gw / series.length;
    const gap = 2;
    const grid = cv('--gridline'), muted = cv('--muted'), sec = cv('--secondary');

    const svg = cont.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const g = svg.append('g');

    // Grid + tick labels
    const tickVals = genTicks(max);
    tickVals.forEach(t => {
      const y = T + plotH - (t / max) * plotH;
      g.append('line').attr('x1', L).attr('y1', y).attr('x2', W - 12).attr('y2', y)
        .attr('stroke', grid).attr('stroke-width', 1);
      g.append('text').attr('x', L - 6).attr('y', y + 3)
        .attr('text-anchor', 'end').attr('fill', muted).attr('font-size', 10)
        .text(compact(t));
    });

    // Columns
    cats.forEach((c, ci) => {
      const x = L + ci * tw + (tw - gw) / 2;
      series.forEach((s, si) => {
        const v = s.values[ci];
        const h = (v / max) * plotH;
        const y = T + plotH - h;
        g.append('rect')
          .attr('x', x + si * (bw + gap)).attr('y', y).attr('width', bw).attr('height', Math.max(0, h))
          .attr('rx', 2).attr('fill', s.color)
          .on('mouseenter', (e: MouseEvent) => this.tip.show(e, this.tipHtml(c, s.name, formatter(v), s.color)))
          .on('mousemove', (e: MouseEvent) => this.tip.move(e))
          .on('mouseleave', () => this.tip.hide());
      });
      g.append('text')
        .attr('x', L + ci * tw + tw / 2).attr('y', H - 10)
        .attr('text-anchor', 'middle').attr('fill', sec).attr('font-size', 10)
        .text(shortLabel(c));
    });

    // Legend
    const legend = cont.append('div').attr('class', 'legend');
    series.forEach(s => {
      legend.append('span').attr('class', 'lg')
        .html(`<span class="sw" style="background:${s.color}"></span>${s.name}`);
    });
  }
}
