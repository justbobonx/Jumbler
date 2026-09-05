class GameSave {
  static KEY = "JumblerSave";

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
}
