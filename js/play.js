class Play {
  constructor(view, bank, board, ticks, chrome, version) {
    this.view = view;
    this.bank = bank;
    this.board = board;
    this.ticks = ticks;
    this.chrome = chrome;
    this.version = version;
    this.word = "";
    this.jumble = "";
    this.answers = [];
    this.phase = "loading";
    this.message = "loading letters\u2026";
    this.picked = [];
    this.guess = "";
    this.rights = 0;
    this.wrongs = 0;
    this.score = 0;
    this.hiScore = GameSave.readHi();
    this.lastResult = "";
    this.missedThisWord = false;
    this.lockTimer = 0;
    this.playerCount = 1;
    this.activePlayer = -1;
    this.timed = false;
    this.turns = false;
    this.turn = 0;
    this.steals = false;
    this.dealt = false;
    this.refresh = function () {};
    this.onResize = function () {};
    const opts = GameSave.readOpts();
    if (opts) {
      this.timed = !!opts.timed;
      this.turns = !!opts.turns;
      if (opts.playerCount) this.playerCount = Math.max(1, Math.min(4, opts.playerCount));
    }
  }

  isMulti() {
    return this.playerCount > 1;
  }

  usesTurns() {
    return this.turns && this.isMulti();
  }

  extrasForDisplay() {
    const shown = this.guess || this.word;
    return this.answers.filter((w) => w !== shown);
  }

  bigWord() {
    if (this.phase === "correct") return this.guess || this.word;
    if (this.phase === "revealed") return this.word;
    return this.jumble;
  }

  solvedMode() {
    if (this.phase === "correct") return "correct";
    if (this.phase === "revealed" && this.lastResult === "right") return "correct";
    if (this.phase === "revealed") return "revealed";
    return "";
  }

  hintText() {
    if (this.phase === "buzz") {
      return this.board.remaining() === 1 ? "last player \u00b7 buzz in" : "buzz in";
    }
    if (this.phase === "play") {
      if (this.isMulti() && this.activePlayer >= 0) return PlayerPad.spec(this.activePlayer).name + " \u00b7 tap letters to spell";
      return "tap letters to spell";
    }
    if (this.phase === "wrong") return "wrong";
    if (this.phase === "correct") return "right";
    if (this.phase === "revealed") return this.lastResult === "wrong" ? "wrong" : this.lastResult === "right" ? "right" : "";
    return "";
  }

  bumpHi() {
    if (this.isMulti()) return;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      GameSave.writeHi(this.hiScore);
    }
  }

  saveOpts() {
    GameSave.writeOpts({ timed: this.timed, turns: this.turns, playerCount: this.playerCount });
  }

  snapshot() {
    return {
      word: this.word, jumble: this.jumble, answers: this.answers.slice(),
      phase: this.phase === "wrong" ? "buzz" : this.phase,
      picked: this.picked.slice(), guess: this.phase === "wrong" ? "" : this.guess,
      rights: this.rights, wrongs: this.wrongs, score: this.score,
      lastResult: this.lastResult, missedThisWord: this.missedThisWord,
      playerCount: this.playerCount, activePlayer: this.phase === "wrong" ? -1 : this.activePlayer,
      scores: this.board.scores.slice(), locked: this.board.locked.slice(),
      out: (this.board.out || [false, false, false, false]).slice(),
      timed: this.timed, turns: this.turns, turn: this.turn, steals: this.steals,
    };
  }

  applySnapshot(data) {
    if (!data || !data.word) return false;
    this.word = data.word;
    this.jumble = data.jumble;
    this.answers = data.answers || this.bank.answersOf(data.word);
    this.picked = data.picked || [];
    this.guess = data.guess || "";
    this.rights = data.rights || 0;
    this.wrongs = data.wrongs || 0;
    this.score = data.score || 0;
    this.bumpHi();
    this.lastResult = data.lastResult || "";
    this.missedThisWord = !!data.missedThisWord;
    this.playerCount = Math.max(1, Math.min(4, data.playerCount || 1));
    this.activePlayer = data.activePlayer == null ? -1 : data.activePlayer;
    this.timed = !!data.timed;
    this.turns = !!data.turns;
    this.turn = data.turn || 0;
    this.steals = !!data.steals;
    this.dealt = true;
    this.board.count = this.playerCount;
    this.board.scores = (data.scores || [0, 0, 0, 0]).slice();
    this.board.locked = (data.locked || [false, false, false, false]).slice();
    this.board.out = (data.out || this.board.locked.slice()).slice();
    this.board.buzzAnim = null;
    this.phase = data.phase || (this.isMulti() ? "buzz" : "play");
    if (this.usesTurns() && !this.steals) this.lockToTurn();
    this.startTicksForPhase();
    this.saveOpts();
    return true;
  }

  saveGame() {
    if (this.phase === "title" || this.phase === "loading" || this.phase === "error" || !this.word) return;
    GameSave.write(this.snapshot());
  }

  applySavedPlayerCount() {
    const data = GameSave.read();
    if (data && data.playerCount) this.playerCount = Math.max(1, Math.min(4, data.playerCount));
    const opts = GameSave.readOpts();
    if (opts) {
      this.timed = !!opts.timed;
      this.turns = !!opts.turns;
      if (!data && opts.playerCount) this.playerCount = Math.max(1, Math.min(4, opts.playerCount));
    }
  }

  startTicksForPhase() {
    this.ticks.clear();
    if (!this.timed) return;
    if (!this.isMulti()) {
      if (this.phase === "play") this.ticks.startGuess(this.jumble.length);
      return;
    }
    if (this.phase === "play" && this.activePlayer >= 0) this.ticks.startGuess(this.jumble.length);
    else if (this.phase === "buzz" && !(this.usesTurns() && !this.steals) && this.board.remaining() > 0 && this.board.remaining() < this.playerCount) {
      this.ticks.startLast(this.jumble.length, this.board.remaining());
    }
  }

  clearLock() {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = 0;
    }
  }

  showTitle() {
    this.clearLock();
    this.ticks.clear();
    this.board.buzzAnim = null;
    this.chrome.leavePlay();
    this.applySavedPlayerCount();
    this.phase = "title";
  }

  onLostFocus() {
    if (this.phase === "title" || this.phase === "loading" || this.phase === "error") return;
    this.saveGame();
    this.showTitle();
  }

  startPlay() {
    GameSave.clear();
    this.board.resetScores();
    this.board.resetRound();
    this.rights = 0;
    this.wrongs = 0;
    this.score = 0;
    this.turn = 0;
    this.steals = false;
    this.dealt = false;
    return this.chrome.enterPlay(() => this.onResize()).then(() => this.nextWord());
  }

  continuePlay() {
    const data = GameSave.read();
    if (!data) return this.startPlay();
    return this.chrome.enterPlay(() => this.onResize()).then(() => {
      if (!this.applySnapshot(data)) this.nextWord();
    });
  }

  changePlayers(delta) {
    const next = Math.max(1, Math.min(4, this.playerCount + delta));
    if (next === this.playerCount) return;
    this.playerCount = next;
    this.turn = 0;
    GameSave.clear();
    this.saveOpts();
  }

  setOption(id) {
    if (id === "timed") this.timed = !this.timed;
    else if (id === "turns") this.turns = !this.turns;
    else return;
    GameSave.clear();
    this.saveOpts();
  }

  lockToTurn() {
    for (let i = 0; i < this.playerCount; i++) this.board.locked[i] = i !== this.turn;
  }

  advanceTurn() {
    if (this.playerCount > 0) this.turn = (this.turn + 1) % this.playerCount;
  }

  openSteals() {
    this.steals = true;
    this.picked = [];
    this.guess = "";
    this.activePlayer = -1;
    this.board.buzzAnim = null;
    for (let i = 0; i < this.playerCount; i++) this.board.locked[i] = !!this.board.out[i];
    this.phase = "buzz";
    this.startTicksForPhase();
  }

  resetGuess() {
    if (this.phase !== "play" && this.phase !== "wrong") return;
    if (this.isMulti() && this.phase === "wrong") return;
    this.picked = [];
    this.guess = "";
    this.phase = "play";
    this.startTicksForPhase();
  }

  returnToBuzz() {
    this.lockTimer = 0;
    this.picked = [];
    this.guess = "";
    this.activePlayer = -1;
    this.board.buzzAnim = null;
    this.ticks.clear();
    if (this.board.remaining() <= 0 && !this.usesTurns()) {
      this.phase = "revealed";
      this.guess = this.word;
    } else {
      this.phase = "buzz";
      if (this.usesTurns() && !this.steals) this.lockToTurn();
      this.startTicksForPhase();
    }
  }

  markWrong() {
    if (this.activePlayer >= 0) {
      this.board.scores[this.activePlayer] -= 1;
      this.board.out[this.activePlayer] = true;
      this.board.locked[this.activePlayer] = true;
    }
    this.phase = "wrong";
    this.lastResult = "wrong";
    this.clearLock();
    this.lockTimer = setTimeout(() => {
      if (this.usesTurns()) this.openSteals();
      else this.returnToBuzz();
      this.refresh();
    }, 2000);
  }

  forceWrong() {
    if (!this.isMulti() || this.phase !== "play") {
      if (!this.isMulti() && this.phase === "play") {
        this.ticks.clear();
        this.missedThisWord = true;
        this.wrongs += 1;
        this.score -= 10;
        this.lastResult = "wrong";
        this.phase = "revealed";
        this.picked = [];
        this.guess = this.word;
      }
      return;
    }
    this.ticks.clear();
    this.markWrong();
  }

  scoreGuess() {
    const hit = this.answers.indexOf(this.guess) !== -1;
    if (hit) {
      this.ticks.clear();
      this.phase = "correct";
      this.lastResult = "right";
      if (this.isMulti() && this.activePlayer >= 0) this.board.scores[this.activePlayer] += 1;
      else {
        this.rights += 1;
        this.score += 10 * this.guess.length;
        this.bumpHi();
      }
      return;
    }
    this.ticks.clear();
    if (this.isMulti() && this.activePlayer >= 0) {
      this.markWrong();
      return;
    }
    this.phase = "wrong";
    this.lastResult = "wrong";
    this.missedThisWord = true;
    this.wrongs += 1;
    this.score -= 10;
  }

  finishBuzz(index) {
    this.board.buzzAnim = null;
    this.activePlayer = index;
    this.picked = [];
    this.guess = "";
    this.phase = "play";
    this.ticks.startGuess(this.jumble.length);
    if (!this.timed) this.ticks.clear();
  }

  buzzIn(index) {
    if (this.phase !== "buzz") return;
    if (index < 0 || index >= this.playerCount || this.board.locked[index]) return;
    this.ticks.clear();
    this.finishBuzz(index);
  }

  tapSource(index) {
    if (this.phase !== "play" && this.phase !== "wrong") return;
    if (this.isMulti() && this.phase === "wrong") return;
    const at = this.picked.indexOf(index);
    if (at !== -1) {
      this.picked.splice(at, 1);
      this.guess = this.guess.slice(0, at) + this.guess.slice(at + 1);
      if (this.phase === "wrong") this.phase = "play";
      return;
    }
    if (this.phase !== "play") return;
    if (this.guess.length >= this.jumble.length) return;
    this.picked.push(index);
    this.guess += this.view.sourceLetter(index);
    if (this.guess.length === this.jumble.length) this.scoreGuess();
  }

  tapGuess(index) {
    if (this.phase !== "play" && this.phase !== "wrong") return;
    if (this.isMulti() && this.phase === "wrong") return;
    if (index < 0 || index >= this.guess.length) return;
    this.picked.splice(index, 1);
    this.guess = this.guess.slice(0, index) + this.guess.slice(index + 1);
    if (this.phase === "wrong") this.phase = "play";
  }

  reveal() {
    if (this.phase === "loading" || this.phase === "error" || this.phase === "title" || this.phase === "revealed") return;
    if (this.phase === "correct" && this.isMulti()) return;
    if (this.usesTurns()) {
      this.clearLock();
      this.ticks.clear();
      if (this.steals) {
        this.phase = "revealed";
        this.picked = [];
        this.guess = this.word;
        if (this.lastResult !== "right") this.lastResult = "wrong";
        return;
      }
      const who = this.activePlayer >= 0 ? this.activePlayer : this.turn;
      this.board.out[who] = true;
      this.board.locked[who] = true;
      this.openSteals();
      return;
    }
    if (this.isMulti() && this.activePlayer >= 0 && (this.phase === "play" || this.phase === "wrong")) {
      this.ticks.clear();
      this.markWrong();
      return;
    }
    this.clearLock();
    this.ticks.clear();
    if (!this.isMulti() && this.phase !== "correct") {
      if (!this.missedThisWord) {
        this.wrongs += 1;
        this.score -= 20;
        this.missedThisWord = true;
      }
      if (this.lastResult !== "right") this.lastResult = "wrong";
    }
    this.phase = "revealed";
    this.picked = [];
    this.guess = this.lastResult === "right" ? (this.guess || this.word) : this.word;
  }

  nextWord() {
    if (this.phase === "error" || !this.bank.ready) return;
    this.clearLock();
    this.ticks.clear();
    if (this.dealt) this.advanceTurn();
    this.dealt = true;
    this.steals = false;
    this.board.resetRound();
    if (this.usesTurns()) this.lockToTurn();
    this.word = this.bank.pickWord();
    this.jumble = this.bank.scramble(this.word);
    this.answers = this.bank.answersOf(this.word);
    this.picked = [];
    this.guess = "";
    this.lastResult = "";
    this.missedThisWord = false;
    this.activePlayer = -1;
    this.phase = this.isMulti() ? "buzz" : "play";
    this.startTicksForPhase();
  }

  onTap(p) {
    if (this.phase === "loading" || this.phase === "error") return;
    if (this.phase === "title") {
      const step = this.view.hitStepper(p);
      if (step && step.id === "minus") return this.changePlayers(-1);
      if (step && step.id === "plus") return this.changePlayers(1);
      if (step && (step.id === "timed" || step.id === "turns")) return this.setOption(step.id);
    }
    const btn = this.view.hitButton(p);
    if (btn) {
      if (btn.id === "reveal") this.reveal();
      else if (btn.id === "next") this.nextWord();
      else if (btn.id === "start") return this.startPlay();
      else if (btn.id === "continue") return this.continuePlay();
      else if (btn.id === "reset") this.resetGuess();
      return;
    }
    if (this.phase === "buzz") {
      const pad = this.board.hit(p);
      if (pad) this.buzzIn(pad.index);
      return;
    }
    if (this.phase === "title") return;
    if (this.isMulti() && this.phase === "wrong") return;
    const guessAt = this.view.hitGuess(p);
    if (guessAt !== -1) return this.tapGuess(guessAt);
    const sourceAt = this.view.hitSource(p);
    if (sourceAt !== -1) this.tapSource(sourceAt);
  }

  onKey(e) {
    if ((e.code === "Enter" || e.code === "Space") && this.phase === "title") {
      e.preventDefault();
      return GameSave.exists() ? this.continuePlay() : this.startPlay();
    }
    if (e.code === "Enter" && (this.phase === "correct" || this.phase === "revealed")) {
      e.preventDefault();
      this.nextWord();
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      this.resetGuess();
      return;
    }
    if (e.code === "Space" && this.phase !== "revealed" && this.phase !== "title" && this.phase !== "correct") {
      e.preventDefault();
      this.reveal();
    }
  }

  tick() {
    if (this.ticks.until && this.ticks.expired()) {
      const kind = this.ticks.kind;
      this.ticks.clear();
      if (kind === "guess") this.forceWrong();
      else if (kind === "last") this.reveal();
    }
  }

  needsFrame() {
    return this.ticks.active;
  }
}
