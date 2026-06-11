import type { Reminder, DndPeriod, FixedTime } from './types';
import { Cron } from 'croner';

export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getCountdownText(targetDate: Date | string): string {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return '即将提醒';
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) {
    return `${diffDay} 天 ${diffHour % 24} 小时后`;
  } else if (diffHour > 0) {
    return `${diffHour} 小时 ${diffMin % 60} 分钟后`;
  } else if (diffMin > 0) {
    return `${diffMin} 分钟后`;
  } else {
    return `${diffSec} 秒后`;
  }
}

export function isValidCron(expr: string): boolean {
  try {
    new Cron(expr);
    return true;
  } catch {
    return false;
  }
}

export function getNextCronRun(expr: string, fromDate?: Date): Date | null {
  try {
    const cron = new Cron(expr);
    const next = cron.nextRun(fromDate);
    return next || null;
  } catch {
    return null;
  }
}

export function getNextDailyRun(fixedTime: FixedTime, fromDate?: Date): Date {
  const from = fromDate || new Date();
  const next = new Date(from);
  next.setHours(fixedTime.hour, fixedTime.minute, 0, 0);

  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export function getNextWeeklyRun(
  fixedTime: FixedTime,
  weeklyDays: number[],
  fromDate?: Date
): Date | null {
  if (!weeklyDays || weeklyDays.length === 0) return null;

  const from = fromDate || new Date();
  const sortedDays = [...weeklyDays].sort((a, b) => a - b);

  for (let i = 0; i < 8; i++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(fixedTime.hour, fixedTime.minute, 0, 0);

    const dayOfWeek = candidate.getDay();
    if (sortedDays.includes(dayOfWeek) && candidate > from) {
      return candidate;
    }
  }

  return null;
}

export function getNextIntervalRun(intervalMin: number, fromDate?: Date): Date {
  const from = fromDate || new Date();
  return new Date(from.getTime() + intervalMin * 60 * 1000);
}

export function calculateNextRun(reminder: Reminder, fromDate?: Date): Date | null {
  const from = fromDate || new Date();

  switch (reminder.repeatStrategy) {
    case 'once':
      const onceDate = new Date(reminder.nextRunAt);
      return onceDate > from ? onceDate : null;

    case 'interval':
      if (reminder.intervalMin === undefined) return null;
      return getNextIntervalRun(reminder.intervalMin, from);

    case 'daily':
      if (!reminder.fixedTime) return null;
      return getNextDailyRun(reminder.fixedTime, from);

    case 'weekly':
      if (!reminder.fixedTime || !reminder.weeklyDays) return null;
      return getNextWeeklyRun(reminder.fixedTime, reminder.weeklyDays, from);

    case 'cron':
      if (!reminder.cronExpr) return null;
      return getNextCronRun(reminder.cronExpr, from);

    default:
      return null;
  }
}

export function timeToMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function isInDndPeriod(
  currentTime: Date,
  dndPeriods: DndPeriod[]
): boolean {
  const currentDay = currentTime.getDay();
  const currentMinutes = timeToMinutes(currentTime.getHours(), currentTime.getMinutes());

  for (const period of dndPeriods) {
    if (!period.days.includes(currentDay)) continue;

    const startMinutes = timeToMinutes(period.start_hour, period.start_min);
    const endMinutes = timeToMinutes(period.end_hour, period.end_min);

    if (startMinutes <= endMinutes) {
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return true;
      }
    } else {
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return true;
      }
    }
  }

  return false;
}

export function getNextDndEndTime(
  currentTime: Date,
  dndPeriods: DndPeriod[]
): Date | null {
  const currentDay = currentTime.getDay();
  const currentMinutes = timeToMinutes(currentTime.getHours(), currentTime.getMinutes());

  for (const period of dndPeriods) {
    if (!period.days.includes(currentDay)) continue;

    const startMinutes = timeToMinutes(period.start_hour, period.start_min);
    const endMinutes = timeToMinutes(period.end_hour, period.end_min);

    let inPeriod = false;
    if (startMinutes <= endMinutes) {
      inPeriod = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      inPeriod = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    if (inPeriod) {
      const endDate = new Date(currentTime);
      if (startMinutes <= endMinutes) {
        endDate.setHours(period.end_hour, period.end_min, 0, 0);
      } else {
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(period.end_hour, period.end_min, 0, 0);
      }
      return endDate;
    }
  }

  return null;
}

export function validateReminderSize(reminder: Reminder): boolean {
  const size = new Blob([JSON.stringify(reminder)]).size;
  return size < 1024;
}

export function getTodayStats(reminders: Reminder[]): {
  completed: number;
  active: number;
  missed: number;
} {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  let completed = 0;
  let active = 0;
  let missed = 0;

  for (const r of reminders) {
    const nextRun = new Date(r.nextRunAt);

    if (r.status === 'completed' && r.lastRunAt) {
      const lastRun = new Date(r.lastRunAt);
      if (lastRun >= startOfDay && lastRun < endOfDay) {
        completed++;
      }
    }

    if (r.status === 'active') {
      if (nextRun < endOfDay) {
        if (nextRun < today) {
          missed++;
        } else {
          active++;
        }
      }
    }
  }

  return { completed, active, missed };
}
