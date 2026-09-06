class LetterCell {
  static STYLES = {
    idle: {
      letterColor: "#8a8a8a",
      borderColor: "#6a6a6a",
      fillColor: "rgba(255,255,255,0.03)",
    },
    used: {
      letterColor: "#8a8a8a",
      borderColor: "#3f3f3f",
      fillColor: "rgba(255,255,255,0.03)",
    },
    selected: {
      letterColor: "#ffffff",
      borderColor: "#d8d8d8",
      fillColor: "rgba(255,255,255,0.08)",
    },
    revealed: {
      letterColor: "#8ecbff",
      borderColor: "#5a92c4",
      fillColor: "rgba(142,203,255,0.08)",
    },
    correct: {
      letterColor: "#7dffa3",
      borderColor: "#4d8f64",
      fillColor: "rgba(125,255,163,0.08)",
    },
    wrong: {
      letterColor: "#ff6b6b",
      borderColor: "#8f4d4d",
      fillColor: "rgba(255,107,107,0.08)",
    },
  };

  constructor(letter, x, y, size, options) {
    options = options || {};
    this.letter = letter || "";
    this.x = x;
    this.y = y;
    this.size = size;
    this.lineWidth = options.lineWidth == null ? 1.25 : options.lineWidth;
    this.radius = options.radius == null ? size * 0.12 : options.radius;
    this.fontFamily = options.fontFamily || "system-ui, sans-serif";
    this.fontWeight = options.fontWeight || "700";
    this.mode = options.mode || "idle";
    this.setStyle(LetterCell.STYLES[this.mode]);
    if (options.letterColor) this.letterColor = options.letterColor;
    if (options.borderColor) this.borderColor = options.borderColor;
    if (options.fillColor) this.fillColor = options.fillColor;
  }

  setLetter(letter) {
    this.letter = letter || "";
  }

  setMode(mode) {
    this.mode = mode;
    this.setStyle(LetterCell.STYLES[mode] || LetterCell.STYLES.idle);
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

    const fontSize = Math.floor(this.size * 0.9);
    ctx.fillStyle = this.letterColor;
    ctx.font = this.fontWeight + " " + fontSize + "px " + this.fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.letter, this.centerX, this.centerY + this.size * 0.015);
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
    const n = Math.max(letters.length, options && options.count ? options.count : 0);
    if (!n) return [];
    const total = n * size + (n - 1) * gap;
    const x0 = centerX - total / 2;
    const y0 = centerY - size / 2;
    const cells = [];
    for (let i = 0; i < n; i++) {
      cells.push(new LetterCell(letters[i] || "", x0 + i * (size + gap), y0, size, options));
    }
    return cells;
  }
}
