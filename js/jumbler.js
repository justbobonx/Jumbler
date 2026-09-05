(() => {
  const WORD_LENS = [5, 6, 7, 8];
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  const state = {
    lines: [],
    groups: Object.create(null),
    word: "",
    jumble: "",
    answers: [],
    others: [],
    phase: "loading",
    message: "loading letters…",
    picked: [],
    guess: "",
    sourceCells: [],
    guessCells: [],
    extraText: [],
    extraY: 0,
    extraSize: 16,
    hintY: 0,
    buttons: [],
    rights: 0,
    wrongs: 0,
    score: 0,
    lastResult: "",
  };

  function signature(word) {
    return word.toLowerCase().split("").sort().join("");
  }

  function answersOf(word) {
    const key = word.length + ":" + signature(word);
    return (state.groups[key] || [word]).slice();
  }

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    draw();
  }

  function parseLetters(text) {
    const raw = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
    const lines = [];
    const groups = Object.create(null);

    for (let i = 0; i < WORD_LENS.length; i++) {
      const line = (raw[i] || "").replace(/\s+/g, "");
      const len = WORD_LENS[i];
      if (line.length < len || line.length % len !== 0) {
        throw new Error("line " + (i + 1) + " is not a clean pack of " + len + "-letter words");
      }
      lines.push(line);

      const seen = Object.create(null);
      for (let pos = 0; pos < line.length; pos += len) {
        const word = line.substr(pos, len).toUpperCase();
        if (seen[word]) continue;
        seen[word] = true;
        const key = len + ":" + signature(word);
        if (!groups[key]) groups[key] = [];
        groups[key].push(word);
      }
    }

    for (const key in groups) groups[key].sort();
    return { lines, groups };
  }

  function pickWord() {
    const lineIndex = Math.floor(Math.random() * WORD_LENS.length);
    const len = WORD_LENS[lineIndex];
    const packed = state.lines[lineIndex];
    const count = packed.length / len;
    const index = Math.floor(Math.random() * count);
    return packed.substr(index * len, len).toUpperCase();
  }

  function scramble(word) {
    const letters = word.split("");
    if (letters.length < 2) return word;
    for (let attempt = 0; attempt < 20; attempt++) {
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = letters[i];
        letters[i] = letters[j];
        letters[j] = tmp;
      }
      const out = letters.join("");
      if (out !== word) return out;
    }
    return letters.join("");
  }

  function cellSizeFor(count, maxWidth, maxSize) {
    const gap = Math.max(5, maxSize * 0.06);
    const size = Math.floor((maxWidth - gap * (count - 1)) / count);
    return Math.max(22, Math.min(maxSize, size));
  }

  function wrapText(text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (let i = 0; i < words.length; i++) {
      const next = current ? current + "   " + words[i] : words[i];
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current);
        current = words[i];
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function extrasForDisplay() {
    const shown = state.guess || state.word;
    return state.answers.filter((w) => w !== shown);
  }

  function hintText() {
    if (state.phase === "play") return "tap letters to spell";
    if (state.phase === "wrong") return "wrong";
    if (state.phase === "correct") return "right";
    if (state.phase === "revealed") return state.lastResult === "wrong" ? "wrong" : state.lastResult === "right" ? "right" : "";
    return "";
  }

  function applyPlayModes() {
    const used = Object.create(null);
    for (let i = 0; i < state.picked.length; i++) used[state.picked[i]] = true;

    for (let i = 0; i < state.sourceCells.length; i++) {
      const cell = state.sourceCells[i];
      if (state.phase === "correct" || state.phase === "revealed") cell.setMode("correct");
      else if (state.phase === "wrong" && used[i]) cell.setMode("wrong");
      else if (used[i]) cell.setMode("selected");
      else cell.setMode("idle");
    }

    for (let i = 0; i < state.guessCells.length; i++) {
      const cell = state.guessCells[i];
      const ch = state.guess[i] || "";
      cell.setLetter(ch);
      if (!ch) cell.setMode("idle");
      else if (state.phase === "correct" || state.phase === "revealed") cell.setMode("correct");
      else if (state.phase === "wrong") cell.setMode("wrong");
      else cell.setMode("selected");
    }
  }

  function placeButtons(ids, w, h) {
    const btnW = Math.max(100, Math.min(148, w * 0.24));
    const btnH = Math.max(36, Math.min(44, h * 0.06));
    const gap = 12;
    const total = ids.length * btnW + (ids.length - 1) * gap;
    let x = w / 2 - total / 2;
    const y = h - btnH - 24;
    for (let i = 0; i < ids.length; i++) {
      state.buttons.push({
        id: ids[i],
        label: ids[i].toUpperCase(),
        x: x,
        y: y,
        w: btnW,
        h: btnH,
      });
      x += btnW + gap;
    }
  }

  function layout() {
    state.sourceCells = [];
    state.guessCells = [];
    state.extraText = [];
    state.buttons = [];
    if (state.phase === "loading" || state.phase === "error") return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const n = state.jumble.length;
    const maxWidth = w * 0.86;
    const showExtras = (state.phase === "correct" || state.phase === "revealed") && extrasForDisplay().length;
    const mainSize = cellSizeFor(n, maxWidth, Math.min(w, h) * 0.16);
    const mainGap = Math.max(5, Math.round(mainSize * 0.08));
    const mainY = showExtras ? h * 0.48 : h * 0.54;

    state.sourceCells = LetterCell.row(state.jumble, w / 2, mainY, mainSize, mainGap);

    const guessSize = cellSizeFor(n, maxWidth * 0.78, Math.min(w, h) * 0.09);
    const guessGap = Math.max(4, Math.round(guessSize * 0.08));
    const hintSpace = Math.max(26, guessSize * 0.7);
    const guessY = mainY - mainSize * 0.5 - hintSpace - guessSize * 0.5;
    state.guessCells = LetterCell.row("", w / 2, guessY, guessSize, guessGap, { count: n });
    state.hintY = (guessY + guessSize / 2 + mainY - mainSize / 2) / 2;

    if (showExtras) {
      const extras = extrasForDisplay();
      const fontSize = Math.max(16, Math.min(w, h) * 0.034);
      ctx.font = "500 " + fontSize + "px system-ui, sans-serif";
      state.extraText = wrapText(extras.join(" "), maxWidth);
      state.extraY = mainY + mainSize * 0.5 + fontSize * 1.4;
      state.extraSize = fontSize;
    }

    if (state.phase === "play" || state.phase === "wrong") placeButtons(["reset", "reveal"], w, h);
    else if (state.phase === "correct") placeButtons(["reveal", "next"], w, h);
    else if (state.phase === "revealed") placeButtons(["next"], w, h);

    applyPlayModes();
  }

  function resetGuess() {
    if (state.phase !== "play" && state.phase !== "wrong") return;
    state.picked = [];
    state.guess = "";
    state.phase = "play";
    applyPlayModes();
    draw();
  }

  function scoreGuess() {
    const hit = state.answers.indexOf(state.guess) !== -1;
    if (hit) {
      state.phase = "correct";
      state.lastResult = "right";
      state.rights += 1;
      state.score += 10 * state.guess.length;
    } else {
      state.phase = "wrong";
      state.lastResult = "wrong";
      state.wrongs += 1;
      state.score -= 10;
    }
    layout();
    draw();
  }

  function tapSource(index) {
    if (state.phase !== "play") return;
    if (state.picked.indexOf(index) !== -1) return;
    if (state.guess.length >= state.jumble.length) return;
    state.picked.push(index);
    state.guess += state.sourceCells[index].letter;
    applyPlayModes();
    draw();
    if (state.guess.length === state.jumble.length) scoreGuess();
  }

  function tapGuess(index) {
    if (state.phase !== "play" && state.phase !== "wrong") return;
    if (index < 0 || index >= state.guess.length) return;
    state.picked.splice(index, 1);
    state.guess = state.guess.slice(0, index) + state.guess.slice(index + 1);
    if (state.phase === "wrong") state.phase = "play";
    applyPlayModes();
    draw();
  }

  function reveal() {
    if (state.phase === "loading" || state.phase === "error" || state.phase === "revealed") return;
    if (state.phase === "play" || state.phase === "wrong") {
      state.score -= 20;
      if (!state.lastResult) state.lastResult = "wrong";
    }
    state.phase = "revealed";
    state.picked = [];
    state.guess = state.word;
    layout();
    draw();
  }

  function nextWord() {
    if (state.phase === "error" || !state.lines.length) return;
    state.word = pickWord();
    state.jumble = scramble(state.word);
    state.answers = answersOf(state.word);
    state.others = state.answers.filter((w) => w !== state.word);
    state.phase = "play";
    state.picked = [];
    state.guess = "";
    state.lastResult = "";
    layout();
    draw();
  }

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitButton(p) {
    for (let i = 0; i < state.buttons.length; i++) {
      const b = state.buttons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
    }
    return null;
  }

  function onTap(e) {
    if (state.phase === "loading" || state.phase === "error") return;
    const p = pointFromEvent(e);
    const btn = hitButton(p);
    if (btn) {
      if (btn.id === "reveal") reveal();
      else if (btn.id === "next") nextWord();
      else if (btn.id === "reset") resetGuess();
      return;
    }
    for (let i = 0; i < state.guessCells.length; i++) {
      if (state.guessCells[i].contains(p.x, p.y)) {
        tapGuess(i);
        return;
      }
    }
    for (let i = 0; i < state.sourceCells.length; i++) {
      if (state.sourceCells[i].contains(p.x, p.y)) {
        tapSource(i);
        return;
      }
    }
  }

  function drawButton(btn) {
    const r = 10;
    LetterCell.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, r);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.fillStyle = "#d0d0d0";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }

  function drawScore(w) {
    const y = 28;
    const fontSize = Math.max(14, Math.min(w, window.innerHeight) * 0.028);
    ctx.font = "600 " + fontSize + "px system-ui, sans-serif";
    ctx.textBaseline = "top";
    const gap = Math.max(28, w * 0.06);
    const items = [
      { label: "RIGHT", value: String(state.rights), color: "#7dffa3" },
      { label: "WRONG", value: String(state.wrongs), color: "#ff6b6b" },
      { label: "SCORE", value: String(state.score), color: "#f2f2f2" },
    ];
    const parts = items.map((item) => item.label + "  " + item.value);
    const widths = parts.map((p) => ctx.measureText(p).width);
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

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, w, h);

    if (state.phase === "loading" || state.phase === "error") {
      ctx.fillStyle = "#f2f2f2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 " + Math.max(18, Math.min(w, h) * 0.045) + "px system-ui, sans-serif";
      ctx.fillText(state.message, w / 2, h / 2);
      return;
    }

    drawScore(w);

    for (let i = 0; i < state.guessCells.length; i++) state.guessCells[i].draw(ctx);

    const hint = hintText();
    if (hint) {
      ctx.fillStyle = state.phase === "wrong" || (state.lastResult === "wrong" && state.phase === "revealed")
        ? "#ff6b6b"
        : state.phase === "correct" || (state.lastResult === "right" && state.phase === "revealed")
          ? "#7dffa3"
          : "#666666";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "500 " + Math.max(12, Math.min(w, h) * 0.024) + "px system-ui, sans-serif";
      ctx.fillText(hint, w / 2, state.hintY);
    }

    for (let i = 0; i < state.sourceCells.length; i++) state.sourceCells[i].draw(ctx);

    if (state.extraText.length) {
      ctx.fillStyle = "#b0b0b0";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "500 " + state.extraSize + "px system-ui, sans-serif";
      const lineH = state.extraSize * 1.35;
      for (let i = 0; i < state.extraText.length; i++) {
        ctx.fillText(state.extraText[i], w / 2, state.extraY + i * lineH);
      }
    }

    for (let i = 0; i < state.buttons.length; i++) drawButton(state.buttons[i]);
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerup", onTap);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Enter" && (state.phase === "correct" || state.phase === "revealed")) {
      e.preventDefault();
      nextWord();
    } else if (e.code === "Escape") {
      e.preventDefault();
      resetGuess();
    } else if (e.code === "Space" && state.phase !== "revealed") {
      e.preventDefault();
      reveal();
    }
  });

  resize();

  fetch("data/letters.txt")
    .then((res) => {
      if (!res.ok) throw new Error("could not load letters.txt (" + res.status + ")");
      return res.text();
    })
    .then((text) => {
      const parsed = parseLetters(text);
      state.lines = parsed.lines;
      state.groups = parsed.groups;
      nextWord();
    })
    .catch((err) => {
      state.phase = "error";
      state.message = err.message || "failed to load letters.txt";
      draw();
    });
})();
