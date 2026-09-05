class TickBar {
  static TICK_MS = 750;
  static LAST_MS = 1000;
  static SHRINK_MS = 240;

  constructor() {
    this.kind = "";
    this.until = 0;
    this.total = 0;
    this.letters = 0;
    this.shown = 0;
    this.shrink = null;
    this.y = 0;
    this.boxW = 12;
    this.boxH = 7;
    this.gap = 5;
  }

  get active() {
    return !!this.until || !!this.shrink;
  }

  duration(letters) {
    const n = Math.max(1, letters);
    return Math.max(0, n - 1) * TickBar.TICK_MS + TickBar.LAST_MS;
  }

  start(kind, letters) {
    this.kind = kind;
    this.letters = Math.max(1, letters);
    this.total = this.duration(this.letters);
    this.until = Date.now() + this.total;
    this.shown = this.letters;
    this.shrink = null;
  }

  clear() {
    this.kind = "";
    this.until = 0;
    this.total = 0;
    this.shown = 0;
    this.shrink = null;
  }

  remaining() {
    if (!this.until) return 0;
    const left = Math.max(0, this.until - Date.now());
    if (left <= 0) return 0;
    if (left <= TickBar.LAST_MS) return 1;
    return 1 + Math.ceil((left - TickBar.LAST_MS) / TickBar.TICK_MS);
  }

  expired() {
    return this.until && Date.now() >= this.until;
  }

  sync() {
    if (!this.until) return;
    const left = this.remaining();
    if (left < this.shown) {
      this.shrink = { start: Date.now() };
      this.shown = left;
    }
  }

  layout(w, y) {
    const n = Math.max(1, this.letters);
    this.gap = 5;
    this.boxW = Math.max(10, Math.min(18, Math.floor((w * 0.42 - this.gap * (n - 1)) / n)));
    this.boxH = Math.max(8, Math.round(this.boxW * 0.55));
    this.y = y;
  }

  draw(ctx, w, color) {
    if (!this.until && !this.shrink) return;
    let shrink = 0;
    if (this.shrink) {
      const t = (Date.now() - this.shrink.start) / TickBar.SHRINK_MS;
      if (t >= 1) this.shrink = null;
      else shrink = 1 - t * t;
    }
    const live = this.until ? this.remaining() : 0;
    const extra = shrink > 0.02 ? 1 : 0;
    const n = live + extra;
    if (n <= 0) return;
    const total = n * this.boxW + (n - 1) * this.gap;
    let x = w / 2 - total / 2;
    for (let i = 0; i < n; i++) {
      const dying = extra && i === n - 1;
      const sc = dying ? shrink : 1;
      const bw = this.boxW * sc;
      const bh = this.boxH * sc;
      const bx = x + (this.boxW - bw) / 2;
      const by = this.y + (this.boxH - bh) / 2;
      LetterCell.roundRect(ctx, bx, by, Math.max(0.5, bw), Math.max(0.5, bh), 3 * sc);
      ctx.globalAlpha = dying ? Math.max(0.15, sc) : 1;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      x += this.boxW + this.gap;
    }
  }
}
