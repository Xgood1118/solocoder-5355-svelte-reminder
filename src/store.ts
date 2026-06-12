import { writable, derived, get } from 'svelte/store';
import type { Reminder, Settings, AppData, MissedReminder, RepeatStrategy } from './types';
import { STORAGE_KEY, STORAGE_VERSION } from './types';
import {
  generateId,
  formatDate,
  calculateNextRun,
  validateReminderSize
} from './utils';

const defaultSettings: Settings = {
  theme: 'auto',
  soundEnabled: true,
  desktopNotifications: false,
  defaultModalDuration: 0,
  defaultRepeatStrategy: 'once',
  dndPeriods: [
    {
      start_hour: 23,
      start_min: 0,
      end_hour: 8,
      end_min: 0,
      days: [0, 1, 2, 3, 4, 5, 6]
    }
  ]
};

function loadFromStorage(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AppData;
    if (data.version !== STORAGE_VERSION) {
      console.warn('Storage version mismatch, migrating...');
      return null;
    }
    return data;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return null;
  }
}

function saveToStorage(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('Storage quota exceeded');
    } else {
      console.error('Failed to save to localStorage:', e);
    }
    return false;
  }
}

function createRemindersStore() {
  const stored = loadFromStorage();
  const initial: Reminder[] = stored?.reminders || [];

  const { subscribe, set, update } = writable<Reminder[]>(initial);

  function persist(reminders: Reminder[]) {
    const settings = get(settingsStore);
    const data: AppData = { reminders, settings, version: STORAGE_VERSION };
    const success = saveToStorage(data);
    if (!success) {
      console.warn('Failed to persist reminders');
    }
  }

  return {
    subscribe,

    add(reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'nextRunAt'> & { nextRunAt?: string }) {
      const now = new Date();
      const newReminder: Reminder = {
        ...reminder,
        id: generateId(),
        createdAt: formatDate(now),
        updatedAt: formatDate(now),
        nextRunAt: reminder.nextRunAt || formatDate(now)
      };

      if (!validateReminderSize(newReminder)) {
        throw new Error('提醒内容过大，请精简内容');
      }

      const nextRun = calculateNextRun(newReminder, now);
      if (nextRun) {
        newReminder.nextRunAt = formatDate(nextRun);
      }

      update(reminders => {
        const updated = [...reminders, newReminder];
        persist(updated);
        return updated;
      });

      return newReminder;
    },

    update(id: string, changes: Partial<Reminder>) {
      update(reminders => {
        const updated = reminders.map(r => {
          if (r.id === id) {
            const merged = { ...r, ...changes, updatedAt: formatDate(new Date()) } as Reminder;

            if (
              changes.repeatStrategy ||
              changes.cronExpr !== undefined ||
              changes.intervalMin !== undefined ||
              changes.fixedTime !== undefined ||
              changes.weeklyDays !== undefined
            ) {
              const nextRun = calculateNextRun(merged);
              if (nextRun) {
                merged.nextRunAt = formatDate(nextRun);
              }
            }

            return merged;
          }
          return r;
        });
        persist(updated);
        return updated;
      });
    },

    remove(id: string) {
      update(reminders => {
        const updated = reminders.filter(r => r.id !== id);
        persist(updated);
        return updated;
      });
    },

    toggleStatus(id: string) {
      update(reminders => {
        const updated = reminders.map(r => {
          if (r.id === id) {
            const newStatus = r.status === 'active' ? 'paused' : 'active';
            const now = new Date();
            const merged = { ...r, status: newStatus, updatedAt: formatDate(now) } as Reminder;

            if (newStatus === 'active') {
              if (r.repeatStrategy === 'once') {
                const currentNextRun = new Date(r.nextRunAt);
                if (currentNextRun > now) {
                  merged.nextRunAt = r.nextRunAt;
                }
              } else {
                const nextRun = calculateNextRun(merged, now);
                if (nextRun) {
                  merged.nextRunAt = formatDate(nextRun);
                }
              }
            }

            return merged;
          }
          return r;
        });
        persist(updated);
        return updated;
      });
    },

    markTriggered(id: string) {
      update(reminders => {
        const updated = reminders.map(r => {
          if (r.id !== id) return r;

          const now = new Date();
          const merged = { ...r, lastRunAt: formatDate(now), updatedAt: formatDate(now) } as Reminder;

          switch (r.repeatStrategy) {
            case 'once':
              merged.status = 'completed';
              break;
            case 'interval':
            case 'daily':
            case 'weekly':
            case 'cron':
              const nextRun = calculateNextRun(merged, now);
              if (nextRun) {
                merged.nextRunAt = formatDate(nextRun);
              }
              break;
          }

          return merged;
        });
        persist(updated);
        return updated;
      });
    },

    markMissed(id: string) {
      update(reminders => {
        const updated = reminders.map(r => {
          if (r.id !== id) return r;
          const now = new Date();
          return {
            ...r,
            lastRunAt: formatDate(now),
            updatedAt: formatDate(now)
          } as Reminder;
        });
        persist(updated);
        return updated;
      });
    },

    forceRecalculateNextRun(id: string) {
      update(reminders => {
        const updated = reminders.map(r => {
          if (r.id !== id) return r;
          const now = new Date();
          const nextRun = calculateNextRun(r, now);
          if (nextRun) {
            return {
              ...r,
              nextRunAt: formatDate(nextRun),
              updatedAt: formatDate(now)
            } as Reminder;
          }
          return { ...r, updatedAt: formatDate(now) } as Reminder;
        });
        persist(updated);
        return updated;
      });
    },

    updateNextRun(id: string, nextRunAt: string) {
      update(reminders => {
        const updated = reminders.map(r => {
          if (r.id !== id) return r;
          return {
            ...r,
            nextRunAt,
            updatedAt: formatDate(new Date())
          } as Reminder;
        });
        persist(updated);
        return updated;
      });
    },

    snooze(id: string, minutes: number) {
      update(reminders => {
        const updated = reminders.map(r => {
          if (r.id === id) {
            const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
            return {
              ...r,
              nextRunAt: formatDate(snoozeUntil),
              updatedAt: formatDate(new Date())
            } as Reminder;
          }
          return r;
        });
        persist(updated);
        return updated;
      });
    },

    refreshAllNextRuns() {
      const now = new Date();
      update(reminders => {
        const updated = reminders.map(r => {
          if (r.status !== 'active') return r;

          if (r.repeatStrategy === 'once') {
            const currentNextRun = new Date(r.nextRunAt);
            if (currentNextRun > now) {
              return r;
            }
            return r;
          }

          const nextRun = calculateNextRun(r, now);
          if (nextRun) {
            return { ...r, nextRunAt: formatDate(nextRun), updatedAt: formatDate(now) } as Reminder;
          }
          return r;
        });
        persist(updated);
        return updated;
      });
    },

    setAll(reminders: Reminder[]) {
      set(reminders);
      persist(reminders);
    },

    clearAll() {
      set([]);
      const settings = get(settingsStore);
      saveToStorage({ reminders: [], settings, version: STORAGE_VERSION });
    }
  };
}

function createSettingsStore() {
  const stored = loadFromStorage();
  const initial: Settings = stored?.settings || defaultSettings;

  const { subscribe, set, update } = writable<Settings>(initial);

  function persist(settings: Settings) {
    const reminders = get(remindersStore);
    const data: AppData = { reminders, settings, version: STORAGE_VERSION };
    saveToStorage(data);
  }

  return {
    subscribe,

    update(changes: Partial<Settings>) {
      update(settings => {
        const updated = { ...settings, ...changes };
        persist(updated);
        return updated;
      });
    },

    set(settings: Settings) {
      set(settings);
      persist(settings);
    },

    addDndPeriod(period: Settings['dndPeriods'][0]) {
      update(settings => {
        const updated = { ...settings, dndPeriods: [...settings.dndPeriods, period] };
        persist(updated);
        return updated;
      });
    },

    removeDndPeriod(index: number) {
      update(settings => {
        const updated = {
          ...settings,
          dndPeriods: settings.dndPeriods.filter((_, i) => i !== index)
        };
        persist(updated);
        return updated;
      });
    },

    updateDndPeriod(index: number, period: Settings['dndPeriods'][0]) {
      update(settings => {
        const newPeriods = [...settings.dndPeriods];
        newPeriods[index] = period;
        const updated = { ...settings, dndPeriods: newPeriods };
        persist(updated);
        return updated;
      });
    }
  };
}

export const remindersStore = createRemindersStore();
export const settingsStore = createSettingsStore();

export const activeReminders = derived(remindersStore, $reminders =>
  $reminders.filter(r => r.status === 'active').sort((a, b) =>
    new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
  )
);

export const completedReminders = derived(remindersStore, $reminders =>
  $reminders.filter(r => r.status === 'completed').sort((a, b) =>
    new Date(b.lastRunAt || 0).getTime() - new Date(a.lastRunAt || 0).getTime()
  )
);

export const missedRemindersStore = writable<MissedReminder[]>([]);

export function exportData(): string {
  const reminders = get(remindersStore);
  const settings = get(settingsStore);
  const data: AppData = { reminders, settings, version: STORAGE_VERSION };
  return JSON.stringify(data, null, 2);
}

export function importData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString) as AppData;
    if (!data.reminders || !data.settings || data.version !== STORAGE_VERSION) {
      return false;
    }
    remindersStore.setAll(data.reminders);
    settingsStore.set(data.settings);
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}
