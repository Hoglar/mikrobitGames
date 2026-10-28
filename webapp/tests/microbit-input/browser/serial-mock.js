/** Installed with addInitScript before the page imports production modules. */
export function installSerialMock({ info, snapshot }) {
  const encoder = new TextEncoder();
  class MockPort extends EventTarget {
    constructor() { super(); this.connected = true; this.n = 0; this.u = 0; this.ac = 0; this.bc = 0; this.qc = 0; this.records = []; this.sending = false; this.pending = ''; this.closeCalls = 0; }
    async open(options) {
      if (window.serialMock.failOpen) throw new DOMException('Open rejected', 'NetworkError');
      this.options = options; this.connected = true;
      this.makeReadable();
      this.writable = new WritableStream({ write: async bytes => {
        this.records.push({ at: performance.now(), bytes: [...bytes] });
        for (const byte of bytes) {
          if (byte === 10) { const line = this.pending; this.pending = ''; this.line(line); }
          else this.pending += String.fromCharCode(byte);
        }
      } });
    }
    makeReadable() {
      this.readable = new ReadableStream({ start: controller => { this.controller = controller; }, cancel: () => { this.canceled = true; } });
      this.canceled = false;
    }
    emit(text) { if (!this.canceled && this.connected && this.controller) this.controller.enqueue(encoder.encode(text)); }
    sample(set = {}) {
      const s = { ...snapshot, ...this.latest, n: this.n++, u: this.u, ac: this.ac, bc: this.bc, qc: this.qc, ...set };
      this.latest = s;
      this.n = s.n + 1; this.u = (s.u + 20) % 4294967296; this.ac = s.ac; this.bc = s.bc; this.qc = s.qc;
      this.emit(JSON.stringify(s) + '\n');
    }
    line(line) {
      if (line === 'HELLO|1') {
        this.hellos = (this.hellos ?? 0) + 1;
        this.emit(JSON.stringify(window.serialMock.info) + '\n');
        if (!window.serialMock.infoOnly && !window.serialMock.silent) this.sample();
        this.sending = true;
        if (!this.timer) this.timer = setInterval(() => { if (this.sending && !window.serialMock.silent) this.sample(); }, 20);
      } else if (line.startsWith('C|')) {
        window.serialMock.commands.push(line);
        this.emit(`R|1|${line.split('|')[2]}|${window.serialMock.result ?? 'OK'}\n`);
      }
    }
    async close() {
      this.closeCalls++; clearInterval(this.timer); this.timer = null; this.sending = false;
      this.closeLocked = !!this.readable?.locked || !!this.writable?.locked;
      if (this.closeLocked) throw new Error('Port close called while a stream was locked');
      this.readable = null; this.writable = null;
    }
    remove() { this.connected = false; clearInterval(this.timer); this.timer = null; this.dispatchEvent(new Event('disconnect')); }
    readError() { this.controller.error(new DOMException('Recoverable framing error', 'NetworkError')); this.makeReadable(); }
  }
  const serial = new EventTarget(), port = new MockPort();
  window.serialMock = { port, info, commands: [], choices: 0, silent: false };
  serial.requestPort = async () => {
    window.serialMock.choices++;
    if (window.serialMock.deny) throw new DOMException('Permission denied', 'NotFoundError');
    return port;
  };
  Object.defineProperty(navigator, 'serial', { configurable: true, value: serial });
}
