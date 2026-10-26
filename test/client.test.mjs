import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function createHarness() {
  const oscillators = [];
  const listeners = new Map();

  class FakeParam {
    constructor() {
      this.value = undefined;
    }
    setValueAtTime(value) {
      this.value = value;
    }
    linearRampToValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }

  class FakeNode {
    constructor() {
      this.frequency = new FakeParam();
      this.gain = new FakeParam();
      this.type = 'sine';
    }
    connect() {
      return this;
    }
    start() {}
    stop() {}
  }

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
    }
    createGain() {
      return new FakeNode();
    }
    createOscillator() {
      const node = new FakeNode();
      oscillators.push(node);
      return node;
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    addEventListener() {}
    close() {
      return Promise.resolve();
    }
  }

  const window = {
    __ModuleLoader__: {
      load(definition) {
        captured = definition;
      },
    },
    AudioContext: FakeAudioContext,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener() {},
  };

  let captured;
  const React = {
    createElement() {
      return {};
    },
    useState(initial) {
      return [initial, () => {}];
    },
    useEffect() {},
  };

  const context = vm.createContext({
    window,
    require(id) {
      if (id === 'react') return React;
      throw new Error(`unexpected require: ${id}`);
    },
    console,
    Date,
  });
  vm.runInContext(source, context);

  const plugin = captured.factory((id) => {
    if (id === 'react') return React;
    throw new Error(`unexpected require: ${id}`);
  });

  const observable = (initial) => {
    let value = initial;
    const watchers = new Set();
    return {
      getSnapshot: () => value,
      subscribe(listener) {
        watchers.add(listener);
        return () => watchers.delete(listener);
      },
      publish(next) {
        value = next;
        for (const listener of [...watchers]) listener();
      },
    };
  };

  const statuses = observable(new Map());
  const sessions = observable({ byId: {}, ids: [], phase: 'ready' });
  let registration = null;

  const ctx = {
    uiSession: { sessionStatus: statuses },
    sessions: { list: sessions },
    effect(callback) {
      return callback();
    },
    locale: {
      register() {
        return () => {};
      },
      bind() {
        return (key) => key;
      },
    },
    slots: {
      inject(name, callback) {
        assert.equal(name, 'settings.general.item');
        callback();
      },
      register(options, component) {
        registration = { options, component };
        return () => {};
      },
    },
  };

  plugin.apply(ctx);

  return {
    plugin,
    registration,
    oscillators,
    publishStatuses(entries) {
      statuses.publish(new Map(entries));
    },
    publishSessions(byId) {
      sessions.publish({ byId, ids: Object.keys(byId), phase: 'ready' });
    },
  };
}

test('registers the expected client plugin surface', () => {
  const harness = createHarness();
  assert.deepEqual([...harness.plugin.inject].sort(), ['locale', 'sessions', 'slots', 'uiSession']);
  assert.equal(harness.registration.options.id, 'notification-chime');
  assert.equal(harness.registration.options.name, 'settings.general.item');
  assert.equal(typeof harness.registration.component, 'function');
});

test('chimes on completion, approval, and only for user-facing sessions', () => {
  const harness = createHarness();

  harness.publishSessions({ s1: { origin: undefined }, child: { origin: 'subagent' } });
  harness.publishStatuses([
    ['s1', { running: true, pendingInteraction: undefined, completionUnread: false }],
  ]);
  assert.equal(harness.oscillators.length, 0, 'the first snapshot is a silent baseline');

  harness.publishStatuses([
    ['s1', { running: false, pendingInteraction: undefined, completionUnread: true }],
  ]);
  assert.equal(harness.oscillators.length, 4, 'completion schedules four tones');
  assert.deepEqual(
    harness.oscillators.map((node) => node.frequency.value),
    [523.25, 659.25, 987.77, 1318.51],
  );

  harness.publishStatuses([
    ['s1', { running: true, pendingInteraction: { kind: 'approval' }, completionUnread: false }],
  ]);
  assert.equal(harness.oscillators.length, 7, 'approval schedules three tones');
  assert.ok(
    harness.oscillators.slice(4).every((node) => node.type === 'triangle'),
    'the approval phrase uses the attention timbre',
  );

  harness.publishStatuses([
    ['s1', { running: true, pendingInteraction: { kind: 'approval' }, completionUnread: false }],
  ]);
  assert.equal(harness.oscillators.length, 7, 'a standing approval does not repeat');

  harness.publishStatuses([
    ['s1', { running: true, pendingInteraction: undefined, completionUnread: false }],
    ['child', { running: true, pendingInteraction: undefined, completionUnread: false }],
  ]);
  harness.publishStatuses([
    ['s1', { running: true, pendingInteraction: undefined, completionUnread: false }],
    ['child', { running: false, pendingInteraction: undefined, completionUnread: true }],
  ]);
  assert.equal(harness.oscillators.length, 7, 'subagent completion stays silent');
});
