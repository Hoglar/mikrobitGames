import { error, freeze } from './errors.js';

export function createSession(adapter) {
  const subscriptions = { state: new Set(), press: new Set(), gesture: new Set() };
  const session = { closed: false, operation: null };
  const add = (channel, callback) => {
    if (session.closed) throw error('disposed', 'Game session was disposed');
    if (typeof callback !== 'function') throw error('validation', 'Subscription requires a callback');
    const item = { callback, active: true };
    subscriptions[channel].add(item);
    const unsubscribe = () => { item.active = false; subscriptions[channel].delete(item); };
    if (channel === 'state') {
      try { callback(adapter.getState()); } catch (cause) { adapter.callbackError(cause); }
    }
    return unsubscribe;
  };
  session.deliver = (channel, value, state) => {
    for (const item of [...subscriptions[channel]]) {
      if (session.closed || !adapter.notificationCurrent(session, state)) break;
      if (!item.active) continue;
      try { item.callback(value); } catch (cause) { adapter.callbackError(cause); }
    }
  };
  session.clear = () => {
    session.closed = true;
    for (const list of Object.values(subscriptions)) { for (const item of list) item.active = false; list.clear(); }
  };
  const send = (action, value) => session.closed ? Promise.reject(error('disposed', 'Game session was disposed')) : adapter.output(session, action, value);
  session.facade = freeze({
    inputs: { subscribe: cb => add('state', cb), onPress: cb => add('press', cb), onGesture: cb => add('gesture', cb) },
    outputs: {
      display: { showText: text => send('display.showText', text), showImage: pixels => send('display.showImage', pixels), clear: () => send('display.clear') },
      speaker: { playTone: options => send('speaker.playTone', options), playMelody: options => send('speaker.playMelody', options),
        playBuiltInSound: name => send('speaker.playBuiltInSound', name), stop: () => send('speaker.stop') }
    },
    dispose: () => adapter.disposeSession(session)
  });
  return session;
}
