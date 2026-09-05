class PlayChrome {
  constructor(container, canvas, gate) {
    this.container = container;
    this.canvas = canvas;
    this.gate = gate;
    this.active = false;
    this.wait = null;
    this.wakeLock = null;
  }

  viewSize() {
    return {
      w: this.container.clientWidth || window.innerWidth,
      h: this.container.clientHeight || window.innerHeight,
    };
  }

  tallViewport() {
    return window.innerHeight > window.innerWidth;
  }

  stageSwapped() {
    return document.documentElement.classList.contains("stage-swap");
  }

  applyStage() {
    document.documentElement.classList.toggle("stage-swap", this.active && this.tallViewport());
  }

  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  showGate() {
    if (this.gate) this.gate.classList.add("show");
  }

  hideGate() {
    if (this.gate) this.gate.classList.remove("show");
  }

  requestPageFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (!req) return Promise.resolve();
    try {
      const p = req.call(el);
      if (p && typeof p.then === "function") return p.catch(function () {});
    } catch (err) {}
    return Promise.resolve();
  }

  exitFullscreen() {
    if (!this.isFullscreen()) return;
    const ex = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (!ex) return;
    try {
      const p = ex.call(document);
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (err) {}
  }

  requestWakeLock() {
    const api = navigator.wakeLock;
    if (!api || typeof api.request !== "function") return Promise.resolve();
    return api.request("screen").then((lock) => {
      this.wakeLock = lock;
      lock.addEventListener("release", () => {
        if (this.wakeLock === lock) this.wakeLock = null;
      });
    }).catch(function () {});
  }

  releaseWakeLock() {
    const lock = this.wakeLock;
    this.wakeLock = null;
    if (lock && typeof lock.release === "function") {
      try { lock.release(); } catch (err) {}
    }
  }

  waitSettled(onResize) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        document.removeEventListener("fullscreenchange", onFs);
        document.removeEventListener("webkitfullscreenchange", onFs);
        resolve();
      };
      const onFs = () => {
        this.applyStage();
        if (onResize) onResize();
        setTimeout(finish, 80);
      };
      document.addEventListener("fullscreenchange", onFs);
      document.addEventListener("webkitfullscreenchange", onFs);
      setTimeout(finish, 750);
    });
  }

  enterPlay(onResize) {
    if (this.wait) return this.wait;
    this.active = true;
    this.wait = this.run(onResize).then(() => { this.wait = null; }, () => { this.wait = null; });
    return this.wait;
  }

  leavePlay() {
    this.active = false;
    this.releaseWakeLock();
    this.exitFullscreen();
    document.documentElement.classList.remove("stage-swap");
  }

  run(onResize) {
    this.applyStage();
    const gateNeeded = this.tallViewport() && !this.stageSwapped();
    if (gateNeeded) this.showGate();
    const fs = this.isFullscreen() ? Promise.resolve() : this.requestPageFullscreen();
    return fs.then(() => {
      this.applyStage();
      if (gateNeeded) return this.waitSettled(onResize);
    }).then(() => {
      this.applyStage();
      if (onResize) onResize();
      this.hideGate();
      return this.requestWakeLock();
    });
  }

  sizeCanvas(ctx) {
    this.applyStage();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const size = this.viewSize();
    this.canvas.width = Math.floor(size.w * dpr);
    this.canvas.height = Math.floor(size.h * dpr);
    this.canvas.style.width = size.w + "px";
    this.canvas.style.height = size.h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return size;
  }

  pointFromEvent(e) {
    const r = this.canvas.getBoundingClientRect();
    if (!this.stageSwapped()) {
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return {
      x: dy + this.canvas.clientWidth / 2,
      y: -dx + this.canvas.clientHeight / 2,
    };
  }
}
