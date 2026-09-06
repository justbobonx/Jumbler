(() => {
  const VERSION = window.VERSION || "0.8.2";
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const chrome = new PlayChrome(
    document.getElementById("game-container"),
    canvas,
    document.getElementById("orientGate")
  );
  const bank = new WordBank();
  const board = new PlayerBoard();
  const ticks = new TickBar();

  const state = {
    word: "", jumble: "", answers: [], phase: "loading",
    message: "loading letters\u2026", picked: [], guess: "",
    sourceCells: [], guessCells: [], titleCells: [], extraText: [],
    extraY: 0, extraSize: 16, hintY: 0, buttons: [], stepper: [],
    rights: 0, wrongs: 0, score: 0, lastResult: "", missedThisWord: false,
    lockTimer: 0, playerCount: 1, activePlayer: -1,
  };

  function isMulti() { return state.playerCount > 1; }
  function extrasForDisplay() {
    const shown = state.guess || state.word;
    return state.answers.filter((w) => w !== shown);
  }
  function wrapText(text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (let i = 0; i < words.length; i++) {
      const next = current ? current + "   " + words[i] : words[i];
      if (current && ctx.measureText(next).width > maxWidth) { lines.push(current); current = words[i]; }
      else current = next;
    }
    if (current) lines.push(current);
    return lines;
  }
  function cellSizeFor(count, maxWidth, maxSize) {
    const gap = Math.max(4, maxSize * 0.05);
    return Math.max(22, Math.min(maxSize, Math.floor((maxWidth - gap * (count - 1)) / count)));
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
    if (state.phase === "buzz") {
      if (board.buzzAnim) return PlayerPad.spec(board.buzzAnim.player).name;
      return board.remaining() === 1 ? "last player \u00b7 buzz in" : "buzz in";
    }
    if (state.phase === "play") {
      if (isMulti() && state.activePlayer >= 0) return PlayerPad.spec(state.activePlayer).name + " \u00b7 tap letters to spell";
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
      else if (used[i]) cell.setMode("used");
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
    if (id === "start") return "NEW GAME";
    if (id === "continue") return "CONTINUE";
    return id.toUpperCase();
  }
  function placeButtons(ids, w, h) {
    const btnW = Math.max(100, Math.min(160, w * 0.28));
    const btnH = Math.max(36, Math.min(44, h * 0.06));
    const gap = 12;
    const total = ids.length * btnW + (ids.length - 1) * gap;
    let x = w / 2 - total / 2;
    const y = h - btnH - 24;
    for (let i = 0; i < ids.length; i++) {
      state.buttons.push({ id: ids[i], label: buttonLabel(ids[i]), x: x, y: y, w: btnW, h: btnH });
      x += btnW + gap;
    }
  }
  function addTitleButton(id, w, y, btnW, btnH) {
    state.buttons.push({ id: id, label: buttonLabel(id), x: w / 2 - btnW / 2, y: y, w: btnW, h: btnH });
    return y + btnH + 12;
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
    const sizeV = chrome.viewSize();
    const w = sizeV.w, h = sizeV.h;
    const size = cellSizeFor(7, w * 0.9, Math.min(w, h) * 0.18);
    const gap = Math.max(5, Math.round(size * 0.08));
    const titleY = h * 0.30;
    state.titleCells = LetterCell.row("JUMBLER", w / 2, titleY, size, gap, { mode: "revealed" });
    let y = layoutStepper(w, h, titleY + size / 2) + 22;
    const btnW = Math.max(120, Math.min(168, w * 0.32));
    const btnH = Math.max(36, Math.min(44, h * 0.06));
    if (GameSave.exists()) y = addTitleButton("continue", w, y, btnW, btnH);
    addTitleButton("start", w, y, btnW, btnH);
  }
  function layout() {
    state.sourceCells = []; state.guessCells = []; state.titleCells = [];
    state.extraText = []; state.buttons = []; state.stepper = []; board.pads = [];
    if (state.phase === "loading" || state.phase === "error") return;
    if (state.phase === "title") { layoutTitle(); return; }
    const sizeV = chrome.viewSize();
    const w = sizeV.w, h = sizeV.h, n = state.jumble.length;
    const buzzing = isMulti() && state.phase === "buzz";
    const padRoom = buzzing ? PlayerPad.sizeFor(w, h) * 2 + 20 : 32;
    const maxWidth = Math.min(w * 0.94, Math.max(120, w - padRoom));
    const showGuess = !buzzing;
    const showExtras = (state.phase === "correct" || state.phase === "revealed") && extrasForDisplay().length;
    const mainSize = cellSizeFor(n, maxWidth, Math.min(w, h) * 0.24);
    const mainGap = Math.max(4, Math.round(mainSize * 0.06));
    const mainY = buzzing ? h * 0.48 : showExtras ? h * 0.46 : h * 0.52;
    state.sourceCells = LetterCell.row(bigWord(), w / 2, mainY, mainSize, mainGap);
    if (!ticks.letters) ticks.letters = n;
    ticks.layout(w, mainY + mainSize * 0.5 + 14);
    if (showGuess) {
      const guessSize = cellSizeFor(n, maxWidth * 0.72, Math.min(w, h) * 0.1);
      const guessGap = Math.max(4, Math.round(guessSize * 0.08));
      const hintSpace = Math.max(26, guessSize * 0.7);
      const guessY = mainY - mainSize * 0.5 - hintSpace - guessSize * 0.5;
      state.guessCells = LetterCell.row("", w / 2, guessY, guessSize, guessGap, { count: n });
      state.hintY = (guessY + guessSize / 2 + mainY - mainSize / 2) / 2;
    } else state.hintY = mainY - mainSize * 0.5 - 22;
    if (showExtras) {
      const extras = extrasForDisplay();
      const fontSize = Math.max(16, Math.min(w, h) * 0.034);
      ctx.font = "500 " + fontSize + "px system-ui, sans-serif";
      state.extraText = wrapText(extras.join(" "), w * 0.86);
      state.extraY = ticks.y + ticks.boxH + fontSize * 1.1;
      state.extraSize = fontSize;
    }
    if (buzzing) { board.layout(state.playerCount, w, h); placeButtons(["reveal"], w, h); }
    else if (state.phase === "play" || state.phase === "wrong") placeButtons(["reset", "reveal"], w, h);
    else if (state.phase === "correct") placeButtons(isMulti() ? ["next"] : ["reveal", "next"], w, h);
    else if (state.phase === "revealed") placeButtons(["next"], w, h);
    applyPlayModes();
  }
  function snapshot() {
    return {
      word: state.word, jumble: state.jumble, answers: state.answers.slice(),
      phase: state.phase === "wrong" ? "buzz" : (board.buzzAnim ? "buzz" : state.phase),
      picked: state.picked.slice(), guess: state.phase === "wrong" ? "" : state.guess,
      rights: state.rights, wrongs: state.wrongs, score: state.score,
      lastResult: state.lastResult, missedThisWord: state.missedThisWord,
      playerCount: state.playerCount, activePlayer: state.phase === "wrong" ? -1 : state.activePlayer,
      scores: board.scores.slice(), locked: board.locked.slice(),
    };
  }
  function applySnapshot(data) {
    if (!data || !data.word) return false;
    state.word = data.word; state.jumble = data.jumble; state.answers = data.answers || bank.answersOf(data.word);
    state.picked = data.picked || []; state.guess = data.guess || "";
    state.rights = data.rights || 0; state.wrongs = data.wrongs || 0; state.score = data.score || 0;
    state.lastResult = data.lastResult || ""; state.missedThisWord = !!data.missedThisWord;
    state.playerCount = Math.max(1, Math.min(4, data.playerCount || 1));
    state.activePlayer = data.activePlayer == null ? -1 : data.activePlayer;
    board.count = state.playerCount;
    board.scores = (data.scores || [0, 0, 0, 0]).slice();
    board.locked = (data.locked || [false, false, false, false]).slice();
    board.buzzAnim = null;
    state.phase = data.phase || (isMulti() ? "buzz" : "play");
    startTicksForPhase();
    return true;
  }
  function saveGame() {
    if (state.phase === "title" || state.phase === "loading" || state.phase === "error" || !state.word) return;
    GameSave.write(snapshot());
  }
  function applySavedPlayerCount() {
    const data = GameSave.read();
    if (data && data.playerCount) state.playerCount = Math.max(1, Math.min(4, data.playerCount));
  }
  function resize() { chrome.sizeCanvas(ctx); layout(); draw(); }
  function showTitle() {
    clearLock(); ticks.clear(); board.buzzAnim = null;
    chrome.leavePlay();
    applySavedPlayerCount();
    state.phase = "title";
    resize();
  }
  function onLostFocus() {
    if (state.phase === "title" || state.phase === "loading" || state.phase === "error") return;
    saveGame();
    showTitle();
  }
  function startPlay() {
    GameSave.clear();
    board.resetScores(); board.resetRound();
    state.rights = 0; state.wrongs = 0; state.score = 0;
    chrome.enterPlay(resize).then(nextWord);
  }
  function continuePlay() {
    const data = GameSave.read();
    if (!data) return startPlay();
    chrome.enterPlay(resize).then(() => {
      if (!applySnapshot(data)) nextWord();
      else { layout(); draw(); }
    });
  }
  function startTicksForPhase() {
    ticks.clear();
    if (!isMulti()) return;
    if (state.phase === "play" && state.activePlayer >= 0) {
      ticks.start("guess", state.jumble.length * 2);
    } else if (state.phase === "buzz" && board.remaining() > 0 && board.remaining() < state.playerCount) {
      ticks.start("last", state.jumble.length * board.remaining());
    }
  }
  function changePlayers(delta) {
    const next = Math.max(1, Math.min(4, state.playerCount + delta));
    if (next === state.playerCount) return;
    state.playerCount = next;
    GameSave.clear();
    layout(); draw();
  }
  function resetGuess() {
    if (state.phase !== "play" && state.phase !== "wrong") return;
    if (isMulti() && state.phase === "wrong") return;
    state.picked = []; state.guess = ""; state.phase = "play"; applyPlayModes(); draw();
  }
  function clearLock() { if (state.lockTimer) { clearTimeout(state.lockTimer); state.lockTimer = 0; } }
  function returnToBuzz() {
    state.lockTimer = 0; state.picked = []; state.guess = ""; state.activePlayer = -1;
    board.buzzAnim = null; ticks.clear();
    if (board.remaining() <= 0) { state.phase = "revealed"; state.guess = state.word; }
    else { state.phase = "buzz"; if (board.remaining() < state.playerCount ) ticks.start("last", state.jumble.length*board.remaining()); }
    layout(); draw();
  }
  function markWrong() {
    if (state.activePlayer >= 0) { board.scores[state.activePlayer] -= 1; board.locked[state.activePlayer] = true; }
    state.phase = "wrong"; state.lastResult = "wrong"; layout(); draw();
    clearLock(); state.lockTimer = setTimeout(returnToBuzz, 2000);
  }
  function forceWrong() { if (!isMulti() || state.phase !== "play") return; ticks.clear(); markWrong(); }
  function scoreGuess() {
    const hit = state.answers.indexOf(state.guess) !== -1;
    if (hit) {
      ticks.clear(); state.phase = "correct"; state.lastResult = "right";
      if (isMulti() && state.activePlayer >= 0) board.scores[state.activePlayer] += 1;
      else { state.rights += 1; state.score += 10 * state.guess.length; }
      layout(); draw(); return;
    }
    ticks.clear();
    if (isMulti() && state.activePlayer >= 0) { markWrong(); return; }
    state.phase = "wrong"; state.lastResult = "wrong"; state.missedThisWord = true;
    state.wrongs += 1; state.score -= 10; layout(); draw();
  }
  function finishBuzz(index) {
    board.buzzAnim = null; state.activePlayer = index; state.picked = []; state.guess = "";
    state.phase = "play"; ticks.start("guess", state.jumble.length*2); layout(); draw();
  }
  function buzzIn(index) {
    if (state.phase !== "buzz" || board.buzzAnim) return;
    if (index < 0 || index >= state.playerCount || board.locked[index]) return;
    ticks.clear(); board.startBuzz(index); draw();
  }
  function tapSource(index) {
    if (state.phase !== "play" && state.phase !== "wrong") return;
    if (isMulti() && state.phase === "wrong") return;
    const at = state.picked.indexOf(index);
    if (at !== -1) {
      state.picked.splice(at, 1);
      state.guess = state.guess.slice(0, at) + state.guess.slice(at + 1);
      if (state.phase === "wrong") state.phase = "play";
      applyPlayModes(); draw();
      return;
    }
    if (state.phase !== "play") return;
    if (state.guess.length >= state.jumble.length) return;
    state.picked.push(index); state.guess += state.sourceCells[index].letter;
    applyPlayModes(); draw();
    if (state.guess.length === state.jumble.length) scoreGuess();
  }
  function tapGuess(index) {
    if (state.phase !== "play" && state.phase !== "wrong") return;
    if (isMulti() && state.phase === "wrong") return;
    if (index < 0 || index >= state.guess.length) return;
    state.picked.splice(index, 1);
    state.guess = state.guess.slice(0, index) + state.guess.slice(index + 1);
    if (state.phase === "wrong") state.phase = "play";
    applyPlayModes(); draw();
  }
  function reveal() {
    if (state.phase === "loading" || state.phase === "error" || state.phase === "title" || state.phase === "revealed") return;
    if (state.phase === "correct" && isMulti()) return;
    if (board.buzzAnim) return;
    clearLock(); ticks.clear();
    if (!isMulti() && state.phase !== "correct" && !state.missedThisWord) {
      state.score -= 20; if (!state.lastResult) state.lastResult = "";
    }
    state.phase = "revealed"; state.picked = [];
    state.guess = state.lastResult === "right" ? (state.guess || state.word) : state.word;
    layout(); draw();
  }
  function nextWord() {
    if (state.phase === "error" || !bank.ready) return;
    clearLock(); ticks.clear(); board.resetRound();
    state.word = bank.pickWord(); state.jumble = bank.scramble(state.word);
    state.answers = bank.answersOf(state.word); state.picked = []; state.guess = "";
    state.lastResult = ""; state.missedThisWord = false; state.activePlayer = -1;
    state.phase = isMulti() ? "buzz" : "play"; layout(); draw();
  }
  function hitBox(p, b) { return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }
  function hitButton(p) {
    for (let i = 0; i < state.buttons.length; i++) if (hitBox(p, state.buttons[i])) return state.buttons[i];
    return null;
  }
  function onTap(e) {
    if (state.phase === "loading" || state.phase === "error") return;
    const p = chrome.pointFromEvent(e);
    if (state.phase === "title") {
      for (let i = 0; i < state.stepper.length; i++) {
        const s = state.stepper[i];
        if (s.id === "minus" && hitBox(p, s)) return changePlayers(-1);
        if (s.id === "plus" && hitBox(p, s)) return changePlayers(1);
      }
    }
    const btn = hitButton(p);
    if (btn) {
      if (btn.id === "reveal") reveal();
      else if (btn.id === "next") nextWord();
      else if (btn.id === "start") startPlay();
      else if (btn.id === "continue") continuePlay();
      else if (btn.id === "reset") resetGuess();
      return;
    }
    if (state.phase === "buzz") {
      if (board.buzzAnim) return;
      const pad = board.hit(p);
      if (pad) buzzIn(pad.index);
      return;
    }
    if (state.phase === "title") return;
    if (isMulti() && state.phase === "wrong") return;
    for (let i = 0; i < state.guessCells.length; i++) if (state.guessCells[i].contains(p.x, p.y)) return tapGuess(i);
    for (let i = 0; i < state.sourceCells.length; i++) if (state.sourceCells[i].contains(p.x, p.y)) return tapSource(i);
  }
  function drawButton(btn) {
    LetterCell.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fill();
    ctx.strokeStyle = "#888888"; ctx.lineWidth = 1.25; ctx.stroke();
    ctx.fillStyle = "#d0d0d0"; ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }
  function drawStepper() {
    for (let i = 0; i < state.stepper.length; i++) {
      const s = state.stepper[i];
      if (s.id === "label") {
        ctx.fillStyle = "#d0d0d0"; ctx.font = "600 16px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(state.playerCount === 1 ? "1 player" : state.playerCount + " players", s.x + s.w / 2, s.y + s.h / 2 + 1);
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
  function drawScore(w, h) {
    if (isMulti()) return;
    const y = 28;
    const fontSize = Math.max(14, Math.min(w, h) * 0.028);
    ctx.font = "600 " + fontSize + "px system-ui, sans-serif"; ctx.textBaseline = "top";
    const gap = Math.max(28, w * 0.06);
    const items = [
      { label: "RIGHT", value: String(state.rights), color: "#7dffa3" },
      { label: "WRONG", value: String(state.wrongs), color: "#ff6b6b" },
      { label: "SCORE", value: String(state.score), color: "#f2f2f2" },
    ];
    const parts = items.map((item) => item.label + "  " + item.value);
    const widths = parts.map((part) => ctx.measureText(part).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    let x = w / 2 - total / 2;
    for (let i = 0; i < items.length; i++) {
      ctx.textAlign = "left"; ctx.fillStyle = "#777777"; ctx.fillText(items[i].label, x, y);
      const labelW = ctx.measureText(items[i].label + "  ").width;
      ctx.fillStyle = items[i].color; ctx.fillText(items[i].value, x + labelW, y);
      x += widths[i] + gap;
    }
  }
  function draw() {
    const sizeV = chrome.viewSize();
    const w = sizeV.w, h = sizeV.h;
    ctx.fillStyle = "#111111"; ctx.fillRect(0, 0, w, h);
    if (state.phase === "loading" || state.phase === "error") {
      ctx.fillStyle = "#f2f2f2"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "600 " + Math.max(18, Math.min(w, h) * 0.045) + "px system-ui, sans-serif";
      ctx.fillText(state.message, w / 2, h / 2); return;
    }
    if (state.phase === "title") {
      for (let i = 0; i < state.titleCells.length; i++) state.titleCells[i].draw(ctx);
      drawStepper();
      for (let i = 0; i < state.buttons.length; i++) drawButton(state.buttons[i]);
      ctx.fillStyle = "#666666"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.font = "500 " + Math.max(11, Math.min(w, h) * 0.022) + "px system-ui, sans-serif";
      ctx.fillText("v" + VERSION, w - 16, h - 14); return;
    }
    drawScore(w, h);
    for (let i = 0; i < state.guessCells.length; i++) state.guessCells[i].draw(ctx);
    const hint = hintText();
    if (hint) {
      let color = "#666666";
      if (state.phase === "wrong" || (state.lastResult === "wrong" && state.phase === "revealed")) color = "#ff6b6b";
      else if (state.phase === "correct" || (state.lastResult === "right" && state.phase === "revealed")) color = "#7dffa3";
      else if (isMulti() && state.activePlayer >= 0) color = PlayerPad.spec(state.activePlayer).fill;
      else if (board.buzzAnim) color = PlayerPad.spec(board.buzzAnim.player).fill;
      ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "500 " + Math.max(12, Math.min(w, h) * 0.024) + "px system-ui, sans-serif";
      ctx.fillText(hint, w / 2, state.hintY);
    }
    for (let i = 0; i < state.sourceCells.length; i++) state.sourceCells[i].draw(ctx);
    const tickColor = ticks.kind === "last" ? "#f2f2f2" : state.activePlayer >= 0 ? PlayerPad.spec(state.activePlayer).fill : "#f2f2f2";
    ticks.draw(ctx, w, tickColor);
    board.draw(ctx);
    if (state.extraText.length) {
      ctx.fillStyle = "#b0b0b0"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = "500 " + state.extraSize + "px system-ui, sans-serif";
      const lineH = state.extraSize * 1.35;
      for (let i = 0; i < state.extraText.length; i++) ctx.fillText(state.extraText[i], w / 2, state.extraY + i * lineH);
    }
    for (let i = 0; i < state.buttons.length; i++) drawButton(state.buttons[i]);
  }
  function tickFrame() {
    if (board.buzzDone()) finishBuzz(board.buzzAnim.player);
    if (ticks.until) {
      if (ticks.expired()) {
        const kind = ticks.kind; ticks.clear();
        if (kind === "guess") forceWrong(); else if (kind === "last") reveal();
      }
    }
    if (ticks.active || board.buzzAnim) draw();
    requestAnimationFrame(tickFrame);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 200); });
  document.addEventListener("fullscreenchange", resize);
  document.addEventListener("webkitfullscreenchange", resize);
  window.addEventListener("pagehide", onLostFocus);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") onLostFocus();
  });
  canvas.addEventListener("pointerup", onTap);
  window.addEventListener("keydown", (e) => {
    if ((e.code === "Enter" || e.code === "Space") && state.phase === "title") {
      e.preventDefault();
      if (GameSave.exists()) continuePlay(); else startPlay();
    } else if (e.code === "Enter" && (state.phase === "correct" || state.phase === "revealed")) {
      e.preventDefault(); nextWord();
    } else if (e.code === "Escape") { e.preventDefault(); resetGuess();
    }
    else if (e.code === "Space" && state.phase !== "revealed" && state.phase !== "title" && state.phase !== "correct") {
      e.preventDefault(); reveal();
    }
  });
  resize();
  requestAnimationFrame(tickFrame);
  fetch("data/letters.txt?v=" + encodeURIComponent(VERSION))
    .then((res) => {
      if (!res.ok) throw new Error("could not load letters.txt (" + res.status + ")");
      return res.text();
    })
    .then((text) => { bank.parse(text); showTitle(); })
    .catch((err) => { state.phase = "error"; state.message = err.message || "failed to load letters.txt"; draw(); });
})();
