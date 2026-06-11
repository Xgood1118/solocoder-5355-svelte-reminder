import { describe, it, expect } from 'vitest';
import {
  isValidCron,
  getNextCronRun,
  getNextDailyRun,
  getNextWeeklyRun,
  getNextIntervalRun,
  isInDndPeriod,
  getNextDndEndTime,
  timeToMinutes,
  generateId,
  validateReminderSize
} from '../src/utils';
import type { Reminder, DndPeriod } from '../src/types';

describe('cron utilities', () => {
  it('should validate valid cron expressions', () => {
    expect(isValidCron('* * * * *')).toBe(true);
    expect(isValidCron('0 9 * * 1-5')).toBe(true);
    expect(isValidCron('*/30 * * * *')).toBe(true);
    expect(isValidCron('0 12 * * 0,6')).toBe(true);
  });

  it('should invalidate invalid cron expressions', () => {
    expect(isValidCron('')).toBe(false);
    expect(isValidCron('invalid')).toBe(false);
    expect(isValidCron('* * * *')).toBe(false);
    expect(isValidCron('60 * * * *')).toBe(false);
  });

  it('should calculate next cron run', () => {
    const from = new Date('2024-01-15T10:00:00');
    const next = getNextCronRun('0 12 * * *', from);
    expect(next).toBeInstanceOf(Date);
    expect(next?.getHours()).toBe(12);
    expect(next?.getMinutes()).toBe(0);
  });

  it('should return null for invalid cron', () => {
    expect(getNextCronRun('invalid')).toBeNull();
  });
});

describe('daily run calculation', () => {
  it('should return today if time not passed yet', () => {
    const from = new Date('2024-01-15T10:00:00');
    const next = getNextDailyRun({ hour: 12, minute: 0 }, from);
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(12);
  });

  it('should return tomorrow if time has passed', () => {
    const from = new Date('2024-01-15T14:00:00');
    const next = getNextDailyRun({ hour: 12, minute: 0 }, from);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(12);
  });
});

describe('weekly run calculation', () => {
  it('should find next weekday', () => {
    const from = new Date('2024-01-15T10:00:00');
    expect(from.getDay()).toBe(1);

    const next = getNextWeeklyRun({ hour: 12, minute: 0 }, [3, 5], from);
    expect(next).not.toBeNull();
    expect(next?.getDay()).toBe(3);
  });

  it('should return null if no days specified', () => {
    const from = new Date();
    const next = getNextWeeklyRun({ hour: 12, minute: 0 }, [], from);
    expect(next).toBeNull();
  });

  it('should wrap around week', () => {
    const from = new Date('2024-01-19T10:00:00');
    expect(from.getDay()).toBe(5);

    const next = getNextWeeklyRun({ hour: 12, minute: 0 }, [1], from);
    expect(next).not.toBeNull();
    expect(next?.getDay()).toBe(1);
    expect(next?.getDate()).toBeGreaterThan(19);
  });
});

describe('interval run calculation', () => {
  it('should add interval minutes', () => {
    const from = new Date('2024-01-15T10:00:00');
    const next = getNextIntervalRun(30, from);
    expect(next.getHours()).toBe(10);
    expect(next.getMinutes()).toBe(30);
  });
});

describe('do not disturb', () => {
  const dndPeriods: DndPeriod[] = [
    {
      start_hour: 23,
      start_min: 0,
      end_hour: 8,
      end_min: 0,
      days: [0, 1, 2, 3, 4, 5, 6]
    }
  ];

  it('should detect time inside DND period (overnight)', () => {
    const night = new Date('2024-01-15T23:30:00');
    expect(isInDndPeriod(night, dndPeriods)).toBe(true);

    const earlyMorning = new Date('2024-01-15T06:00:00');
    expect(isInDndPeriod(earlyMorning, dndPeriods)).toBe(true);
  });

  it('should detect time outside DND period', () => {
    const daytime = new Date('2024-01-15T12:00:00');
    expect(isInDndPeriod(daytime, dndPeriods)).toBe(false);
  });

  it('should handle workday-only DND', () => {
    const workdayDnd: DndPeriod[] = [
      {
        start_hour: 12,
        start_min: 0,
        end_hour: 14,
        end_min: 0,
        days: [1, 2, 3, 4, 5]
      }
    ];

    const mondayNoon = new Date('2024-01-15T12:30:00');
    expect(mondayNoon.getDay()).toBe(1);
    expect(isInDndPeriod(mondayNoon, workdayDnd)).toBe(true);

    const sundayNoon = new Date('2024-01-14T12:30:00');
    expect(sundayNoon.getDay()).toBe(0);
    expect(isInDndPeriod(sundayNoon, workdayDnd)).toBe(false);
  });

  it('should find next DND end time', () => {
    const night = new Date('2024-01-15T23:30:00');
    const endTime = getNextDndEndTime(night, dndPeriods);
    expect(endTime).not.toBeNull();
    expect(endTime?.getHours()).toBe(8);
    expect(endTime?.getDate()).toBe(16);
  });

  it('should return null when not in DND', () => {
    const daytime = new Date('2024-01-15T12:00:00');
    expect(getNextDndEndTime(daytime, dndPeriods)).toBeNull();
  });
});

describe('timeToMinutes', () => {
  it('should convert time to minutes', () => {
    expect(timeToMinutes(0, 0)).toBe(0);
    expect(timeToMinutes(1, 30)).toBe(90);
    expect(timeToMinutes(23, 59)).toBe(1439);
  });
});

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('should generate valid UUID format', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('validateReminderSize', () => {
  it('should accept small reminders', () => {
    const reminder: Reminder = {
      id: generateId(),
      title: 'Test',
      content: 'Small content',
      repeatStrategy: 'once',
      nextRunAt: new Date().toISOString(),
      status: 'active',
      soundEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    expect(validateReminderSize(reminder)).toBe(true);
  });

  it('should reject large reminders', () => {
    const largeContent = 'x'.repeat(2000);
    const reminder: Reminder = {
      id: generateId(),
      title: 'Test',
      content: largeContent,
      repeatStrategy: 'once',
      nextRunAt: new Date().toISOString(),
      status: 'active',
      soundEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    expect(validateReminderSize(reminder)).toBe(false);
  });
});
