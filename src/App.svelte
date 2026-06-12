<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import Home from './pages/Home.svelte';
  import Settings from './pages/Settings.svelte';
  import ReminderModal from './components/ReminderModal.svelte';
  import { remindersStore, settingsStore } from './store';
  import type { Reminder, MissedReminder } from './types';
  import type { WorkerToMainMessage, WorkerReminderSnapshot, WorkerSettingsSnapshot } from './workers/reminder.worker';

  type Page = 'home' | 'settings';

  let currentPage: Page = 'home';
  let activeModal: Reminder | null = null;
  let missedReminders: MissedReminder[] = [];
  let showMissedModal = false;

  let tickInterval: number | null = null;
  let lastVisibilityCheck = new Date();

  let reminderWorker: Worker | null = null;
  const pendingTriggerQueue: Array<{ reminderId: string; triggeredAt: string }> = [];
  let isProcessingTrigger = false;

  function applyTheme() {
    const theme = $settingsStore.theme;
    let effectiveTheme: 'light' | 'dark';
    if (theme === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      effectiveTheme = theme;
    }
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }

  function navigateTo(page: Page) {
    currentPage = page;
    history.pushState({ page }, '', page === 'home' ? '#' : `#${page}`);
  }

  function handlePopState() {
    const hash = window.location.hash.replace('#', '');
    currentPage = hash === 'settings' ? 'settings' : 'home';
  }

  function syncRemindersToWorker() {
    if (!reminderWorker) return;
    const snapshot: WorkerReminderSnapshot[] = $remindersStore.map(r => ({
      id: r.id,
      nextRunAt: r.nextRunAt,
      status: r.status,
      repeatStrategy: r.repeatStrategy,
      cronExpr: r.cronExpr,
      intervalMin: r.intervalMin,
      fixedTime: r.fixedTime,
      weeklyDays: r.weeklyDays,
      lastRunAt: r.lastRunAt
    }));
    reminderWorker.postMessage({ type: 'SET_REMINDERS', reminders: snapshot });
  }

  function syncSettingsToWorker() {
    if (!reminderWorker) return;
    const snapshot: WorkerSettingsSnapshot = {
      dndPeriods: $settingsStore.dndPeriods
    };
    reminderWorker.postMessage({ type: 'SET_SETTINGS', settings: snapshot });
  }

  function findReminderById(id: string): Reminder | undefined {
    return $remindersStore.find(r => r.id === id);
  }

  function playNotificationSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);

      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.value = 880;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.6);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.1);
        osc2.start(audioCtx.currentTime + 0.6);
        osc2.stop(audioCtx.currentTime + 1.1);
      }, 600);
    } catch (e) {
      console.warn('Failed to play notification sound:', e);
    }
  }

  function fireDesktopNotification(reminder: Reminder) {
    if (!($settingsStore.desktopNotifications && 'Notification' in window && Notification.permission === 'granted')) return;
    try {
      const notification = new Notification(reminder.title, {
        body: reminder.content || '提醒时间到',
        tag: reminder.id,
        requireInteraction: true,
        silent: !reminder.soundEnabled || !$settingsStore.soundEnabled
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn('Desktop notification failed:', e);
    }
  }

  function triggerReminderModal(reminder: Reminder) {
    activeModal = reminder;
    remindersStore.markTriggered(reminder.id);

    fireDesktopNotification(reminder);
    if (reminder.soundEnabled && $settingsStore.soundEnabled) {
      playNotificationSound();
    }

    const duration = $settingsStore.defaultModalDuration;
    if (duration > 0 && reminder.repeatStrategy !== 'interval') {
      setTimeout(() => {
        if (activeModal?.id === reminder.id) closeModal();
      }, duration * 1000);
    }
  }

  async function processTriggerQueue() {
    if (isProcessingTrigger) return;
    isProcessingTrigger = true;

    try {
      while (pendingTriggerQueue.length > 0) {
        if (activeModal) {
          await new Promise<void>(resolve => {
            const check = setInterval(() => {
              if (!activeModal) {
                clearInterval(check);
                resolve();
              }
            }, 300);
          });
        }

        const next = pendingTriggerQueue.shift();
        if (!next) break;

        const reminder = findReminderById(next.reminderId);
        if (!reminder || reminder.status !== 'active') continue;

        const nextRun = new Date(reminder.nextRunAt);
        if (nextRun > new Date()) continue;

        triggerReminderModal(reminder);

        if (pendingTriggerQueue.length > 0) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } finally {
      isProcessingTrigger = false;
    }
  }

  function handleWorkerMessage(e: MessageEvent<WorkerToMainMessage>) {
    const msg = e.data;

    switch (msg.type) {
      case 'TRIGGER_REMINDER': {
        pendingTriggerQueue.push({ reminderId: msg.reminderId, triggeredAt: msg.triggeredAt });
        processTriggerQueue();
        break;
      }
      case 'MISSED_IN_DND': {
        const reminder = findReminderById(msg.reminderId);
        if (reminder) {
          const alreadyMissed = missedReminders.some(m => m.reminder.id === msg.reminderId);
          if (!alreadyMissed) {
            missedReminders = [...missedReminders, {
              reminder: { ...reminder },
              missedAt: msg.missedAt
            }];
          }
          remindersStore.markMissed(msg.reminderId);
        }
        break;
      }
      case 'NEXT_RUN_UPDATED': {
        remindersStore.updateNextRun(msg.reminderId, msg.nextRunAt);
        break;
      }
      case 'DND_ENDED': {
        if (missedReminders.length > 0) {
          showMissedModal = true;
        } else {
          const fromDND = msg.reminderIds
            .map(id => findReminderById(id))
            .filter((r): r is Reminder => !!r);
          if (fromDND.length > 0) {
            missedReminders = fromDND.map(r => ({
              reminder: r,
              missedAt: new Date().toISOString()
            }));
            showMissedModal = true;
          }
        }
        break;
      }
    }
  }

  function closeModal() {
    activeModal = null;
  }

  function handleSnooze(minutes: number) {
    if (activeModal) {
      remindersStore.snooze(activeModal.id, minutes);
    }
    closeModal();
  }

  function handleComplete() {
    if (activeModal) {
      remindersStore.update(activeModal.id, { status: 'completed' });
    }
    closeModal();
  }

  function handleMissedDismiss() {
    missedReminders = [];
    showMissedModal = false;
  }

  function handleMissedView() {
    const missedIds = new Set(missedReminders.map(m => m.reminder.id));
    missedReminders = [];
    showMissedModal = false;
    for (const id of missedIds) {
      pendingTriggerQueue.push({ reminderId: id, triggeredAt: new Date().toISOString() });
    }
    processTriggerQueue();
    navigateTo('home');
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      lastVisibilityCheck = new Date();
    } else {
      const now = new Date();
      const elapsed = now.getTime() - lastVisibilityCheck.getTime();

      if (elapsed > 10000) {
        console.log(`[Visibility] Page hidden ${Math.round(elapsed / 1000)}s, catching up...`);

        remindersStore.refreshAllNextRuns();

        if (reminderWorker) {
          reminderWorker.postMessage({ type: 'CLEAR_TRIGGER_CACHE' });
          reminderWorker.postMessage({ type: 'FORCE_CHECK' });
          reminderWorker.postMessage({ type: 'SYNC_TIME', clientNow: now.getTime() });
          syncRemindersToWorker();
        }

        const catchUpNow = new Date();
        const newlyMissed: MissedReminder[] = [];

        for (const reminder of $remindersStore) {
          if (reminder.status !== 'active') continue;

          remindersStore.forceRecalculateNextRun(reminder.id);

          const updated = findReminderById(reminder.id);
          if (!updated) continue;

          const nextRun = new Date(updated.nextRunAt);
          if (nextRun < catchUpNow) {
            newlyMissed.push({
              reminder: { ...updated },
              missedAt: nextRun.toISOString()
            });
          }
        }

        if (newlyMissed.length > 0) {
          const existingIds = new Set(missedReminders.map(m => m.reminder.id));
          for (const m of newlyMissed) {
            if (!existingIds.has(m.reminder.id)) {
              missedReminders = [...missedReminders, m];
            }
          }

          for (const m of newlyMissed) {
            pendingTriggerQueue.push({
              reminderId: m.reminder.id,
              triggeredAt: new Date().toISOString()
            });
          }
          processTriggerQueue();
        }
      }

      lastVisibilityCheck = now;
    }
  }

  let unsubscribeReminders: (() => void) | null = null;
  let unsubscribeSettings: (() => void) | null = null;

  onMount(() => {
    applyTheme();

    try {
      reminderWorker = new Worker(new URL('./workers/reminder.worker.ts', import.meta.url), {
        type: 'module'
      });
      reminderWorker.addEventListener('message', handleWorkerMessage);
      syncRemindersToWorker();
      syncSettingsToWorker();
    } catch (e) {
      console.warn('Failed to init Web Worker, falling back to main thread timer:', e);
    }

    unsubscribeReminders = remindersStore.subscribe(() => {
      syncRemindersToWorker();
    });
    unsubscribeSettings = settingsStore.subscribe(() => {
      syncSettingsToWorker();
      applyTheme();
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const hash = window.location.hash.replace('#', '');
    if (hash === 'settings') currentPage = 'settings';

    if (!reminderWorker) {
      tickInterval = window.setInterval(() => {
        reminderWorker?.postMessage({ type: 'FORCE_CHECK' });
      }, 1000);
    }

    setTimeout(() => {
      reminderWorker?.postMessage({ type: 'FORCE_CHECK' });
    }, 500);

    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
    };
  });

  onDestroy(() => {
    if (tickInterval) clearInterval(tickInterval);
    window.removeEventListener('popstate', handlePopState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    unsubscribeReminders?.();
    unsubscribeSettings?.();
    reminderWorker?.terminate();
  });

  $: if ($settingsStore.theme) {
    applyTheme();
  }
</script>

<main class="app">
  {#if currentPage === 'home'}
    <Home onNavigateSettings={() => navigateTo('settings')} />
  {:else}
    <Settings onBack={() => navigateTo('home')} />
  {/if}
</main>

{#if activeModal}
  <ReminderModal
    reminder={activeModal}
    onClose={closeModal}
    onSnooze={handleSnooze}
    onComplete={handleComplete}
  />
{/if}

{#if showMissedModal && missedReminders.length > 0}
  <div class="missed-modal-overlay" transition:fade={{ duration: 200 }}>
    <div class="missed-modal" transition:fade={{ duration: 250 }}>
      <div class="missed-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <h2 class="missed-title">您有 {missedReminders.length} 条错过的提醒</h2>
      <div class="missed-list">
        {#each missedReminders.slice(0, 5) as missed}
          <div class="missed-item">
            <span class="missed-item-title">{missed.reminder.title}</span>
            <span class="missed-item-time">{formatMissedTime(missed.missedAt)}</span>
          </div>
        {/each}
        {#if missedReminders.length > 5}
          <p class="missed-more">还有 {missedReminders.length - 5} 条更多...</p>
        {/if}
      </div>
      <div class="missed-actions">
        <button class="btn btn-secondary" on:click={handleMissedDismiss}>知道了</button>
        <button class="btn btn-primary" on:click={handleMissedView}>逐个重弹</button>
      </div>
    </div>
  </div>
{/if}

<script lang="ts" context="module">
  function formatMissedTime(time: string): string {
    const d = new Date(time);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
</script>

<style>
  .app {
    min-height: 100vh;
    background: var(--bg-primary);
    transition: background-color var(--transition-normal);
  }

  .missed-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    backdrop-filter: blur(4px);
    padding: 20px;
  }

  .missed-modal {
    background: var(--bg-primary);
    border-radius: var(--radius-xl);
    padding: 32px;
    width: 90%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
    text-align: center;
  }

  .missed-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 16px;
    background: var(--warning-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .missed-icon :global(svg) {
    width: 28px;
    height: 28px;
  }

  .missed-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 20px 0;
  }

  .missed-list {
    text-align: left;
    margin-bottom: 24px;
    max-height: 200px;
    overflow-y: auto;
  }

  .missed-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-color);
    font-size: 14px;
  }

  .missed-item:last-child { border-bottom: none; }

  .missed-item-title {
    color: var(--text-primary);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    margin-right: 12px;
  }

  .missed-item-time {
    color: var(--text-tertiary);
    font-size: 12px;
    flex-shrink: 0;
  }

  .missed-more {
    font-size: 13px;
    color: var(--text-tertiary);
    margin: 8px 0 0;
    text-align: center;
  }

  .missed-actions {
    display: flex;
    gap: 10px;
  }

  .btn {
    flex: 1;
    padding: 12px 20px;
    border-radius: var(--radius-md);
    font-size: 15px;
    font-weight: 500;
    transition: all var(--transition-fast);
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover { background: var(--accent-hover); }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .btn-secondary:hover { background: var(--bg-tertiary); }

  @media (max-width: 480px) {
    .missed-modal { padding: 24px 20px; }
  }
</style>
