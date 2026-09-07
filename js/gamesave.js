class GameSave {
  static KEY = "JumblerSave";
  static HI_KEY = "JumblerHi";

  static read() {
    try {
      const raw = localStorage.getItem(GameSave.KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.word ? data : null;
    } catch (err) {
      return null;
    }
  }

  static exists() {
    return !!GameSave.read();
  }

  static write(data) {
    try {
      localStorage.setItem(GameSave.KEY, JSON.stringify(data));
    } catch (err) {}
  }

  static clear() {
    try {
      localStorage.removeItem(GameSave.KEY);
    } catch (err) {}
  }

  static readHi() {
    try {
      const n = parseInt(localStorage.getItem(GameSave.HI_KEY), 10);
      return Number.isFinite(n) ? n : 0;
    } catch (err) {
      return 0;
    }
  }

  static writeHi(n) {
    try {
      localStorage.setItem(GameSave.HI_KEY, String(n));
    } catch (err) {}
  }
}
