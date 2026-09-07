import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TooltipService {
  private el: HTMLElement | null = null;

  private ensure(): HTMLElement {
    if (!this.el) this.el = document.getElementById('tip');
    return this.el!;
  }

  private pos(e: MouseEvent): void {
    const p = 14;
    let x = e.clientX + p;
    let y = e.clientY + p;
    const r = this.ensure().getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 10;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 10;
    this.el!.style.left = x + 'px';
    this.el!.style.top = y + 'px';
  }

  show(e: MouseEvent, html: string): void {
    const t = this.ensure();
    t.innerHTML = html;
    t.style.display = 'block';
    this.pos(e);
  }

  move(e: MouseEvent): void {
    if (this.el && this.el.style.display === 'block') this.pos(e);
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }
}
