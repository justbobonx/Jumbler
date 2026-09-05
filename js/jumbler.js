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

  function nextWord() {
    if (state.status !== "ready") return;
    state.word = pickWord();
    state.jumble = scramble(state.word);
    state.others = anagramsOf(state.word);
    state.revealed = false;
    draw();
  }

  function onTap() {
    if (state.status !== "ready") return;
    if (!state.revealed) {
      state.revealed = true;
      draw();
      return;
    }
    nextWord();
  }

  function fitFont(text, maxWidth, maxSize) {
    let size = maxSize;
    ctx.font = "700 " + size + "px system-ui, sans-serif";
    while (size > 24 && ctx.measureText(text).width > maxWidth) {
      size -= 2;
      ctx.font = "700 " + size + "px system-ui, sans-serif";
    }
    return size;
  }

  function wrapLine(text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (let i = 0; i < words.length; i++) {
      const next = current ? current + "  " + words[i] : words[i];
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

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, w, h);

    let display;
    let hint = "";
    let color = "#f2f2f2";

    if (state.status === "ready") {
      display = state.revealed ? state.word : state.jumble;
      hint = state.revealed ? "tap for a new word" : "tap to reveal";
      color = state.revealed ? "#7dffa3" : "#f2f2f2";
    } else {
      display = state.message;
    }

    const maxWidth = w * 0.86;
    const size = fitFont(display, maxWidth, Math.min(w, h) * 0.18);
    const mainY = state.revealed && state.others.length ? h * 0.44 : h / 2;

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 " + size + "px system-ui, sans-serif";
    ctx.fillText(display, w / 2, mainY);

    if (state.status === "ready" && state.revealed && state.others.length) {
      const altSize = Math.max(16, Math.min(w, h) * 0.038);
      ctx.fillStyle = "#c8c8c8";
      ctx.font = "500 " + altSize + "px system-ui, sans-serif";
      ctx.textBaseline = "top";
      const lines = wrapLine(state.others.join("  "), maxWidth);
      const startY = mainY + size * 0.7;
      const lineH = altSize * 1.35;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, startY + i * lineH);
      }
    }

    ctx.fillStyle = "#888888";
    ctx.font = "500 " + Math.max(14, Math.min(w, h) * 0.028) + "px system-ui, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.fillText(hint, w / 2, h - 28);
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
