import { SERIAL_OPTIONS } from '../protocol/constants.js';
import { asError, error } from '../errors.js';

/** Native stream locks remain owned until their pending operations actually settle. */
export class WebSerialTransport {
  constructor(port) {
    this.port = port; this.reader = null; this.writer = null;
    this.readPending = null; this.writePending = null; this.closing = false;
  }
  open() {
    this.opening = Promise.resolve(this.port.open({ ...SERIAL_OPTIONS })).then(() => {
      if (!this.port.readable || !this.port.writable) throw error('connection', 'Serial port has no readable/writable streams', { fatal: true });
      this.writer = this.port.writable.getWriter();
    });
    return this.opening;
  }
  async read() {
    if (this.closing) return { done: true };
    if (!this.reader) {
      this.readable = this.port.readable;
      if (!this.readable) return { done: true };
      this.reader = this.readable.getReader();
    }
    const pending = this.reader.read(); this.readPending = pending;
    try { return await pending; } finally { if (this.readPending === pending) this.readPending = null; }
  }
  async replaceReader() {
    if (this.readPending) await this.readPending.catch(() => {});
    this.reader?.releaseLock(); this.reader = null;
    // A recoverable native error creates a replacement readable stream.
    return !this.closing && this.port.readable !== null && this.port.readable !== this.readable;
  }
  async write(bytes) {
    if (this.closing || !this.writer) throw error('connection', 'Serial writer is unavailable', { fatal: true });
    const pending = this.writer.write(bytes); this.writePending = pending;
    try { await pending; }
    catch (cause) { const failure = asError(cause); failure.fatal = true; throw failure; }
    finally { if (this.writePending === pending) this.writePending = null; }
  }
  onDisconnect(callback) {
    this.port.addEventListener('disconnect', callback);
    return () => this.port.removeEventListener('disconnect', callback);
  }
  close() {
    if (this.closure) return this.closure;
    this.closing = true;
    this.closure = (async () => {
      let first;
      try { await this.opening; } catch { /* Failed open still needs any acquired locks released. */ }
      if (this.reader) {
        try { await this.reader.cancel(); } catch (e) { first = e; }
        if (this.readPending) await this.readPending.catch(() => {});
        try { this.reader.releaseLock(); } catch (e) { first ??= e; }
        this.reader = null;
      }
      if (this.writer) {
        if (this.writePending) {
          // abort can itself wait for an active underlying write; the adapter's
          // bounded close reports this while retaining late cleanup ownership.
          const abort = this.writer.abort().catch(e => { first ??= e; });
          await this.writePending.catch(() => {}); await abort;
        }
        try { this.writer.releaseLock(); } catch (e) { first ??= e; }
        this.writer = null;
      }
      try { if (this.port.readable || this.port.writable) await this.port.close(); }
      catch (e) { first ??= e; }
      if (first) throw asError(first);
    })();
    return this.closure;
  }
}
