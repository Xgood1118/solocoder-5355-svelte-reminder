<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import type { Reminder, RepeatStrategy, FixedTime } from '../types';
  import { WEEKDAYS } from '../types';
  import { isValidCron } from '../utils';

  export let reminder: Partial<Reminder> | null = null;
  export let onSubmit: (data: ReminderFormData) => void;
  export let onCancel: () => void;

  type FormMode = 'simple' | 'advanced';

  let mode: FormMode = 'simple';
  let title = '';
  let content = '';
  let repeatStrategy: RepeatStrategy = 'once';
  let soundEnabled = true;

  function setStrategy(strategy: string) {
    repeatStrategy = strategy as RepeatStrategy;
  }

  let onceDate = '';
  let onceTime = '';

  let intervalMin = 5;

  let dailyHour = 9;
  let dailyMinute = 0;

  let weeklyHour = 9;
  let weeklyMinute = 0;
  let weeklyDays: number[] = [1, 2, 3, 4, 5];

  let cronExpr = '0 9 * * 1-5';
  let cronError = '';

  let tags = '';

  import { onMount } from 'svelte';
  import type { ReminderFormData } from '../types';

  onMount(() => {
    if (reminder) {
      title = reminder.title || '';
      content = reminder.content || '';
      repeatStrategy = reminder.repeatStrategy || 'once';
      soundEnabled = reminder.soundEnabled ?? true;
      tags = (reminder.tags || []).join(', ');

      if (reminder.nextRunAt) {
        const date = new Date(reminder.nextRunAt);
        onceDate = formatDateInput(date);
        onceTime = formatTimeInput(date);
      }

      if (reminder.intervalMin !== undefined) {
        intervalMin = reminder.intervalMin;
      }

      if (reminder.fixedTime) {
        dailyHour = reminder.fixedTime.hour;
        dailyMinute = reminder.fixedTime.minute;
        weeklyHour = reminder.fixedTime.hour;
        weeklyMinute = reminder.fixedTime.minute;
      }

      if (reminder.weeklyDays) {
        weeklyDays = [...reminder.weeklyDays];
      }

      if (reminder.cronExpr) {
        cronExpr = reminder.cronExpr;
      }
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      onceDate = formatDateInput(now);
      onceTime = formatTimeInput(now);
    }
  });

  function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatTimeInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function toggleWeekday(day: number) {
    if (weeklyDays.includes(day)) {
      weeklyDays = weeklyDays.filter(d => d !== day);
    } else {
      weeklyDays = [...weeklyDays, day].sort();
    }
  }

  function validateCron() {
    if (!cronExpr.trim()) {
      cronError = '请输入 cron 表达式';
      return false;
    }
    if (!isValidCron(cronExpr.trim())) {
      cronError = '无效的 cron 表达式';
      return false;
    }
    cronError = '';
    return true;
  }

  function handleSubmit() {
    if (!title.trim()) {
      alert('请输入提醒标题');
      return;
    }

    if (repeatStrategy === 'cron' && !validateCron()) {
      return;
    }

    if (repeatStrategy === 'weekly' && weeklyDays.length === 0) {
      alert('请选择至少一个星期几');
      return;
    }

    let nextRunAt: Date;
    let fixedTime: FixedTime | undefined;
    let cronExprValue: string | undefined;
    let intervalMinValue: number | undefined;
    let weeklyDaysValue: number[] | undefined;

    switch (repeatStrategy) {
      case 'once':
        nextRunAt = new Date(`${onceDate}T${onceTime}`);
        break;
      case 'interval':
        intervalMinValue = intervalMin;
        nextRunAt = new Date(Date.now() + intervalMin * 60 * 1000);
        break;
      case 'daily':
        fixedTime = { hour: dailyHour, minute: dailyMinute };
        nextRunAt = new Date();
        nextRunAt.setHours(dailyHour, dailyMinute, 0, 0);
        if (nextRunAt <= new Date()) {
          nextRunAt.setDate(nextRunAt.getDate() + 1);
        }
        break;
      case 'weekly':
        fixedTime = { hour: weeklyHour, minute: weeklyMinute };
        weeklyDaysValue = [...weeklyDays];
        nextRunAt = getNextWeeklyDate({ hour: weeklyHour, minute: weeklyMinute }, weeklyDays);
        break;
      case 'cron':
        cronExprValue = cronExpr.trim();
        nextRunAt = new Date();
        break;
      default:
        nextRunAt = new Date();
    }

    const tagList = tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    onSubmit({
      title: title.trim(),
      content: content.trim(),
      repeatStrategy,
      soundEnabled,
      nextRunAt: nextRunAt.toISOString(),
      cronExpr: cronExprValue,
      intervalMin: intervalMinValue,
      fixedTime,
      weeklyDays: weeklyDaysValue,
      tags: tagList.length > 0 ? tagList : undefined
    });
  }

  function getNextWeeklyDate(fixedTime: FixedTime, days: number[]): Date {
    const now = new Date();
    const sortedDays = [...days].sort();

    for (let i = 0; i < 8; i++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + i);
      candidate.setHours(fixedTime.hour, fixedTime.minute, 0, 0);

      if (sortedDays.includes(candidate.getDay()) && candidate > now) {
        return candidate;
      }
    }

    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
</script>

<div class="form-overlay" on:click={onCancel} transition:fade={{ duration: 200 }}>
  <div class="form-container" on:click|stopPropagation transition:fade={{ duration: 250 }}>
    <div class="form-header">
      <h2>{reminder ? '编辑提醒' : '新建提醒'}</h2>
      <button class="close-btn" on:click={onCancel}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="form-body">
      <div class="form-group">
        <label class="form-label">标题 *</label>
        <input
          type="text"
          bind:value={title}
          placeholder="输入提醒标题"
          class="form-input"
          maxlength={100}
        />
      </div>

      <div class="form-group">
        <label class="form-label">详细内容</label>
        <textarea
          bind:value={content}
          placeholder="输入提醒详情（可选）"
          class="form-textarea"
          rows={3}
          maxlength={500}
        />
      </div>

      <div class="form-group">
        <label class="form-label">重复策略</label>
        <div class="strategy-tabs">
          {#each ['once', 'interval', 'daily', 'weekly', 'cron'] as strategy}
            <button
              class="strategy-tab {repeatStrategy === strategy ? 'active' : ''}"
              on:click={() => setStrategy(strategy)}
            >
              {getStrategyLabel(strategy)}
            </button>
          {/each}
        </div>
      </div>

      {#if repeatStrategy === 'once'}
        <div class="form-row" transition:fade={{ duration: 200 }}>
          <div class="form-group flex-1">
            <label class="form-label">日期</label>
            <input type="date" bind:value={onceDate} class="form-input" />
          </div>
          <div class="form-group flex-1">
            <label class="form-label">时间</label>
            <input type="time" bind:value={onceTime} class="form-input" />
          </div>
        </div>
      {/if}

      {#if repeatStrategy === 'interval'}
        <div class="form-group" transition:fade={{ duration: 200 }}>
          <label class="form-label">间隔时间（分钟）</label>
          <div class="interval-input-group">
            <button class="interval-btn" on:click={() => intervalMin = Math.max(1, intervalMin - 5)}>-</button>
            <input type="number" bind:value={intervalMin} min={1} max={1440} class="form-input interval-value" />
            <button class="interval-btn" on:click={() => intervalMin = Math.min(1440, intervalMin + 5)}>+</button>
          </div>
          <p class="form-hint">提醒将每 {intervalMin} 分钟触发一次，直到你标记完成</p>
        </div>
      {/if}

      {#if repeatStrategy === 'daily'}
        <div class="form-group" transition:fade={{ duration: 200 }}>
          <label class="form-label">每天时间</label>
          <div class="time-picker">
            <select bind:value={dailyHour} class="form-input time-select">
              {#each Array.from({ length: 24 }, (_, i) => i) as hour}
                <option value={hour}>{String(hour).padStart(2, '0')}</option>
              {/each}
            </select>
            <span class="time-separator">:</span>
            <select bind:value={dailyMinute} class="form-input time-select">
              {#each Array.from({ length: 60 }, (_, i) => i) as minute}
                <option value={minute}>{String(minute).padStart(2, '0')}</option>
              {/each}
            </select>
          </div>
        </div>
      {/if}

      {#if repeatStrategy === 'weekly'}
        <div class="form-group" transition:fade={{ duration: 200 }}>
          <label class="form-label">每周时间</label>
          <div class="time-picker">
            <select bind:value={weeklyHour} class="form-input time-select">
              {#each Array.from({ length: 24 }, (_, i) => i) as hour}
                <option value={hour}>{String(hour).padStart(2, '0')}</option>
              {/each}
            </select>
            <span class="time-separator">:</span>
            <select bind:value={weeklyMinute} class="form-input time-select">
              {#each Array.from({ length: 60 }, (_, i) => i) as minute}
                <option value={minute}>{String(minute).padStart(2, '0')}</option>
              {/each}
            </select>
          </div>
          <div class="weekday-buttons">
            {#each WEEKDAYS as day, i}
              <button
                class="weekday-btn {weeklyDays.includes(i) ? 'active' : ''}"
                on:click={() => toggleWeekday(i)}
                type="button"
              >
                {day}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if repeatStrategy === 'cron'}
        <div class="form-group" transition:fade={{ duration: 200 }}>
          <label class="form-label">Cron 表达式</label>
          <div class="cron-preset-buttons">
            <button class="preset-btn" type="button" on:click={() => cronExpr = '0 9 * * 1-5'}>工作日 9 点</button>
            <button class="preset-btn" type="button" on:click={() => cronExpr = '0 12 * * 0,6'}>周末 12 点</button>
            <button class="preset-btn" type="button" on:click={() => cronExpr = '0 * * * *'}>每小时</button>
            <button class="preset-btn" type="button" on:click={() => cronExpr = '*/30 * * * *'}>每 30 分钟</button>
          </div>
          <input
            type="text"
            bind:value={cronExpr}
            placeholder="如: 0 9 * * 1-5"
            class="form-input {cronError ? 'error' : ''}"
            on:blur={validateCron}
          />
          {#if cronError}
            <p class="form-error">{cronError}</p>
          {/if}
          <p class="form-hint">格式：分 时 日 月 周</p>
        </div>
      {/if}

      <div class="form-group">
        <label class="form-label">标签（用逗号分隔）</label>
        <input
          type="text"
          bind:value={tags}
          placeholder="工作, 生活, 健康..."
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label class="form-label switch-label">
          <span>提示音</span>
          <div class="switch {soundEnabled ? 'active' : ''}" on:click={() => soundEnabled = !soundEnabled}>
            <div class="switch-thumb"></div>
          </div>
        </label>
      </div>
    </div>

    <div class="form-footer">
      <button class="btn btn-secondary" on:click={onCancel}>取消</button>
      <button class="btn btn-primary" on:click={handleSubmit}>
        {reminder ? '保存修改' : '创建提醒'}
      </button>
    </div>
  </div>
</div>

<script lang="ts" context="module">
  function getStrategyLabel(strategy: string): string {
    const labels: Record<string, string> = {
      once: '一次',
      interval: '间隔',
      daily: '每天',
      weekly: '每周',
      cron: 'Cron'
    };
    return labels[strategy] || strategy;
  }
</script>

<style>
  .form-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
    padding: 20px;
  }

  .form-container {
    background: var(--bg-primary);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .form-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .close-btn :global(svg) {
    width: 20px;
    height: 20px;
  }

  .form-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .form-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    transition: all var(--transition-fast);
    outline: none;
  }

  .form-input:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
  }

  .form-input.error {
    border-color: var(--danger-color);
  }

  .form-textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    resize: vertical;
    transition: all var(--transition-fast);
    outline: none;
    font-family: inherit;
  }

  .form-textarea:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
  }

  .form-hint {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 6px;
  }

  .form-error {
    font-size: 12px;
    color: var(--danger-color);
    margin-top: 6px;
  }

  .form-row {
    display: flex;
    gap: 12px;
  }

  .flex-1 {
    flex: 1;
  }

  .strategy-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .strategy-tab {
    flex: 1;
    min-width: 60px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .strategy-tab.active {
    background: var(--accent-color);
    color: white;
  }

  .interval-input-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .interval-btn {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    font-size: 20px;
    font-weight: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .interval-btn:hover {
    background: var(--bg-tertiary);
  }

  .interval-value {
    flex: 1;
    text-align: center;
    -moz-appearance: textfield;
  }

  .interval-value::-webkit-outer-spin-button,
  .interval-value::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .time-picker {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .time-select {
    flex: 1;
    text-align: center;
  }

  .time-separator {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .weekday-buttons {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }

  .weekday-btn {
    flex: 1;
    padding: 8px 0;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .weekday-btn.active {
    background: var(--accent-color);
    color: white;
  }

  .cron-preset-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .preset-btn {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 12px;
    transition: all var(--transition-fast);
  }

  .preset-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .switch-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .switch {
    position: relative;
    width: 48px;
    height: 28px;
    border-radius: 14px;
    background: var(--bg-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .switch.active {
    background: var(--accent-color);
  }

  .switch-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transition: all var(--transition-fast);
  }

  .switch.active .switch-thumb {
    left: 22px;
  }

  .form-footer {
    display: flex;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-color);
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

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }

  @media (max-width: 480px) {
    .form-overlay {
      padding: 0;
      align-items: flex-end;
    }

    .form-container {
      max-height: 92vh;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    }

    .strategy-tab {
      font-size: 12px;
      padding: 8px 8px;
    }
  }
</style>
