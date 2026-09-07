class PlayerPad {
  static PLAYERS = [
    { name: "orange", fill: "#d25a16", lit: "#ff8c3a", score: "#ffc8a0" },
    { name: "blue", fill: "#2b6cb0", lit: "#5aa4ff", score: "#b7d4ff" },
    { name: "yellow", fill: "#d4b22a", lit: "#ffe25a", score: "#ffe7a3" },
    { name: "purple", fill: "#7a3db3", lit: "#b56bff", score: "#e0c2ff" },
  ];
  static HOLD_MS = 500;
  static INSET = 2;

  static spec(index) {
    return PlayerPad.PLAYERS[index];
  }

  static sizeFor(w, h) {
    return Math.max(92, Math.min(148, w * 0.22, h * 0.30));
  }

  static heightFor(size) {
    return Math.round(size * 0.8);
  }

  static spots(count, w, h) {
    const s = PlayerPad.sizeFor(w, h);
    const ph = PlayerPad.heightFor(s);
    const inset = PlayerPad.INSET;
    const topY = inset;
    const botY = h - ph - inset;
    const leftX = inset;
    const rightX = w - s - inset;
    const sideLeftX = inset;
    const sideRightX = w - ph - inset;
    if (count === 2) {
      return [
        { x: leftX, y: botY, rot: 0 },
        { x: rightX, y: botY, rot: 0 },
      ];
    }
    if (count === 3) {
      return [
        { x: leftX, y: botY, rot: 0 },
        { x: rightX, y: botY, rot: 0 },
        { x: sideLeftX, y: topY, rot: 90 },
      ];
    }
    return [
      { x: leftX, y: botY, rot: 0 },
      { x: rightX, y: botY, rot: 0 },
      { x: sideLeftX, y: topY, rot: 90 },
      { x: sideRightX, y: topY, rot: 270 },
    ];
  }

  constructor(index, x, y, size, rot) {
    this.index = index;
    this.rot = rot || 0;
    this.padW = size;
    this.padH = PlayerPad.heightFor(size);
    this.x = x;
    this.y = y;
    if (this.rot === 90 || this.rot === 270) {
      this.w = this.padH;
      this.h = this.padW;
    } else {
      this.w = this.padW;
      this.h = this.padH;
    }
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  draw(ctx, score, locked, lit) {
    const spec = PlayerPad.spec(this.index);
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const pw = this.padW;
    const ph = this.padH;
    const r = Math.max(16, ph * 0.28);
    ctx.save();
    ctx.translate(cx, cy);
    if (this.rot) ctx.rotate(this.rot * Math.PI / 180);
    LetterCell.roundRect(ctx, -pw / 2, -ph / 2, pw, ph, r);
    ctx.fillStyle = locked ? "#2a2a2a" : lit ? spec.lit : spec.fill;
    ctx.fill();
    ctx.strokeStyle = locked ? "#444444" : lit ? "#ffffff" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = lit ? 3 : 1.5;
    ctx.stroke();
    ctx.fillStyle = locked ? "#666666" : spec.score;
    ctx.font = "700 " + Math.round(ph * 0.46) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(score), 0, 1);
    ctx.restore();
  }
}

class PlayerBoard {
  constructor() {
    this.pads = [];
    this.count = 1;
    this.scores = [0, 0, 0, 0];
    this.locked = [false, false, false, false];
    this.buzzAnim = null;
  }

  resetScores() {
    this.scores = [0, 0, 0, 0];
  }

  resetRound() {
    this.locked = [false, false, false, false];
    this.buzzAnim = null;
  }

  remaining() {
    let n = 0;
    for (let i = 0; i < this.count; i++) if (!this.locked[i]) n += 1;
    return n;
  }

  layout(count, w, h) {
    this.count = count;
    this.pads = [];
    if (count < 2) return;
    const s = PlayerPad.sizeFor(w, h);
    const spots = PlayerPad.spots(count, w, h);
    for (let i = 0; i < count; i++) {
      this.pads.push(new PlayerPad(i, spots[i].x, spots[i].y, s, spots[i].rot));
    }
  }

  hit(p) {
    for (let i = 0; i < this.pads.length; i++) {
      if (this.pads[i].contains(p.x, p.y)) return this.pads[i];
    }
    return null;
  }

  startBuzz(index) {
    this.buzzAnim = { player: index, start: Date.now() };
  }

  isLit(index) {
    return !!(this.buzzAnim && this.buzzAnim.player === index);
  }

  buzzDone() {
    return this.buzzAnim && Date.now() - this.buzzAnim.start >= PlayerPad.HOLD_MS;
  }

  draw(ctx) {
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      pad.draw(ctx, this.scores[pad.index], this.locked[pad.index], this.isLit(pad.index));
    }
  }
}
