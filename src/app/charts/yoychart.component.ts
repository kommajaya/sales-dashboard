import { Component, input, ElementRef, AfterViewInit, effect } from '@angular/core';
import * as d3 from 'd3';
import { cv, compact, shortLabel, niceMax, fmt as fmtFn, esc } from '../format';
import { TooltipService } from '../tooltip.service';
import { ThemeService } from '../theme.service';

@Component({
  selector: 'app-yoychart',
  standalone: true,
  template: `<div #container class="plot"></div>`
})
export class YoychartComponent implements AfterViewInit {
  keys = input<string[]>([]);
  values = input<(number | null)[]>([]);
  fmt = input('pct');

  private rendered = false;

  constructor(private el: ElementRef, private tip: TooltipService, private theme: ThemeService) {
    effect(() => {
      this.keys();
      this.values();
      this.fmt();
      this.theme.theme();
      if (this.rendered) this.render();
    });
  }

  ngAfterViewInit(): void { this.rendered = true; this.render(); }

  private render(): void {
    const cont = d3.select(this.el.nativeElement).select('.plot');
    cont.selectAll('*').remove();
    if (!this.keys().length) {
      cont.html('<div style="padding:20px;color:var(--muted)">No data for current filters</div>');
      return;
    }
    const keys = this.keys(), vals = this.values();
    const formatter = fmtFn(this.fmt());
    const clean = vals.filter(v => v !== null && v !== undefined && isFinite(v!)) as number[];
    let mx = 0;
    clean.forEach(v => { mx = Math.max(mx, Math.abs(v)); });
    const max = niceMax(mx || 1);
    const W = 520, H = 240, L = 46, B = 32, T = 10, plotW = W - L - 12, plotH = H - T - B;
    const px = (i: number) => L + (keys.length > 1 ? i * (plotW / (keys.length - 1)) : plotW / 2);
    const py = (v: number) => T + plotH - (v / max + 1) / 2 * plotH;
    const mid = py(0);
    const grid = cv('--gridline'), muted = cv('--muted'), sec = cv('--secondary'), baseline = cv('--baseline');
    const color = cv('--s2'), surface = cv('--surface-1');

    const svg = cont.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const g = svg.append('g');

    // Zero baseline
    g.append('line').attr('x1', L).attr('y1', mid).attr('x2', W - 12).attr('y2', mid)
      .attr('stroke', baseline).attr('stroke-width', 1);
    g.append('text').attr('x', L - 6).attr('y', mid + 3)
      .attr('text-anchor', 'end').attr('fill', muted).attr('font-size', 10).text('0');

    // Grid
    [max, -max].forEach(t => {
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

    // Path
    let pathD = '';
    vals.forEach((v, i) => {
      if (v === null || v === undefined || !isFinite(v)) return;
      pathD += (pathD ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1);
    });
    if (pathD) {
      g.append('path').attr('d', pathD).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', 2)
        .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
    }

    // Points
    vals.forEach((v, i) => {
      if (v === null || v === undefined || !isFinite(v)) return;
      g.append('circle').attr('cx', px(i)).attr('cy', py(v)).attr('r', 4)
        .attr('fill', color).attr('stroke', surface).attr('stroke-width', 2);
    });

    // Crosshair
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
      const v = vals[idx];
      const html = `<div class="tt-title">${esc(keys[idx])}</div>` +
        `<div class="row"><span class="key" style="background:${color}"></span>YoY %<span class="tv">${v === null ? '—' : formatter(v)}</span></div>`;
      this.tip.show(event, html);
    });
    overlay.on('mouseleave', () => { cross.style('display', 'none'); this.tip.hide(); });
  }
}
