import type { Reminder, DndPeriod } from '../types';
import {
  calculateNextRun,
  isInDndPeriod,
  formatDate
} from '../utils';

export interface WorkerReminderSnapshot {
  id: string;
  nextRunAt: string;
  status: Reminder['status'];
  repeatStrategy: Reminder['repeatStrategy'];
  cronExpr?: string;
  intervalMin?: number;
  fixedTime?: Reminder['fixedTime'];
  weeklyDays?: number[];
  lastRunAt?: string;
}

export interface WorkerSettingsSnapshot {
  dndPeriods: DndPeriod[];
}

export type WorkerToMainMessage =
  | { type: 'TRIGGER_REMINDER'; reminderId: string; triggeredAt: string }
  | { type: 'MISSED_IN_DND'; reminderId: string; missedAt: string }
  | { type: 'DND_ENDED'; missedCount: number; reminderIds: string[] }
  | { type: 'NEXT_RUN_UPDATED'; reminderId: string; nextRunAt: string };

export type MainToWorkerMessage =
  | { type: 'SET_REMINDERS'; reminders: WorkerReminderSnapshot[] }
  | { type: 'SET_SETTINGS'; settings: WorkerSettingsSnapshot }
  | { type: 'FORCE_CHECK' }
  | { type: 'CLEAR_TRIGGER_CACHE' }
  | { type: 'SYNC_TIME'; clientNow: number };

let reminders: WorkerReminderSnapshot[] = [];
let settings: WorkerSettingsSnapshot = { dndPeriods: [] };
const triggeredThisCycle = new Set<string>();
const missedInDndQueue: Map<string, string> = new Map();
let lastDndState = false;
let tickCount = 0;

function snapshotReminderForNextRun(r: WorkerReminderSnapshot, now: Date): WorkerReminderSnapshot {
  return {
    ...r,
    nextRunAt: formatDate(now)
  };
}

function tick() {
  tickCount++;
  const now = new Date();

  const currentlyInDnd = isInDndPeriod(now, settings.dndPeriods);

  if (lastDndState && !currentlyInDnd) {
    if (missedInDndQueue.size > 0) {
      const reminderIds = Array.from(missedInDndQueue.keys());
      self.postMessage({
        type: 'DND_ENDED',
        missedCount: missedInDndQueue.size,
        reminderIds
      } satisfies WorkerToMainMessage);
      missedInDndQueue.clear();
    }
  }

  for (const r of reminders) {
    if (r.status !== 'active') continue;
    if (triggeredThisCycle.has(r.id)) continue;

    const nextRun = new Date(r.nextRunAt);

    if (nextRun <= now) {
      if (currentlyInDnd) {
        if (!missedInDndQueue.has(r.id)) {
          missedInDndQueue.set(r.id, now.toISOString());
          self.postMessage({
            type: 'MISSED_IN_DND',
            reminderId: r.id,
            missedAt: now.toISOString()
          } satisfies WorkerToMainMessage);
        }
      } else {
        self.postMessage({
          type: 'TRIGGER_REMINDER',
          reminderId: r.id,
          triggeredAt: now.toISOString()
        } satisfies WorkerToMainMessage);
      }

      triggeredThisCycle.add(r.id);

      setTimeout(() => {
        triggeredThisCycle.delete(r.id);
      }, 1500);

      if (r.repeatStrategy !== 'once') {
        const recalced = calculateNextRun(r as any, now);
        if (recalced) {
          const newNextRunStr = formatDate(recalced);
          if (newNextRunStr !== r.nextRunAt) {
            r.nextRunAt = newNextRunStr;
            self.postMessage({
              type: 'NEXT_RUN_UPDATED',
              reminderId: r.id,
              nextRunAt: newNextRunStr
            } satisfies WorkerToMainMessage);
          }
        }
      }
    }
  }

  lastDndState = currentlyInDnd;

  if (tickCount % 30 === 0) {
    for (const r of reminders) {
      if (r.status !== 'active') continue;
      if (r.repeatStrategy === 'once') continue;
      const nextRun = new Date(r.nextRunAt);
      if (nextRun < now) {
        const recalced = calculateNextRun(r as any, now);
        if (recalced && recalced.getTime() !== nextRun.getTime()) {
          const newNextRunStr = formatDate(recalced);
          r.nextRunAt = newNextRunStr;
          self.postMessage({
            type: 'NEXT_RUN_UPDATED',
            reminderId: r.id,
            nextRunAt: newNextRunStr
          } satisfies WorkerToMainMessage);
        }
      }
    }
  }
}

self.addEventListener('message', (e: MessageEvent<MainToWorkerMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'SET_REMINDERS': {
      const oldStatusMap = new Map(reminders.map(r => [r.id, r.status]));
      reminders = msg.reminders;
      for (const r of reminders) {
        const oldStatus = oldStatusMap.get(r.id);
        if (oldStatus === 'paused' && r.status === 'active') {
          triggeredThisCycle.delete(r.id);
          missedInDndQueue.delete(r.id);
        }
        if (r.status === 'paused') {
          triggeredThisCycle.delete(r.id);
          missedInDndQueue.delete(r.id);
        }
      }
      break;
    }
    case 'SET_SETTINGS':
      settings = msg.settings;
      break;
    case 'FORCE_CHECK':
      tick();
      break;
    case 'CLEAR_TRIGGER_CACHE':
      triggeredThisCycle.clear();
      break;
    case 'SYNC_TIME':
      break;
  }
});

setInterval(tick, 1000);
