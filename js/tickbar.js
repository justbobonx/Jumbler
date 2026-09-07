class TickBar {
  static TICK_MS = 335;

  constructor() {
    this.kind = "";
    this.until = 0;
    this.holdUntil = 0;
    this.total = 0;
    this.letters = 0;
    this.y = 0;
    this.boxW = 12;
    this.boxH = 7;
    this.gap = 4;
  }

  get active() {
    return !!this.until;
  }

  start(kind, ticks) {
    this.kind = kind;
    this.letters = ticks;
    this.total = this.letters * TickBar.TICK_MS;
    this.holdUntil = Date.now() + TickBar.TICK_MS;
    this.until = this.holdUntil + this.total;
  }

  startGuess(wordLen) {
    this.start("guess", wordLen * 2);
  }

  startLast(wordLen, remaining) {
    this.start("last", wordLen * remaining);
  }

  clear() {
    this.kind = "";
    this.until = 0;
    this.holdUntil = 0;
    this.total = 0;
  }

  remaining() {
    if (!this.until) return 0;
    if (this.holdUntil && Date.now() < this.holdUntil) return this.letters;
    const left = Math.max(0, this.until - Date.now());
    if (left <= 0) return 0;
    return Math.ceil(left / TickBar.TICK_MS);
  }

  expired() {
    return this.until && Date.now() >= this.until;
  }

  layout(w, y) {
    const n = Math.max(2, this.letters);
    this.gap = 4;
    this.boxW = Math.max(8, Math.min(16, Math.floor((w * 0.4 - this.gap * (n - 1)) / n)));
    this.boxH = Math.max(7, Math.round(this.boxW * 0.7));
    this.y = y;
  }

  placeUnderWord(w, wordLen, wordBottomY) {
    if (!this.letters) this.letters = wordLen;
    this.layout(w, wordBottomY + 14);
  }

  colorFor(playerColor) {
    if (this.kind === "last") return "#f2f2f2";
    return playerColor || "#f2f2f2";
  }

  draw(ctx, w, color) {
    if (!this.until) return;
    const n = this.remaining();
    if (n <= 0) return;
    const fill = color || this.colorFor();
    const total = n * this.boxW + (n - 1) * this.gap;
    let x = w / 2 - total / 2;
    for (let i = 0; i < n; i++) {
      LetterCell.roundRect(ctx, x, this.y, this.boxW, this.boxH, 3);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1;
      ctx.stroke();
      x += this.boxW + this.gap;
    }
  }
}
