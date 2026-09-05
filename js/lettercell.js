class LetterCell {
  constructor(letter, x, y, size, options) {
    options = options || {};
    this.letter = letter || "";
    this.x = x;
    this.y = y;
    this.size = size;
    this.letterColor = options.letterColor || "#f2f2f2";
    this.borderColor = options.borderColor || "#8a8a8a";
    this.fillColor = options.fillColor || "rgba(255,255,255,0.03)";
    this.lineWidth = options.lineWidth == null ? 1.25 : options.lineWidth;
    this.radius = options.radius == null ? size * 0.16 : options.radius;
    this.fontFamily = options.fontFamily || "system-ui, sans-serif";
    this.fontWeight = options.fontWeight || "700";
  }

  setLetter(letter) {
    this.letter = letter || "";
  }

  setStyle(options) {
    if (!options) return;
    if (options.letterColor) this.letterColor = options.letterColor;
    if (options.borderColor) this.borderColor = options.borderColor;
    if (options.fillColor) this.fillColor = options.fillColor;
    if (options.lineWidth != null) this.lineWidth = options.lineWidth;
    if (options.radius != null) this.radius = options.radius;
  }

  get centerX() {
    return this.x + this.size / 2;
  }

  get centerY() {
    return this.y + this.size / 2;
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.size && py >= this.y && py <= this.y + this.size;
  }

  draw(ctx) {
    const r = Math.min(this.radius, this.size / 2);
    LetterCell.roundRect(ctx, this.x, this.y, this.size, this.size, r);
    ctx.fillStyle = this.fillColor;
    ctx.fill();
    ctx.strokeStyle = this.borderColor;
    ctx.lineWidth = this.lineWidth;
    ctx.stroke();

    if (!this.letter) return;

    const fontSize = Math.floor(this.size * 0.62);
    ctx.fillStyle = this.letterColor;
    ctx.font = this.fontWeight + " " + fontSize + "px " + this.fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.letter, this.centerX, this.centerY + this.size * 0.02);
  }

  static roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  static row(word, centerX, centerY, size, gap, options) {
    const letters = String(word).split("");
    const n = letters.length;
    if (!n) return [];
    const total = n * size + (n - 1) * gap;
    const x0 = centerX - total / 2;
    const y0 = centerY - size / 2;
    const cells = [];
    for (let i = 0; i < n; i++) {
      cells.push(new LetterCell(letters[i], x0 + i * (size + gap), y0, size, options));
    }
    return cells;
  }
}
