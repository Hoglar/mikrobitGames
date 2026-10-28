/** Public errors retain their kind and optional wire correlation. */
export class MicrobitError extends Error {
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'MicrobitError';
    this.kind = kind;
    Object.assign(this, details);
  }
}
export const error = (kind, message, details) => new MicrobitError(kind, message, details);
export const asError = (cause, kind = 'connection') => cause instanceof MicrobitError
  ? cause : error(kind, cause?.message || String(cause), { cause });
export function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export const systemClock = Object.freeze({ now: () => globalThis.performance.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: id => globalThis.clearTimeout(id) });
export function within(promise, clock, ms, label) {
  return new Promise((resolve, reject) => {
    const began = clock.now();
    let timer;
    const tick = () => {
      const left = ms - (clock.now() - began);
      if (left > 0) timer = clock.setTimeout(tick, left);
      else reject(error('timeout', `${label} timed out`, { fatal: true }));
    };
    timer = clock.setTimeout(tick, ms);
    Promise.resolve(promise).then(value => { clock.clearTimeout(timer); resolve(value); },
      reason => { clock.clearTimeout(timer); reject(reason); });
  });
}
