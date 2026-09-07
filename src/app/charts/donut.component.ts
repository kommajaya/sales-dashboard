import { Component, input, ElementRef, effect } from '@angular/core';
import * as d3 from 'd3';
import { cv, compact, fmt as fmtFn } from '../format';
import { TooltipService } from '../tooltip.service';
import { ThemeService } from '../theme.service';

@Component({
  selector: 'app-donut',
  standalone: true,
  template: `<div #container class="plot"></div>`
})
export class DonutComponent {
  segments = input<{ name: string; value: number; color: string }[]>([]);
  total = input(0);
  fmt = input('money');

  private tipHtml = (cat: string, val: string) =>
    `<div class="tt-title">${cat}</div><div class="tv">${val}</div>`;

  constructor(private el: ElementRef, private tip: TooltipService, private theme: ThemeService) {
    effect(() => { this.segments(); this.total(); this.fmt(); this.theme.theme(); this.render(); });
  }

  private render(): void {
    const segments = this.segments();
    const cont = d3.select(this.el.nativeElement).select('.plot');
    cont.selectAll('*').remove();
    if (!segments.length) {
      cont.html('<div style="padding:20px;color:var(--muted)">No data for current filters</div>');
      return;
    }
    const total = this.total();
    const formatter = fmtFn(this.fmt());
    const W = 300, H = 225, cx = 150, cy = 100, r = 78, ir = 50;
    const surface = cv('--surface-1'), primary = cv('--primary'), muted = cv('--muted');

    const svg = cont.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const g = svg.append('g');

    let a0 = -Math.PI / 2;
    const arc = d3.arc<{ value: number }>()
      .innerRadius(ir)
      .outerRadius(r)
      .padAngle(0.01)
      .cornerRadius(3);

    segments.forEach(se => {
      const frac = se.value / total;
      const a1 = a0 + frac * Math.PI * 2;

      // Manual arc path (matching original)
      const large = frac > 0.5 ? 1 : 0;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const xi0 = cx + ir * Math.cos(a1), yi0 = cy + ir * Math.sin(a1);
      const xi1 = cx + ir * Math.cos(a1 + 0.001), yi1 = cy + ir * Math.sin(a1 + 0.001);
      const xi1b = cx + ir * Math.cos(a0), yi1b = cy + ir * Math.sin(a0);
      const d = `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${xi0.toFixed(1)} ${yi0.toFixed(1)} A${ir} ${ir} 0 ${large} 0 ${xi1b.toFixed(1)} ${yi1b.toFixed(1)} Z`;

      g.append('path').attr('d', d).attr('fill', se.color)
        .attr('stroke', surface).attr('stroke-width', 1.5)
        .on('mouseenter', (e: MouseEvent) => this.tip.show(e, this.tipHtml(se.name, formatter(se.value))))
        .on('mousemove', (e: MouseEvent) => this.tip.move(e))
        .on('mouseleave', () => this.tip.hide());

      a0 = a1;
    });

    // Center text
    g.append('text').attr('x', 150).attr('y', cy - 2)
      .attr('text-anchor', 'middle').attr('fill', primary)
      .attr('font-size', 18).attr('font-weight', 650).text(compact(total));
    g.append('text').attr('x', 150).attr('y', cy + 16)
      .attr('text-anchor', 'middle').attr('fill', muted)
      .attr('font-size', 11).text('total');

    // Legend
    const legend = cont.append('div').attr('class', 'legend');
    segments.forEach(se => {
      legend.append('span').attr('class', 'lg')
        .html(`<span class="sw" style="background:${se.color}"></span>${se.name} &middot; ${formatter(se.value)}`);
    });
  }
}
