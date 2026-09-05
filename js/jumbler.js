(() => {
  const WORD_LENS = [5, 6, 7, 8];
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  const state = {
    lines: [],
    word: "",
    jumble: "",
    revealed: false,
    status: "loading",
    message: "loading letters…",
  };

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
    for (let i = 0; i < WORD_LENS.length; i++) {
      const line = (raw[i] || "").replace(/\s+/g, "");
      const len = WORD_LENS[i];
      if (line.length < len || line.length % len !== 0) {
        throw new Error("line " + (i + 1) + " is not a clean pack of " + len + "-letter words");
      }
      lines.push(line);
    }
    return lines;
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

  function nextWord() {
    if (state.status !== "ready") return;
    state.word = pickWord();
    state.jumble = scramble(state.word);
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

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 " + size + "px system-ui, sans-serif";
    ctx.fillText(display, w / 2, h / 2);

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
      state.lines = parseLetters(text);
      state.status = "ready";
      nextWord();
    })
    .catch((err) => {
      state.status = "error";
      state.message = err.message || "failed to load letters.txt";
      draw();
    });
})();
