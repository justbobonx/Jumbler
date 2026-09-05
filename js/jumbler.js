(() => {
  const WORD_LENS = [5, 6, 7, 8];
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  const state = {
    lines: [],
    groups: Object.create(null),
    word: "",
    jumble: "",
    others: [],
    revealed: false,
    status: "loading",
    message: "loading letters…",
    mainCells: [],
    otherRows: [],
  };

  function signature(word) {
    return word.toLowerCase().split("").sort().join("");
  }

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutCells();
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

  function anagramsOf(word) {
    const key = word.length + ":" + signature(word);
    const group = state.groups[key] || [word];
    return group.filter((w) => w !== word);
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
    const gap = Math.max(6, maxSize * 0.08);
    const size = Math.floor((maxWidth - gap * (count - 1)) / count);
    return Math.max(22, Math.min(maxSize, size));
  }

  function layoutCells() {
    state.mainCells = [];
    state.otherRows = [];
    if (state.status !== "ready") return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const display = state.revealed ? state.word : state.jumble;
    const maxWidth = w * 0.86;
    const mainSize = cellSizeFor(display.length, maxWidth, Math.min(w, h) * 0.16);
    const mainGap = Math.max(6, Math.round(mainSize * 0.1));
    const showOthers = state.revealed && state.others.length > 0;
    const mainY = showOthers ? h * 0.4 : h / 2;
    const mainStyle = state.revealed
      ? { letterColor: "#7dffa3", borderColor: "#4d8f64" }
      : { letterColor: "#f2f2f2", borderColor: "#8a8a8a" };

    state.mainCells = LetterCell.row(display, w / 2, mainY, mainSize, mainGap, mainStyle);

    if (!showOthers) return;

    const altSize = cellSizeFor(display.length, maxWidth * 0.72, Math.min(w, h) * 0.055);
    const altGap = Math.max(4, Math.round(altSize * 0.1));
    const wordGap = altSize * 0.55;
    const rowH = altSize + 10;
    let y = mainY + mainSize * 0.5 + altSize * 1.15;

    const rows = [];
    let current = [];
    let currentWidth = 0;
    const wordWidth = display.length * altSize + (display.length - 1) * altGap;

    for (let i = 0; i < state.others.length; i++) {
      const nextWidth = current.length ? currentWidth + wordGap + wordWidth : wordWidth;
      if (current.length && nextWidth > maxWidth) {
        rows.push(current);
        current = [state.others[i]];
        currentWidth = wordWidth;
      } else {
        current.push(state.others[i]);
        currentWidth = nextWidth;
      }
    }
    if (current.length) rows.push(current);

    const altStyle = { letterColor: "#d0d0d0", borderColor: "#666666", lineWidth: 1 };
    for (let r = 0; r < rows.length; r++) {
      const words = rows[r];
      const rowWidth = words.length * wordWidth + (words.length - 1) * wordGap;
      let x = w / 2 - rowWidth / 2 + wordWidth / 2;
      const rowCells = [];
      for (let i = 0; i < words.length; i++) {
        rowCells.push.apply(rowCells, LetterCell.row(words[i], x, y, altSize, altGap, altStyle));
        x += wordWidth + wordGap;
      }
      state.otherRows.push(rowCells);
      y += rowH;
    }
  }

  function nextWord() {
    if (state.status !== "ready") return;
    state.word = pickWord();
    state.jumble = scramble(state.word);
    state.others = anagramsOf(state.word);
    state.revealed = false;
    layoutCells();
    draw();
  }

  function onTap() {
    if (state.status !== "ready") return;
    if (!state.revealed) {
      state.revealed = true;
      layoutCells();
      draw();
      return;
    }
    nextWord();
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, w, h);

    if (state.status !== "ready") {
      ctx.fillStyle = "#f2f2f2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 " + Math.max(18, Math.min(w, h) * 0.045) + "px system-ui, sans-serif";
      ctx.fillText(state.message, w / 2, h / 2);
      return;
    }

    for (let i = 0; i < state.mainCells.length; i++) state.mainCells[i].draw(ctx);
    for (let r = 0; r < state.otherRows.length; r++) {
      const row = state.otherRows[r];
      for (let i = 0; i < row.length; i++) row[i].draw(ctx);
    }

    ctx.fillStyle = "#888888";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "500 " + Math.max(14, Math.min(w, h) * 0.028) + "px system-ui, sans-serif";
    ctx.fillText(state.revealed ? "tap for a new word" : "tap to reveal", w / 2, h - 28);
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerup", onTap);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      onTap();
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
      state.status = "ready";
      nextWord();
    })
    .catch((err) => {
      state.status = "error";
      state.message = err.message || "failed to load letters.txt";
      draw();
    });
})();
