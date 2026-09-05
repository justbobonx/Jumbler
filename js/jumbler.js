(() => {
  const WORD_LENS = [5, 6, 7, 8];
  const VERSION = window.VERSION || "0.6.1";
  const TICK_MS = 500;
  const PLAYERS = [
    { name: "red", fill: "#c23b3b", score: "#ffb4b4" },
    { name: "blue", fill: "#2b6cb0", score: "#b7d4ff" },
    { name: "yellow", fill: "#d4b22a", score: "#ffe7a3" },
    { name: "purple", fill: "#7a3db3", score: "#e0c2ff" },
  ];
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const container = document.getElementById("game-container");
  const gate = document.getElementById("orientGate");

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
    titleCells: [],
    extraText: [],
    extraY: 0,
    extraSize: 16,
    hintY: 0,
    tickY: 0,
    tickW: 0,
    tickH: 0,
    tickGap: 0,
    buttons: [],
    pads: [],
    stepper: [],
    rights: 0,
    wrongs: 0,
    score: 0,
    lastResult: "",
    missedThisWord: false,
    playChrome: false,
    chromeWait: null,
    lockTimer: 0,
    playerCount: 1,
    playerScores: [0, 0, 0, 0],
    locked: [false, false, false, false],
    activePlayer: -1,
    timerKind: "",
    timerUntil: 0,
    timerTotal: 0,
  };

  function isMulti() {
    return state.playerCount > 1;
  }

  function viewSize() {
    return {
      w: container.clientWidth || window.innerWidth,
      h: container.clientHeight || window.innerHeight,
    };
  }

  function tallViewport() {
    return window.innerHeight > window.innerWidth;
  }

  function stageSwapped() {
    return document.documentElement.classList.contains("stage-swap");
  }

  function applyStage() {
    const swap = state.playChrome && tallViewport();
    document.documentElement.classList.toggle("stage-swap", swap);
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function requestPageFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (!req) return Promise.resolve();
    try {
      const p = req.call(el);
      if (p && typeof p.then === "function") return p.catch(function () {});
    } catch (err) {}
    return Promise.resolve();
  }

  function showGate() {
    if (gate) gate.classList.add("show");
  }

  function hideGate() {
    if (gate) gate.classList.remove("show");
  }

  function waitChromeSettled() {
    return new Promise(function (resolve) {
      let settled = false;
      const finish = function () {
        if (settled) return;
        settled = true;
        document.removeEventListener("fullscreenchange", onFs);
        document.removeEventListener("webkitfullscreenchange", onFs);
        resolve();
      };
      const onFs = function () {
        applyStage();
        resize();
        setTimeout(finish, 80);
      };
      document.addEventListener("fullscreenchange", onFs);
      document.addEventListener("webkitfullscreenchange", onFs);
      setTimeout(finish, 750);
    });
  }

  function enterPlayChrome() {
    if (state.chromeWait) return state.chromeWait;
    state.playChrome = true;
    state.chromeWait = runPlayChrome().then(function () {
      state.chromeWait = null;
    }, function () {
      state.chromeWait = null;
    });
    return state.chromeWait;
  }

  function runPlayChrome() {
    applyStage();
    const gateNeeded = tallViewport() && !stageSwapped();
    if (gateNeeded) showGate();
    const fs = isFullscreen() ? Promise.resolve() : requestPageFullscreen();
    return fs.then(function () {
      applyStage();
      if (gateNeeded) return waitChromeSettled();
    }).then(function () {
      applyStage();
      resize();
      hideGate();
    });
  }

  function signature(word) {
    return word.toLowerCase().split("").sort().join("");
  }

  function answersOf(word) {
    const key = word.length + ":" + signature(word);
    return (state.groups[key] || [word]).slice();
  }

  function resize() {
    applyStage();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const size = viewSize();
    canvas.width = Math.floor(size.w * dpr);
    canvas.height = Math.floor(size.h * dpr);
    canvas.style.width = size.w + "px";
    canvas.style.height = size.h + "px";
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

  function remainingPlayers() {
    let n = 0;
    for (let i = 0; i < state.playerCount; i++) if (!state.locked[i]) n += 1;
    return n;
  }

  function tickCount() {
    return Math.max(1, state.jumble.length || 5);
  }

  function clearTimer() {
    state.timerKind = "";
    state.timerUntil = 0;
    state.timerTotal = 0;
  }

  function startTimer(kind) {
    state.timerKind = kind;
    state.timerTotal = tickCount() * TICK_MS;
    state.timerUntil = Date.now() + state.timerTotal;
  }

  function remainingTicks() {
    if (!state.timerUntil) return 0;
    const left = Math.max(0, state.timerUntil - Date.now());
    return Math.ceil(left / TICK_MS);
  }

  function bigWord() {
    if (state.phase === "correct") return state.guess || state.word;
    if (state.phase === "revealed") return state.word;
    return state.jumble;
  }

  function solvedMode() {
    if (state.phase === "correct") return "correct";
    if (state.phase === "revealed" && state.lastResult === "right") return "correct";
    if (state.phase === "revealed") return "revealed";
    return "";
  }

  function hintText() {
    if (state.phase === "buzz") return remainingPlayers() === 1 ? "last player · buzz in" : "buzz in";
    if (state.phase === "play") {
      if (isMulti() && state.activePlayer >= 0) return PLAYERS[state.activePlayer].name + " · tap letters to spell";
      return "tap letters to spell";
    }
    if (state.phase === "wrong") return "wrong";
    if (state.phase === "correct") return "right";
    if (state.phase === "revealed") return state.lastResult === "wrong" ? "wrong" : state.lastResult === "right" ? "right" : "";
    return "";
  }

  function applyPlayModes() {
    const used = Object.create(null);
    for (let i = 0; i < state.picked.length; i++) used[state.picked[i]] = true;
    const done = solvedMode();

    for (let i = 0; i < state.sourceCells.length; i++) {
      const cell = state.sourceCells[i];
      if (done) cell.setMode(done);
      else if (state.phase === "wrong" && used[i]) cell.setMode("wrong");
      else if (used[i]) cell.setMode("idle");
      else cell.setMode("selected");
    }

    for (let i = 0; i < state.guessCells.length; i++) {
      const cell = state.guessCells[i];
      const ch = state.guess[i] || "";
      cell.setLetter(ch);
      if (!ch) cell.setMode("idle");
      else if (done) cell.setMode(done);
      else if (state.phase === "wrong") cell.setMode("wrong");
      else cell.setMode("selected");
    }
  }

  function buttonLabel(id) {
    if (id === "reveal") return "GIVE UP";
    return id.toUpperCase();
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
        label: buttonLabel(ids[i]),
        x: x,
        y: y,
        w: btnW,
        h: btnH,
      });
      x += btnW + gap;
    }
  }

  function padSize(w, h) {
    return Math.max(64, Math.min(96, w * 0.16, h * 0.22));
  }

  function layoutPads(w, h) {
    state.pads = [];
    const n = state.playerCount;
    const s = padSize(w, h);
    const inset = 16;
    const bottomClear = 72;
    const topY = inset;
    const botY = h - bottomClear - s;
    const leftX = inset;
    const rightX = w - inset - s;
    const midX = w / 2 - s / 2;
    const spots = [];
    if (n === 2) {
      spots.push({ x: leftX, y: botY });
      spots.push({ x: rightX, y: botY });
    } else if (n === 3) {
      spots.push({ x: leftX, y: botY });
      spots.push({ x: rightX, y: botY });
      spots.push({ x: midX, y: topY });
    } else {
      spots.push({ x: leftX, y: topY });
      spots.push({ x: rightX, y: topY });
      spots.push({ x: leftX, y: botY });
      spots.push({ x: rightX, y: botY });
    }
    for (let i = 0; i < n; i++) {
      state.pads.push({
        i: i,
        x: spots[i].x,
        y: spots[i].y,
        w: s,
        h: s,
      });
    }
  }

  function layoutTicks(w, mainBottom) {
    const n = tickCount();
    const gap = 5;
    const boxW = Math.max(10, Math.min(18, Math.floor((w * 0.42 - gap * (n - 1)) / n)));
    const boxH = Math.max(8, Math.round(boxW * 0.55));
    state.tickW = boxW;
    state.tickH = boxH;
    state.tickGap = gap;
    state.tickY = mainBottom + 14;
  }

  function layoutStepper(w, h, titleBottom) {
    state.stepper = [];
    const box = Math.max(36, Math.min(44, h * 0.06));
    const label = state.playerCount === 1 ? "1 player" : state.playerCount + " players";
    ctx.font = "600 16px system-ui, sans-serif";
    const labelW = Math.max(110, ctx.measureText(label).width + 16);
    const gap = 12;
    const total = box + gap + labelW + gap + box;
    let x = w / 2 - total / 2;
    const y = titleBottom + 28;
    state.stepper.push({ id: "minus", x: x, y: y, w: box, h: box });
    x += box + gap;
    state.stepper.push({ id: "label", x: x, y: y, w: labelW, h: box });
    x += labelW + gap;
    state.stepper.push({ id: "plus", x: x, y: y, w: box, h: box });
    return y + box;
  }

  function layoutTitle() {
    const sizeV = viewSize();
    const w = sizeV.w;
    const h = sizeV.h;
    const title = "JUMBLER";
    const size = cellSizeFor(title.length, w * 0.86, Math.min(w, h) * 0.16);
    const gap = Math.max(5, Math.round(size * 0.08));
    const titleY = h * 0.34;
    state.titleCells = LetterCell.row(title, w / 2, titleY, size, gap, { mode: "revealed" });
    const titleBottom = titleY + size / 2;
    const stepperBottom = layoutStepper(w, h, titleBottom);
    const btnW = Math.max(100, Math.min(148, w * 0.24));
    const btnH = Math.max(36, Math.min(44, h * 0.06));
    state.buttons.push({
      id: "start",
      label: "START",
      x: w / 2 - btnW / 2,
      y: stepperBottom + 22,
      w: btnW,
      h: btnH,
    });
  }

  function layout() {
    state.sourceCells = [];
    state.guessCells = [];
    state.titleCells = [];
    state.extraText = [];
    state.buttons = [];
    state.pads = [];
    state.stepper = [];
    if (state.phase === "loading" || state.phase === "error") return;
    if (state.phase === "title") {
      layoutTitle();
      return;
    }

    const sizeV = viewSize();
    const w = sizeV.w;
    const h = sizeV.h;
    const n = state.jumble.length;
    const buzzing = isMulti() && state.phase === "buzz";
    const maxWidth = buzzing ? w * 0.62 : w * 0.86;
    const showGuess = !buzzing;
    const showExtras = (state.phase === "correct" || state.phase === "revealed") && extrasForDisplay().length;
    const mainSize = cellSizeFor(n, maxWidth, Math.min(w, h) * (buzzing ? 0.14 : 0.16));
    const mainGap = Math.max(5, Math.round(mainSize * 0.08));
    const mainY = buzzing ? h * 0.48 : showExtras ? h * 0.46 : h * 0.52;

    state.sourceCells = LetterCell.row(bigWord(), w / 2, mainY, mainSize, mainGap);
    layoutTicks(w, mainY + mainSize * 0.5);

    if (showGuess) {
      const guessSize = cellSizeFor(n, maxWidth * 0.78, Math.min(w, h) * 0.09);
      const guessGap = Math.max(4, Math.round(guessSize * 0.08));
      const hintSpace = Math.max(26, guessSize * 0.7);
      const guessY = mainY - mainSize * 0.5 - hintSpace - guessSize * 0.5;
      state.guessCells = LetterCell.row("", w / 2, guessY, guessSize, guessGap, { count: n });
      state.hintY = (guessY + guessSize / 2 + mainY - mainSize / 2) / 2;
    } else {
      state.hintY = mainY - mainSize * 0.5 - 22;
    }

    if (showExtras) {
      const extras = extrasForDisplay();
      const fontSize = Math.max(16, Math.min(w, h) * 0.034);
      ctx.font = "500 " + fontSize + "px system-ui, sans-serif";
      state.extraText = wrapText(extras.join(" "), w * 0.86);
      state.extraY = state.tickY + state.tickH + fontSize * 1.1;
      state.extraSize = fontSize;
    }

    if (buzzing) {
      layoutPads(w, h);
      placeButtons(["reveal"], w, h);
    } else if (state.phase === "play" || state.phase === "wrong") {
      placeButtons(["reset", "reveal"], w, h);
    } else if (state.phase === "correct") {
      placeButtons(isMulti() ? ["next"] : ["reveal", "next"], w, h);
    } else if (state.phase === "revealed") {
      placeButtons(["next"], w, h);
    }

    applyPlayModes();
  }

  function showTitle() {
    state.playChrome = false;
    document.documentElement.classList.remove("stage-swap");
    state.phase = "title";
    resize();
  }

  function startPlay() {
    state.playerScores = [0, 0, 0, 0];
    enterPlayChrome().then(nextWord);
  }

  function changePlayers(delta) {
    const next = Math.max(1, Math.min(4, state.playerCount + delta));
    if (next === state.playerCount) return;
    state.playerCount = next;
    layout();
    draw();
  }

  function resetGuess() {
    if (state.phase !== "play" && state.phase !== "wrong") return;
    if (isMulti() && state.phase === "wrong") return;
    state.picked = [];
    state.guess = "";
    state.phase = "play";
    applyPlayModes();
    draw();
  }

  function clearLock() {
    if (state.lockTimer) {
      clearTimeout(state.lockTimer);
      state.lockTimer = 0;
    }
  }

  function maybeLastTimer() {
    if (state.phase === "buzz" && remainingPlayers() === 1) startTimer("last");
  }

  function returnToBuzz() {
    state.lockTimer = 0;
    state.picked = [];
    state.guess = "";
    state.activePlayer = -1;
    clearTimer();
    if (remainingPlayers() <= 0) {
      state.phase = "revealed";
      state.guess = state.word;
    } else {
      state.phase = "buzz";
      maybeLastTimer();
    }
    layout();
    draw();
  }

  function forceWrong() {
    if (!isMulti() || state.phase !== "play") return;
    clearTimer();
    state.phase = "wrong";
    state.lastResult = "wrong";
    if (state.activePlayer >= 0) state.locked[state.activePlayer] = true;
    layout();
    draw();
    clearLock();
    state.lockTimer = setTimeout(returnToBuzz, 2000);
  }

  function scoreGuess() {
    const hit = state.answers.indexOf(state.guess) !== -1;
    if (hit) {
      clearTimer();
      state.phase = "correct";
      state.lastResult = "right";
      if (isMulti() && state.activePlayer >= 0) {
        state.playerScores[state.activePlayer] += 1;
      } else {
        state.rights += 1;
        state.score += 10 * state.guess.length;
      }
      layout();
      draw();
      return;
    }

    clearTimer();
    state.phase = "wrong";
    state.lastResult = "wrong";
    if (isMulti() && state.activePlayer >= 0) {
      state.locked[state.activePlayer] = true;
      layout();
      draw();
      clearLock();
      state.lockTimer = setTimeout(returnToBuzz, 2000);
      return;
    }
    state.missedThisWord = true;
    state.wrongs += 1;
    state.score -= 10;
    layout();
    draw();
  }

  function buzzIn(index) {
    if (state.phase !== "buzz") return;
    if (index < 0 || index >= state.playerCount) return;
    if (state.locked[index]) return;
    clearTimer();
    state.activePlayer = index;
    state.picked = [];
    state.guess = "";
    state.phase = "play";
    startTimer("guess");
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
    if (isMulti() && state.phase === "wrong") return;
    if (index < 0 || index >= state.guess.length) return;
    state.picked.splice(index, 1);
    state.guess = state.guess.slice(0, index) + state.guess.slice(index + 1);
    if (state.phase === "wrong") state.phase = "play";
    applyPlayModes();
    draw();
  }

  function reveal() {
    if (state.phase === "loading" || state.phase === "error" || state.phase === "title" || state.phase === "revealed") return;
    if (state.phase === "correct" && isMulti()) return;
    clearLock();
    clearTimer();
    if (!isMulti() && state.phase !== "correct" && !state.missedThisWord) {
      state.score -= 20;
      if (!state.lastResult) state.lastResult = "";
    }
    state.phase = "revealed";
    state.picked = [];
    state.guess = state.lastResult === "right" ? (state.guess || state.word) : state.word;
    layout();
    draw();
  }

  function nextWord() {
    if (state.phase === "error" || !state.lines.length) return;
    clearLock();
    clearTimer();
    state.word = pickWord();
    state.jumble = scramble(state.word);
    state.answers = answersOf(state.word);
    state.others = state.answers.filter((w) => w !== state.word);
    state.picked = [];
    state.guess = "";
    state.lastResult = "";
    state.missedThisWord = false;
    state.activePlayer = -1;
    state.locked = [false, false, false, false];
    state.phase = isMulti() ? "buzz" : "play";
    layout();
    draw();
  }

  function pointFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    if (!stageSwapped()) {
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return { x: dy + canvas.clientWidth / 2, y: -dx + canvas.clientHeight / 2 };
  }

  function hitBox(p, b) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  function hitButton(p) {
    for (let i = 0; i < state.buttons.length; i++) {
      if (hitBox(p, state.buttons[i])) return state.buttons[i];
    }
    return null;
  }

  function onTap(e) {
    if (state.phase === "loading" || state.phase === "error") return;
    const p = pointFromEvent(e);

    if (state.phase === "title") {
      for (let i = 0; i < state.stepper.length; i++) {
        const s = state.stepper[i];
        if (s.id === "minus" && hitBox(p, s)) {
          changePlayers(-1);
          return;
        }
        if (s.id === "plus" && hitBox(p, s)) {
          changePlayers(1);
          return;
        }
      }
    }

    const btn = hitButton(p);
    if (btn) {
      if (btn.id === "reveal") reveal();
      else if (btn.id === "next") nextWord();
      else if (btn.id === "start") startPlay();
      else if (btn.id === "reset") resetGuess();
      return;
    }

    if (state.phase === "buzz") {
      for (let i = 0; i < state.pads.length; i++) {
        if (hitBox(p, state.pads[i])) {
          buzzIn(state.pads[i].i);
          return;
        }
      }
      return;
    }

    if (state.phase === "title") return;
    if (isMulti() && state.phase === "wrong") return;

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

  function drawStepper() {
    for (let i = 0; i < state.stepper.length; i++) {
      const s = state.stepper[i];
      if (s.id === "label") {
        ctx.fillStyle = "#d0d0d0";
        ctx.font = "600 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = state.playerCount === 1 ? "1 player" : state.playerCount + " players";
        ctx.fillText(label, s.x + s.w / 2, s.y + s.h / 2 + 1);
        continue;
      }
      LetterCell.roundRect(ctx, s.x, s.y, s.w, s.h, 10);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "#888888";
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.fillStyle = "#d0d0d0";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.id === "minus" ? "−" : "+", s.x + s.w / 2, s.y + s.h / 2 + 1);
    }
  }

  function drawPads() {
    for (let i = 0; i < state.pads.length; i++) {
      const p = state.pads[i];
      const spec = PLAYERS[p.i];
      const locked = state.locked[p.i];
      const r = Math.max(16, p.w * 0.24);
      LetterCell.roundRect(ctx, p.x, p.y, p.w, p.h, r);
      ctx.fillStyle = locked ? "#2a2a2a" : spec.fill;
      ctx.fill();
      ctx.strokeStyle = locked ? "#444444" : "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = locked ? "#666666" : spec.score;
      ctx.font = "700 " + Math.round(p.h * 0.42) + "px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(state.playerScores[p.i]), p.x + p.w / 2, p.y + p.h / 2 + 1);
    }
  }

  function drawTicks(w) {
    if (!state.timerUntil || (state.timerKind !== "guess" && state.timerKind !== "last")) return;
    const n = tickCount();
    const left = remainingTicks();
    const total = n * state.tickW + (n - 1) * state.tickGap;
    let x = w / 2 - total / 2;
    const color = state.timerKind === "last"
      ? "#f2f2f2"
      : state.activePlayer >= 0 ? PLAYERS[state.activePlayer].fill : "#f2f2f2";
    for (let i = 0; i < n; i++) {
      const on = i < left;
      LetterCell.roundRect(ctx, x, state.tickY, state.tickW, state.tickH, 3);
      ctx.fillStyle = on ? color : "rgba(255,255,255,0.08)";
      ctx.fill();
      ctx.strokeStyle = on ? color : "#444444";
      ctx.lineWidth = 1;
      ctx.stroke();
      x += state.tickW + state.tickGap;
    }
  }

  function drawScore(w, h) {
    if (isMulti()) return;
    const y = 28;
    const fontSize = Math.max(14, Math.min(w, h) * 0.028);
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
    const sizeV = viewSize();
    const w = sizeV.w;
    const h = sizeV.h;
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

    if (state.phase === "title") {
      for (let i = 0; i < state.titleCells.length; i++) state.titleCells[i].draw(ctx);
      drawStepper();
      for (let i = 0; i < state.buttons.length; i++) drawButton(state.buttons[i]);
      ctx.fillStyle = "#666666";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.font = "500 " + Math.max(11, Math.min(w, h) * 0.022) + "px system-ui, sans-serif";
      ctx.fillText("v" + VERSION, w - 16, h - 14);
      return;
    }

    drawScore(w, h);

    for (let i = 0; i < state.guessCells.length; i++) state.guessCells[i].draw(ctx);

    const hint = hintText();
    if (hint) {
      let color = "#666666";
      if (state.phase === "wrong" || (state.lastResult === "wrong" && state.phase === "revealed")) color = "#ff6b6b";
      else if (state.phase === "correct" || (state.lastResult === "right" && state.phase === "revealed")) color = "#7dffa3";
      else if (state.phase === "play" && isMulti() && state.activePlayer >= 0) color = PLAYERS[state.activePlayer].fill;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "500 " + Math.max(12, Math.min(w, h) * 0.024) + "px system-ui, sans-serif";
      ctx.fillText(hint, w / 2, state.hintY);
    }

    for (let i = 0; i < state.sourceCells.length; i++) state.sourceCells[i].draw(ctx);
    drawTicks(w);
    drawPads();

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

  function tickFrame() {
    if (state.timerUntil) {
      if (Date.now() >= state.timerUntil) {
        const kind = state.timerKind;
        clearTimer();
        if (kind === "guess") forceWrong();
        else if (kind === "last") reveal();
      } else {
        draw();
      }
    }
    requestAnimationFrame(tickFrame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 200); });
  document.addEventListener("fullscreenchange", resize);
  document.addEventListener("webkitfullscreenchange", resize);
  canvas.addEventListener("pointerup", onTap);
  window.addEventListener("keydown", (e) => {
    if ((e.code === "Enter" || e.code === "Space") && state.phase === "title") {
      e.preventDefault();
      startPlay();
    } else if (e.code === "Enter" && (state.phase === "correct" || state.phase === "revealed")) {
      e.preventDefault();
      nextWord();
    } else if (e.code === "Escape") {
      e.preventDefault();
      resetGuess();
    } else if (e.code === "Space" && state.phase !== "revealed" && state.phase !== "title" && state.phase !== "correct") {
      e.preventDefault();
      reveal();
    }
  });

  resize();
  requestAnimationFrame(tickFrame);

  fetch("data/letters.txt?v=" + encodeURIComponent(VERSION))
    .then((res) => {
      if (!res.ok) throw new Error("could not load letters.txt (" + res.status + ")");
      return res.text();
    })
    .then((text) => {
      const parsed = parseLetters(text);
      state.lines = parsed.lines;
      state.groups = parsed.groups;
      showTitle();
    })
    .catch((err) => {
      state.phase = "error";
      state.message = err.message || "failed to load letters.txt";
      draw();
    });
})();
