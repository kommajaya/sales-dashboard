import { Component, input, ElementRef, AfterViewInit, OnDestroy, effect } from '@angular/core';
import * as d3 from 'd3';
import { cv, compact, shortLabel, niceMax, ticks as genTicks, fmt as fmtFn, esc } from '../format';
import { TooltipService } from '../tooltip.service';
import { ThemeService } from '../theme.service';

@Component({
  selector: 'app-linechart',
  standalone: true,
  template: `<div #container class="plot"></div>`
})
export class LinechartComponent implements AfterViewInit, OnDestroy {
  keys = input<string[]>([]);
  series = input<{ name: string; color: string; values: number[] }[]>([]);
  fmt = input('money');

  private rendered = false;

  constructor(private el: ElementRef, private tip: TooltipService, private theme: ThemeService) {
    effect(() => {
      this.keys();
      this.series();
      this.fmt();
      this.theme.theme();
      if (this.rendered) this.render();
    });
  }

  ngAfterViewInit(): void { this.rendered = true; this.render(); }
  ngOnDestroy(): void { this.clear(); }

  private clear(): void {
    d3.select(this.el.nativeElement).select('.plot').selectAll('*').remove();
  }

  private render(): void {
    this.clear();
    const cont = d3.select(this.el.nativeElement).select('.plot');
    if (!this.keys().length) {
      cont.html('<div style="padding:20px;color:var(--muted)">No data for current filters</div>');
      return;
    }
    const keys = this.keys(), series = this.series();
    const formatter = fmtFn(this.fmt());
    let maxV = 0;
    series.forEach(s => s.values.forEach(v => { maxV = Math.max(maxV, v); }));
    const max = niceMax(maxV || 1);
    const W = 520, H = 240, L = 46, B = 32, T = 10, plotW = W - L - 12, plotH = H - T - B;
    const px = (idx: number) => L + (keys.length > 1 ? idx * (plotW / (keys.length - 1)) : plotW / 2);
    const py = (v: number) => T + plotH - (v / max) * plotH;
    const grid = cv('--gridline'), muted = cv('--muted'), sec = cv('--secondary'), baseline = cv('--baseline');

    const svg = cont.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const g = svg.append('g');

    // Grid + ticks
    genTicks(max).forEach(t => {
      const y = py(t);
      g.append('line').attr('x1', L).attr('y1', y).attr('x2', W - 12).attr('y2', y)
        .attr('stroke', grid).attr('stroke-width', 1);
      g.append('text').attr('x', L - 6).attr('y', y + 3)
        .attr('text-anchor', 'end').attr('fill', muted).attr('font-size', 10).text(compact(t));
    });

    // X labels
    keys.forEach((k, i) => {
      g.append('text').attr('x', px(i)).attr('y', H - 8)
        .attr('text-anchor', 'middle').attr('fill', sec).attr('font-size', 10).text(shortLabel(k));
    });

    // Lines
    series.forEach(s => {
      const pathD = s.values.map((v, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1)).join(' ');
      g.append('path').attr('d', pathD).attr('fill', 'none')
        .attr('stroke', s.color).attr('stroke-width', 2)
        .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
      s.values.forEach((v, i) => {
        g.append('circle').attr('cx', px(i)).attr('cy', py(v)).attr('r', 4)
          .attr('fill', s.color).attr('stroke', cv('--surface-1')).attr('stroke-width', 2);
      });
    });

    // Crosshair overlay
    const overlay = g.append('rect')
      .attr('x', L).attr('y', T).attr('width', plotW).attr('height', plotH)
      .attr('fill', 'transparent').style('cursor', 'crosshair');
    const cross = g.append('line')
      .attr('x1', 0).attr('x2', 0).attr('y1', T).attr('y2', T + plotH)
      .attr('stroke', baseline).attr('stroke-width', 1).style('display', 'none');

    overlay.on('mousemove', (event: MouseEvent) => {
      const rect = (event.target as SVGRectElement).getBoundingClientRect();
      const x = event.clientX - rect.left - L;
      let idx = Math.round(x / plotW * (keys.length - 1));
      idx = Math.max(0, Math.min(keys.length - 1, idx));
      const cxp = px(idx);
      cross.attr('x1', cxp).attr('x2', cxp).style('display', 'block');
      let html = `<div class="tt-title">${esc(keys[idx])}</div>`;
      series.forEach(s => {
        const v = s.values[idx];
        html += `<div class="row"><span class="key" style="background:${s.color}"></span>${esc(s.name)}<span class="tv">${v === null ? '—' : formatter(v)}</span></div>`;
      });
      this.tip.show(event, html);
    });
    overlay.on('mouseleave', () => { cross.style('display', 'none'); this.tip.hide(); });

    // Legend
    const legend = cont.append('div').attr('class', 'legend');
    series.forEach(s => {
      legend.append('span').attr('class', 'lg')
        .html(`<span class="sw" style="background:${s.color}"></span>${s.name}`);
    });
  }
}
