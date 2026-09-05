class PlayerPad {
  static PLAYERS = [
    { name: "red", fill: "#c23b3b", score: "#ffb4b4" },
    { name: "blue", fill: "#2b6cb0", score: "#b7d4ff" },
    { name: "yellow", fill: "#d4b22a", score: "#ffe7a3" },
    { name: "purple", fill: "#7a3db3", score: "#e0c2ff" },
  ];
  static ANIM_MS = 250;
  static HOLD_MS = 500;
  static INSET = 2;

  static spec(index) {
    return PlayerPad.PLAYERS[index];
  }

  static sizeFor(w, h) {
    return Math.max(92, Math.min(148, w * 0.22, h * 0.30));
  }

  static spots(count, w, h) {
    const s = PlayerPad.sizeFor(w, h);
    const inset = PlayerPad.INSET;
    const topY = inset;
    const botY = h - s - inset;
    const leftX = inset;
    const rightX = w - s - inset;
    const midX = w / 2 - s / 2;
    if (count === 2) {
      return [
        { x: leftX, y: botY },
        { x: rightX, y: botY },
      ];
    }
    if (count === 3) {
      return [
        { x: leftX, y: botY },
        { x: rightX, y: botY },
        { x: midX, y: topY },
      ];
    }
    return [
      { x: leftX, y: botY },
      { x: rightX, y: botY },
      { x: leftX, y: topY },
      { x: rightX, y: topY },
    ];
  }

  constructor(index, x, y, size) {
    this.index = index;
    this.x = x;
    this.y = y;
    this.w = size;
    this.h = size;
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  draw(ctx, score, locked, scale) {
    const spec = PlayerPad.spec(this.index);
    const sc = scale || 1;
    const glowing = sc > 1;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    const r = Math.max(18, this.w * 0.26);
    if (glowing) {
      ctx.shadowColor = spec.fill;
      ctx.shadowBlur = 28 + 22 * (sc - 1);
    }
    LetterCell.roundRect(ctx, this.x, this.y, this.w, this.h, r);
    ctx.fillStyle = locked ? "#2a2a2a" : spec.fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = locked ? "#444444" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = locked ? "#666666" : spec.score;
    ctx.font = "700 " + Math.round(this.h * 0.42) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(score), cx, cy + 1);
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
      this.pads.push(new PlayerPad(i, spots[i].x, spots[i].y, s));
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

  buzzScale(index) {
    if (!this.buzzAnim || this.buzzAnim.player !== index) return 1;
    const t = Math.min(1, (Date.now() - this.buzzAnim.start) / PlayerPad.ANIM_MS);
    const ease = 1 - Math.pow(1 - t, 3);
    return 1 + 0.38 * ease;
  }

  buzzDone() {
    return this.buzzAnim && Date.now() - this.buzzAnim.start >= PlayerPad.HOLD_MS;
  }

  draw(ctx) {
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      pad.draw(ctx, this.scores[pad.index], this.locked[pad.index], this.buzzScale(pad.index));
    }
  }
}
