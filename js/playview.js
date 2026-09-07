class PlayView {
  static LABELS = { reveal: "GIVE UP", start: "NEW GAME", continue: "CONTINUE" };

  constructor(chrome, board, ticks) {
    this.chrome = chrome;
    this.board = board;
    this.ticks = ticks;
    this.sourceCells = [];
    this.guessCells = [];
    this.titleCells = [];
    this.extraText = [];
    this.extraY = 0;
    this.extraSize = 16;
    this.hintY = 0;
    this.buttons = [];
    this.stepper = [];
  }

  creditEl() {
    return document.getElementById("startEmail");
  }

  hideCredit() {
    const el = this.creditEl();
    if (el) el.classList.remove("show");
  }

  placeCredit(y) {
    const el = this.creditEl();
    if (!el) return;
    el.classList.add("show");
    el.style.top = Math.round(y + 10) + "px";
    el.style.left = "50%";
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (let i = 0; i < words.length; i++) {
      const next = current ? current + "   " + words[i] : words[i];
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current);
        current = words[i];
      } else current = next;
    }
    if (current) lines.push(current);
    return lines;
  }

  buttonLabel(id) {
    return PlayView.LABELS[id] || id.toUpperCase();
  }

  placeButtons(ids, w, h) {
    const btnW = Math.max(100, Math.min(160, w * 0.28));
    const btnH = Math.max(36, Math.min(44, h * 0.06));
    const gap = 12;
    const total = ids.length * btnW + (ids.length - 1) * gap;
    let x = w / 2 - total / 2;
    const y = h - btnH - 24;
    for (let i = 0; i < ids.length; i++) {
      this.buttons.push({ id: ids[i], label: this.buttonLabel(ids[i]), x: x, y: y, w: btnW, h: btnH });
      x += btnW + gap;
    }
  }

  addTitleButton(id, w, y, btnW, btnH) {
    this.buttons.push({ id: id, label: this.buttonLabel(id), x: w / 2 - btnW / 2, y: y, w: btnW, h: btnH });
    return y + btnH + 12;
  }

  layoutStepper(ctx, play, w, h, titleBottom) {
    this.stepper = [];
    const box = Math.max(36, Math.min(44, h * 0.06));
    const label = play.playerCount === 1 ? "1 player" : play.playerCount + " players";
    ctx.font = "600 16px system-ui, sans-serif";
    const labelW = Math.max(110, ctx.measureText(label).width + 16);
    const gap = 12;
    const total = box + gap + labelW + gap + box;
    let x = w / 2 - total / 2;
    const y = titleBottom + 28;
    this.stepper.push({ id: "minus", x: x, y: y, w: box, h: box });
    x += box + gap;
    this.stepper.push({ id: "label", x: x, y: y, w: labelW, h: box });
    x += labelW + gap;
    this.stepper.push({ id: "plus", x: x, y: y, w: box, h: box });
    return y + box;
  }

  layoutTitle(ctx, play) {
    const sizeV = this.chrome.viewSize();
    const w = sizeV.w, h = sizeV.h;
    const size = LetterCell.sizeFor(7, w * 0.9, Math.min(w, h) * 0.18);
    const gap = Math.max(5, Math.round(size * 0.08));
    const titleY = h * 0.30;
    this.titleCells = LetterCell.row("JUMBLER", w / 2, titleY, size, gap, { mode: "revealed" });
    let y = this.layoutStepper(ctx, play, w, h, titleY + size / 2) + 22;
    const btnW = Math.max(120, Math.min(168, w * 0.32));
    const btnH = Math.max(36, Math.min(44, h * 0.06));
    if (GameSave.exists()) y = this.addTitleButton("continue", w, y, btnW, btnH);
    y = this.addTitleButton("start", w, y, btnW, btnH);
    this.placeCredit(y);
  }

  layout(ctx, play) {
    this.sourceCells = [];
    this.guessCells = [];
    this.titleCells = [];
    this.extraText = [];
    this.buttons = [];
    this.stepper = [];
    this.board.pads = [];
    this.hideCredit();
    if (play.phase === "loading" || play.phase === "error") return;
    if (play.phase === "title") {
      this.layoutTitle(ctx, play);
      return;
    }
    const sizeV = this.chrome.viewSize();
    const w = sizeV.w, h = sizeV.h, n = play.jumble.length;
    const buzzing = play.isMulti() && play.phase === "buzz";
    const maxWidth = Math.min(w * 0.94, Math.max(120, w - 32));
    const extras = play.extrasForDisplay();
    const showExtras = (play.phase === "correct" || play.phase === "revealed") && extras.length;
    const showGuess = !buzzing;
    const mainSize = LetterCell.sizeFor(n, maxWidth, Math.min(w, h) * 0.24);
    const mainGap = LetterCell.gapFor(mainSize, 0.06);
    const mainY = showExtras ? h * 0.46 : h * 0.52;
    this.sourceCells = LetterCell.row(play.bigWord(), w / 2, mainY, mainSize, mainGap);
    this.ticks.placeUnderWord(w, n, mainY + mainSize * 0.5);
    if (showGuess) {
      const guessSize = LetterCell.sizeFor(n, maxWidth * 0.72, Math.min(w, h) * 0.1);
      const guessGap = LetterCell.gapFor(guessSize, 0.08);
      const hintSpace = Math.max(26, guessSize * 0.7);
      const guessY = mainY - mainSize * 0.5 - hintSpace - guessSize * 0.5;
      this.guessCells = LetterCell.row("", w / 2, guessY, guessSize, guessGap, { count: n });
      this.hintY = (guessY + guessSize / 2 + mainY - mainSize / 2) / 2;
    } else this.hintY = mainY - mainSize * 0.5 - 22;
    if (showExtras) {
      const fontSize = Math.max(16, Math.min(w, h) * 0.034);
      ctx.font = "500 " + fontSize + "px system-ui, sans-serif";
      this.extraText = this.wrapText(ctx, extras.join(" "), w * 0.86);
      this.extraY = this.ticks.y + this.ticks.boxH + fontSize * 1.1;
      this.extraSize = fontSize;
    }
    if (buzzing) {
      this.board.layout(play.playerCount, w, h);
      this.placeButtons(["reveal"], w, h);
    } else if (play.phase === "play" || play.phase === "wrong") this.placeButtons(["reset", "reveal"], w, h);
    else if (play.phase === "correct") this.placeButtons(play.isMulti() ? ["next"] : ["reveal", "next"], w, h);
    else if (play.phase === "revealed") this.placeButtons(["next"], w, h);
    this.syncCells(play);
  }

  syncCells(play) {
    const done = play.solvedMode();
    LetterCell.syncSource(this.sourceCells, play.picked, play.phase, done);
    LetterCell.syncGuess(this.guessCells, play.guess, play.phase, done);
  }

  hitBox(p, b) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  hitButton(p) {
    for (let i = 0; i < this.buttons.length; i++) if (this.hitBox(p, this.buttons[i])) return this.buttons[i];
    return null;
  }

  hitStepper(p) {
    for (let i = 0; i < this.stepper.length; i++) {
      if (this.hitBox(p, this.stepper[i])) return this.stepper[i];
    }
    return null;
  }

  hitGuess(p) {
    return LetterCell.hitIndex(this.guessCells, p);
  }

  hitSource(p) {
    return LetterCell.hitIndex(this.sourceCells, p);
  }

  sourceLetter(index) {
    return this.sourceCells[index] ? this.sourceCells[index].letter : "";
  }

  drawButton(ctx, btn) {
    LetterCell.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fill();
    ctx.strokeStyle = "#888888"; ctx.lineWidth = 1.25; ctx.stroke();
    ctx.fillStyle = "#d0d0d0"; ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }

  drawStepper(ctx, play) {
    for (let i = 0; i < this.stepper.length; i++) {
      const s = this.stepper[i];
      if (s.id === "label") {
        ctx.fillStyle = "#d0d0d0"; ctx.font = "600 16px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(play.playerCount === 1 ? "1 player" : play.playerCount + " players", s.x + s.w / 2, s.y + s.h / 2 + 1);
        continue;
      }
      LetterCell.roundRect(ctx, s.x, s.y, s.w, s.h, 10);
      ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fill();
      ctx.strokeStyle = "#888888"; ctx.lineWidth = 1.25; ctx.stroke();
      ctx.fillStyle = "#d0d0d0"; ctx.font = "700 20px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(s.id === "minus" ? "\u2212" : "+", s.x + s.w / 2, s.y + s.h / 2 + 1);
    }
  }

  drawScore(ctx, play, w, h) {
    if (play.isMulti()) return;
    const y = 28;
    const fontSize = Math.max(14, Math.min(w, h) * 0.028);
    ctx.font = "600 " + fontSize + "px system-ui, sans-serif";
    ctx.textBaseline = "top";
    const gap = Math.max(28, w * 0.06);
    const items = [
      { label: "RIGHT", value: String(play.rights), color: "#7dffa3" },
      { label: "WRONG", value: String(play.wrongs), color: "#ff6b6b" },
      { label: "SCORE", value: String(play.score), color: "#f2f2f2" },
      { label: "HI", value: String(play.hiScore), color: "#f2d36b" },
    ];
    const parts = items.map((item) => item.label + "  " + item.value);
    const widths = parts.map((part) => ctx.measureText(part).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    let x = w / 2 - total / 2;
    for (let i = 0; i < items.length; i++) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#777777";
      ctx.fillText(items[i].label, x, y);
      const labelW = ctx.measureText(items[i].label + "  ").width;
      ctx.fillStyle = items[i].color;
      ctx.fillText(items[i].value, x + labelW, y);
      x += widths[i] + gap;
    }
  }

  hintColor(play) {
    if (play.phase === "wrong" || (play.lastResult === "wrong" && play.phase === "revealed")) return "#ff6b6b";
    if (play.phase === "correct" || (play.lastResult === "right" && play.phase === "revealed")) return "#7dffa3";
    if (play.isMulti() && play.activePlayer >= 0) return PlayerPad.spec(play.activePlayer).fill;
    if (this.board.buzzAnim) return PlayerPad.spec(this.board.buzzAnim.player).fill;
    return "#666666";
  }

  draw(ctx, play) {
    const sizeV = this.chrome.viewSize();
    const w = sizeV.w, h = sizeV.h;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, w, h);
    if (play.phase === "loading" || play.phase === "error") {
      ctx.fillStyle = "#f2f2f2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 " + Math.max(18, Math.min(w, h) * 0.045) + "px system-ui, sans-serif";
      ctx.fillText(play.message, w / 2, h / 2);
      return;
    }
    if (play.phase === "title") {
      LetterCell.paint(ctx, this.titleCells);
      this.drawStepper(ctx, play);
      for (let i = 0; i < this.buttons.length; i++) this.drawButton(ctx, this.buttons[i]);
      ctx.fillStyle = "#666666";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.font = "500 " + Math.max(11, Math.min(w, h) * 0.022) + "px system-ui, sans-serif";
      ctx.fillText("v" + play.version, w - 16, h - 14);
      return;
    }
    this.drawScore(ctx, play, w, h);
    LetterCell.paint(ctx, this.guessCells);
    const hint = play.hintText();
    if (hint) {
      ctx.fillStyle = this.hintColor(play);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "500 " + Math.max(12, Math.min(w, h) * 0.024) + "px system-ui, sans-serif";
      ctx.fillText(hint, w / 2, this.hintY);
    }
    LetterCell.paint(ctx, this.sourceCells);
    const playerColor = play.activePlayer >= 0 ? PlayerPad.spec(play.activePlayer).fill : "";
    this.ticks.draw(ctx, w, this.ticks.colorFor(playerColor));
    this.board.draw(ctx);
    if (this.extraText.length) {
      ctx.fillStyle = "#b0b0b0";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "500 " + this.extraSize + "px system-ui, sans-serif";
      const lineH = this.extraSize * 1.35;
      for (let i = 0; i < this.extraText.length; i++) ctx.fillText(this.extraText[i], w / 2, this.extraY + i * lineH);
    }
    for (let i = 0; i < this.buttons.length; i++) this.drawButton(ctx, this.buttons[i]);
  }
}
