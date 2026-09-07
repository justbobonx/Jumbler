(() => {
  const VERSION = window.VERSION || "0.8.5";
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
  const view = new PlayView(chrome, board, ticks);
  const game = new Play(view, bank, board, ticks, chrome, VERSION);

  function paint(resizeCanvas) {
    if (resizeCanvas) chrome.sizeCanvas(ctx);
    view.layout(ctx, game);
    view.draw(ctx, game);
  }

  game.refresh = function () { paint(false); };
  game.onResize = function () { paint(true); };

  function tickFrame() {
    const beforePhase = game.phase;
    const beforePlayer = game.activePlayer;
    game.tick();
    if (game.needsFrame() || game.phase !== beforePhase || game.activePlayer !== beforePlayer) paint(false);
    requestAnimationFrame(tickFrame);
  }

  window.addEventListener("resize", game.onResize);
  window.addEventListener("orientationchange", function () { setTimeout(game.onResize, 200); });
  document.addEventListener("fullscreenchange", game.onResize);
  document.addEventListener("webkitfullscreenchange", game.onResize);
  window.addEventListener("pagehide", function () {
    game.onLostFocus();
    paint(true);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      game.onLostFocus();
      paint(true);
    }
  });
  canvas.addEventListener("pointerup", function (e) {
    const result = game.onTap(chrome.pointFromEvent(e));
    if (result && typeof result.then === "function") result.then(function () { paint(true); });
    else paint(false);
  });
  window.addEventListener("keydown", function (e) {
    const result = game.onKey(e);
    if (result && typeof result.then === "function") result.then(function () { paint(true); });
    else paint(false);
  });

  paint(true);
  requestAnimationFrame(tickFrame);
  fetch("data/letters.txt?v=" + encodeURIComponent(VERSION))
    .then((res) => {
      if (!res.ok) throw new Error("could not load letters.txt (" + res.status + ")");
      return res.text();
    })
    .then((text) => {
      bank.parse(text);
      game.showTitle();
      paint(true);
    })
    .catch((err) => {
      game.phase = "error";
      game.message = err.message || "failed to load letters.txt";
      paint(false);
    });
})();
