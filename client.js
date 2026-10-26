window.__ModuleLoader__.load({
  id: '@local/notification-chime',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Pending-interaction kinds that wait for a human decision. */
    const APPROVAL_KINDS = ['approval', 'plan-review'];
    const COMPLETION_GAP_MS = 600;
    const APPROVAL_GAP_MS = 900;

    /**
     * Completion: a soft rising phrase. Approval: three shorter, higher pulses.
     * Kept as oscillator descriptions so the renderer needs no audio files.
     */
    const COMPLETE_NOTES = [
      { frequency: 523.25, offset: 0, duration: 0.3, peak: 0.5, type: 'sine' },
      { frequency: 659.25, offset: 0.02, duration: 0.24, peak: 0.55, type: 'sine' },
      { frequency: 987.77, offset: 0.15, duration: 0.58, peak: 0.65, type: 'sine' },
      { frequency: 1318.51, offset: 0.16, duration: 0.4, peak: 0.16, type: 'sine' },
    ];
    const APPROVAL_NOTES = [
      { frequency: 1046.5, offset: 0, duration: 0.14, peak: 0.55, type: 'triangle' },
      { frequency: 783.99, offset: 0.18, duration: 0.14, peak: 0.5, type: 'triangle' },
      { frequency: 1046.5, offset: 0.36, duration: 0.26, peak: 0.6, type: 'triangle' },
    ];

    const zh = {
      title: '通知提示音',
      description: '任务完成或需要人工审批时，在应用内播放提示音。',
      test: '试听',
      waiting: '等待任务完成或审批请求',
      lastComplete: '上次触发：任务完成',
      lastApproval: '上次触发：人工审批',
      at: '（{time}）',
      ready: '音频已就绪',
      locked: '点击试听启用声音',
      unavailable: '当前环境不支持音频',
    };
    const en = {
      title: 'Notification chime',
      description: 'Plays a chime inside the app when a task finishes or a human approval is needed.',
      test: 'Test',
      waiting: 'Waiting for a completed task or approval request',
      lastComplete: 'Last trigger: task completed',
      lastApproval: 'Last trigger: approval requested',
      at: ' ({time})',
      ready: 'audio ready',
      locked: 'click Test to enable sound',
      unavailable: 'audio unavailable in this environment',
    };

    /** Tiny observable carried from the detector to the settings row. */
    function createStore() {
      let snapshot = { lastKind: undefined, lastAt: 0, audio: 'idle' };
      const listeners = new Set();
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set(patch) {
          snapshot = { ...snapshot, ...patch };
          for (const listener of [...listeners]) listener();
        },
      };
    }

    function createChime(store) {
      let context = null;
      let master = null;
      let unavailable = false;
      let lastComplete = 0;
      let lastApproval = 0;

      const publish = () => {
        if (unavailable) {
          store.set({ audio: 'unavailable' });
          return;
        }
        if (context === null) {
          store.set({ audio: 'idle' });
        } else {
          store.set({ audio: context.state === 'running' ? 'ready' : 'locked' });
        }
      };

      function ensure() {
        if (unavailable) return;
        try {
          if (context === null) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (typeof AudioContextClass !== 'function') {
              unavailable = true;
              publish();
              return;
            }
            const created = new AudioContextClass();
            const gain = created.createGain();
            gain.gain.value = 0.3;
            gain.connect(created.destination);
            context = created;
            master = gain;
            if (typeof created.addEventListener === 'function') {
              created.addEventListener('statechange', publish);
            }
          }
          if (context.state === 'suspended') context.resume().catch(() => {});
        } catch {
          unavailable = true;
        }
        publish();
      }

      function tone(note, startAt) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = note.type;
        oscillator.frequency.setValueAtTime(note.frequency, startAt);
        envelope.gain.setValueAtTime(0.0001, startAt);
        envelope.gain.linearRampToValueAtTime(note.peak, startAt + 0.01);
        envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.start(startAt);
        oscillator.stop(startAt + note.duration + 0.03);
      }

      function play(notes) {
        if (context === null) ensure();
        if (context === null || master === null) return;
        const perform = () => {
          const startAt = context.currentTime + 0.02;
          for (const note of notes) tone(note, startAt + note.offset);
        };
        if (context.state === 'suspended') {
          context.resume().then(perform, () => {});
          return;
        }
        perform();
      }

      return {
        ensure,
        complete() {
          const now = Date.now();
          if (now - lastComplete < COMPLETION_GAP_MS) return;
          lastComplete = now;
          play(COMPLETE_NOTES);
        },
        attention() {
          const now = Date.now();
          if (now - lastApproval < APPROVAL_GAP_MS) return;
          lastApproval = now;
          play(APPROVAL_NOTES);
        },
      };
    }

    function isApprovalPending(status) {
      if (status === undefined || status.pendingInteraction === undefined) return false;
      return APPROVAL_KINDS.indexOf(status.pendingInteraction.kind) !== -1;
    }

    /**
     * Completion is a running session becoming idle, or the background
     * completion reminder appearing. The first snapshot is a baseline so
     * mounting the page never chimes for old work.
     */
    function detect(previous, current, sessions) {
      let approval = false;
      let completion = false;
      for (const [sessionId, status] of current) {
        const before = previous.get(sessionId);
        if (before === undefined) continue;
        const pending = isApprovalPending(status);
        if (pending && !isApprovalPending(before)) approval = true;
        // A session waiting on a human has not fully completed.
        if (pending) continue;
        const summary = sessions.byId === undefined ? undefined : sessions.byId[sessionId];
        if (summary === undefined || summary.origin === 'subagent') continue;
        if (before.running === true && status.running !== true) completion = true;
        else if (before.completionUnread === false && status.completionUnread === true) completion = true;
      }
      return { approval, completion };
    }

    const rowStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '12px 0',
    };
    const textStyle = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' };
    const titleStyle = { color: 'var(--dsw-alias-label-primary)', fontSize: '14px', lineHeight: '20px' };
    const descriptionStyle = { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', lineHeight: '18px' };
    const statusStyle = { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', lineHeight: '18px', opacity: 0.8 };
    const buttonStyle = {
      flex: '0 0 auto',
      padding: '4px 12px',
      borderRadius: '8px',
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)',
      font: 'inherit',
      fontSize: '12px',
      cursor: 'pointer',
    };

    function createRow(chime, store, t) {
      return function AppChimeRow() {
        const [snapshot, setSnapshot] = React.useState(store.getSnapshot());
        React.useEffect(() => store.subscribe(() => setSnapshot(store.getSnapshot())), []);

        let last = t('waiting');
        if (snapshot.lastKind === 'complete') last = t('lastComplete');
        else if (snapshot.lastKind === 'approval') last = t('lastApproval');
        if (snapshot.lastAt > 0) {
          last += t('at', { time: new Date(snapshot.lastAt).toLocaleTimeString() });
        }
        const audio = snapshot.audio === 'ready'
          ? t('ready')
          : snapshot.audio === 'unavailable'
            ? t('unavailable')
            : t('locked');

        return h(
          'div',
          { style: rowStyle },
          h(
            'div',
            { style: textStyle },
            h('div', { style: titleStyle }, t('title')),
            h('div', { style: descriptionStyle }, t('description')),
            h('div', { style: statusStyle }, `${last} · ${audio}`),
          ),
          h(
            'button',
            {
              type: 'button',
              style: buttonStyle,
              onClick: () => {
                chime.ensure();
                chime.complete();
              },
            },
            t('test'),
          ),
        );
      };
    }

    return {
      inject: ['sessions', 'uiSession', 'slots', 'locale'],
      apply(ctx) {
        const store = createStore();
        const chime = createChime(store);

        // A user interaction unlocks the renderer audio context on Chromium
        // builds that still require a gesture.
        ctx.effect(() => {
          const unlock = () => chime.ensure();
          window.addEventListener('pointerdown', unlock, true);
          window.addEventListener('keydown', unlock, true);
          window.addEventListener('touchstart', unlock, true);
          return () => {
            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('keydown', unlock, true);
            window.removeEventListener('touchstart', unlock, true);
          };
        }, 'notification-chime: audio unlock');

        // Detect turns and approval requests from the same unified status the
        // sidebar renders. This runs independently of the settings row.
        ctx.effect(() => {
          const statusSource = ctx.uiSession.sessionStatus;
          const listSource = ctx.sessions.list;
          let previous;
          const check = () => {
            const current = statusSource.getSnapshot();
            const sessions = listSource.getSnapshot();
            if (previous === undefined) {
              previous = current;
              return;
            }
            const transition = detect(previous, current, sessions);
            previous = current;
            if (transition.approval) {
              store.set({ lastKind: 'approval', lastAt: Date.now() });
              chime.attention();
            } else if (transition.completion) {
              store.set({ lastKind: 'complete', lastAt: Date.now() });
              chime.complete();
            }
          };
          const offStatus = statusSource.subscribe(check);
          const offList = listSource.subscribe(check);
          check();
          return () => {
            offStatus();
            offList();
          };
        }, 'notification-chime: session status');

        ctx.effect(() => ctx.locale.register('notification-chime', { zh, en }), 'notification-chime: dictionaries');
        const t = ctx.locale.bind('notification-chime');

        chime.ensure();

        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            { name: 'settings.general.item', id: 'notification-chime', order: 21 },
            createRow(chime, store, t),
          ),
        );
      },
    };
  },
});
