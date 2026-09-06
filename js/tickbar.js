class TickBar {
  static TICK_MS = 335;
  static PER_LETTER = 3;
  static SHRINK_MS = 180;

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
    this.gap = 4;
  }

  get active() {
    return !!this.until || !!this.shrink;
  }

  duration(letters) {
    return letters * TickBar.TICK_MS;
  }

  start(kind, letters) {
    this.kind = kind;
    this.letters = letters;
    this.total = this.letters * TickBar.TICK_MS;
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
    return Math.ceil(left / TickBar.TICK_MS);
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
    const n = Math.max(2, this.letters);
    this.gap = 4;
    this.boxW = Math.max(8, Math.min(16, Math.floor((w * 0.4 - this.gap * (n - 1)) / n)));
    this.boxH = Math.max(7, Math.round(this.boxW * 0.7));
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
