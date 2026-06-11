export type RepeatStrategy = 'once' | 'interval' | 'daily' | 'weekly' | 'cron';

export type ReminderStatus = 'active' | 'paused' | 'completed';

export interface FixedTime {
  hour: number;
  minute: number;
}

export interface Reminder {
  id: string;
  title: string;
  content: string;
  repeatStrategy: RepeatStrategy;
  cronExpr?: string;
  intervalMin?: number;
  fixedTime?: FixedTime;
  weeklyDays?: number[];
  nextRunAt: string;
  lastRunAt?: string;
  status: ReminderStatus;
  soundEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface DndPeriod {
  start_hour: number;
  start_min: number;
  end_hour: number;
  end_min: number;
  days: number[];
}

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Settings {
  theme: ThemeMode;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  defaultModalDuration: number;
  defaultRepeatStrategy: RepeatStrategy;
  dndPeriods: DndPeriod[];
}

export interface AppData {
  reminders: Reminder[];
  settings: Settings;
  version: number;
}

export interface MissedReminder {
  reminder: Reminder;
  missedAt: string;
}

export type ModalAction = 'dismiss' | 'snooze_5min' | 'snooze_1hour' | 'complete' | 'view';

export interface ReminderFormData {
  title: string;
  content: string;
  repeatStrategy: RepeatStrategy;
  soundEnabled: boolean;
  nextRunAt: string;
  cronExpr?: string;
  intervalMin?: number;
  fixedTime?: FixedTime;
  weeklyDays?: number[];
  tags?: string[];
}

export const STORAGE_KEY = 'svelte_reminder_data_v1';
export const STORAGE_VERSION = 1;

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
export const WEEKDAYS_FULL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
