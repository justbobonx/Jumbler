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
    otherRows: [],
    buttons: [],
    lockTimer: 0,
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

  function sourceMode() {
    if (state.phase === "correct" || state.phase === "revealed") return "correct";
    if (state.phase === "wrong") return "wrong";
    return "idle";
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

  function layout() {
    state.sourceCells = [];
    state.guessCells = [];
    state.otherRows = [];
    state.buttons = [];
    if (state.phase === "loading" || state.phase === "error") return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const n = state.jumble.length;
    const maxWidth = w * 0.86;
    const mainSize = cellSizeFor(n, maxWidth, Math.min(w, h) * 0.16);
    const mainGap = Math.max(5, Math.round(mainSize * 0.08));
    const showAnswers = state.phase === "revealed";
    const mainY = showAnswers ? h * 0.34 : h * 0.52;

    state.sourceCells = LetterCell.row(state.jumble, w / 2, mainY, mainSize, mainGap);

    const guessSize = cellSizeFor(n, maxWidth * 0.78, Math.min(w, h) * 0.09);
    const guessGap = Math.max(4, Math.round(guessSize * 0.08));
    state.guessCells = LetterCell.row("".repeat(n), w / 2, mainY - mainSize * 0.5 - guessSize * 0.95, guessSize, guessGap, { count: n });

    if (showAnswers) {
      const words = state.answers;
      const altSize = cellSizeFor(n, maxWidth * 0.72, Math.min(w, h) * 0.055);
      const altGap = Math.max(4, Math.round(altSize * 0.08));
      const wordGap = altSize * 0.55;
      const rowH = altSize + 10;
      let y = mainY + mainSize * 0.5 + altSize * 1.2;
      const wordWidth = n * altSize + (n - 1) * altGap;
      const rows = [];
      let current = [];
      let currentWidth = 0;

      for (let i = 0; i < words.length; i++) {
        const nextWidth = current.length ? currentWidth + wordGap + wordWidth : wordWidth;
        if (current.length && nextWidth > maxWidth) {
          rows.push(current);
          current = [words[i]];
          currentWidth = wordWidth;
        } else {
          current.push(words[i]);
          currentWidth = nextWidth;
        }
      }
      if (current.length) rows.push(current);

      const altStyle = { mode: "correct", lineWidth: 1 };
      for (let r = 0; r < rows.length; r++) {
        const rowWords = rows[r];
        const rowWidth = rowWords.length * wordWidth + (rowWords.length - 1) * wordGap;
        let x = w / 2 - rowWidth / 2 + wordWidth / 2;
        const rowCells = [];
        for (let i = 0; i < rowWords.length; i++) {
          rowCells.push.apply(rowCells, LetterCell.row(rowWords[i], x, y, altSize, altGap, altStyle));
          x += wordWidth + wordGap;
        }
        state.otherRows.push(rowCells);
        y += rowH;
      }
    }

    const btnW = Math.max(108, Math.min(160, w * 0.28));
    const btnH = Math.max(36, Math.min(44, h * 0.06));
    const btnY = h - btnH - 24;
    if (state.phase === "play" || state.phase === "wrong" || state.phase === "correct") {
      state.buttons.push({ id: "reveal", label: "REVEAL", x: w / 2 - btnW / 2, y: btnY, w: btnW, h: btnH });
    }
    if (state.phase === "correct" || state.phase === "revealed") {
      const nextX = state.phase === "correct" ? w / 2 + 10 : w / 2 - btnW / 2;
      if (state.phase === "correct") {
        state.buttons[0].x = w / 2 - btnW - 10;
      }
      state.buttons.push({ id: "next", label: "NEXT", x: nextX, y: btnY, w: btnW, h: btnH });
    }

    applyPlayModes();
  }

  function resetGuess() {
    state.picked = [];
    state.guess = "";
    if (state.phase === "wrong") state.phase = "play";
    applyPlayModes();
    draw();
  }

  function scoreGuess() {
    const hit = state.answers.indexOf(state.guess) !== -1;
    state.phase = hit ? "correct" : "wrong";
    applyPlayModes();
    layout();
    draw();
    if (!hit) {
      clearTimeout(state.lockTimer);
      state.lockTimer = setTimeout(resetGuess, 650);
    }
  }

  function tapSource(index) {
    if (state.phase !== "play") return;
    const already = state.picked.indexOf(index);
    if (already !== -1) {
      if (already === state.picked.length - 1) {
        state.picked.pop();
        state.guess = state.guess.slice(0, -1);
        applyPlayModes();
        draw();
      }
      return;
    }
    if (state.guess.length >= state.jumble.length) return;
    state.picked.push(index);
    state.guess += state.sourceCells[index].letter;
    applyPlayModes();
    draw();
    if (state.guess.length === state.jumble.length) scoreGuess();
  }

  function reveal() {
    if (state.phase === "loading" || state.phase === "error" || state.phase === "revealed") return;
    clearTimeout(state.lockTimer);
    state.phase = "revealed";
    state.picked = [];
    state.guess = state.word;
    layout();
    draw();
  }

  function nextWord() {
    if (state.phase === "loading" || state.phase === "error") return;
    clearTimeout(state.lockTimer);
    state.word = pickWord();
    state.jumble = scramble(state.word);
    state.answers = answersOf(state.word);
    state.others = state.answers.filter((w) => w !== state.word);
    state.phase = "play";
    state.picked = [];
    state.guess = "";
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
      return;
    }
    if (state.phase !== "play") return;
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

    ctx.fillStyle = "#666666";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "500 " + Math.max(12, Math.min(w, h) * 0.024) + "px system-ui, sans-serif";
    const caption = state.phase === "play" || state.phase === "wrong"
      ? "tap letters to spell"
      : state.phase === "correct"
        ? "got it"
        : "all matches";
    if (state.guessCells.length) {
      ctx.fillText(caption, w / 2, state.guessCells[0].y - 10);
    }

    for (let i = 0; i < state.guessCells.length; i++) state.guessCells[i].draw(ctx);
    for (let i = 0; i < state.sourceCells.length; i++) state.sourceCells[i].draw(ctx);
    for (let r = 0; r < state.otherRows.length; r++) {
      const row = state.otherRows[r];
      for (let i = 0; i < row.length; i++) row[i].draw(ctx);
    }
    for (let i = 0; i < state.buttons.length; i++) drawButton(state.buttons[i]);
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerup", onTap);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Enter" && (state.phase === "correct" || state.phase === "revealed")) {
      e.preventDefault();
      nextWord();
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
