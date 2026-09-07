class WordBank {
  static LENGTHS = [5, 6, 7, 8];

  constructor() {
    this.lines = [];
    this.groups = Object.create(null);
  }

  static signature(word) {
    return String(word).toLowerCase().split("").sort().join("");
  }

  static stays(word, jumble) {
    let n = 0;
    const a = String(word);
    const b = String(jumble);
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) if (a[i] === b[i]) n += 1;
    return n;
  }

  parse(text) {
    const raw = String(text).replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
    const lines = [];
    const groups = Object.create(null);

    for (let i = 0; i < WordBank.LENGTHS.length; i++) {
      const line = (raw[i] || "").replace(/\s+/g, "");
      const len = WordBank.LENGTHS[i];
      if (line.length < len || line.length % len !== 0) {
        throw new Error("line " + (i + 1) + " is not a clean pack of " + len + "-letter words");
      }
      lines.push(line);

      const seen = Object.create(null);
      for (let pos = 0; pos < line.length; pos += len) {
        const word = line.substr(pos, len).toUpperCase();
        if (seen[word]) continue;
        seen[word] = true;
        const key = len + ":" + WordBank.signature(word);
        if (!groups[key]) groups[key] = [];
        groups[key].push(word);
      }
    }

    for (const key in groups) groups[key].sort();
    this.lines = lines;
    this.groups = groups;
    return this;
  }

  get ready() {
    return this.lines.length === WordBank.LENGTHS.length;
  }

  pickWord() {
    const lineIndex = Math.floor(Math.random() * WordBank.LENGTHS.length);
    const len = WordBank.LENGTHS[lineIndex];
    const packed = this.lines[lineIndex];
    const count = packed.length / len;
    const index = Math.floor(Math.random() * count);
    return packed.substr(index * len, len).toUpperCase();
  }

  scramble(word) {
    const source = String(word);
    const letters = source.split("");
    if (letters.length < 2) return source;
    let out = source;
    for (let attempt = 0; attempt < 20; attempt++) {
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = letters[i];
        letters[i] = letters[j];
        letters[j] = tmp;
      }
      out = letters.join("");
      if (WordBank.stays(source, out) <= 2) return out;
    }
    return out;
  }

  answersOf(word) {
    const key = word.length + ":" + WordBank.signature(word);
    return (this.groups[key] || [word]).slice();
  }
}
