<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { Reminder } from '../types';
  import { formatDateTime } from '../utils';
  import { onMount, onDestroy } from 'svelte';

  export let reminder: Reminder;
  export let onClose: () => void;
  export let onSnooze: (minutes: number) => void;
  export let onComplete: () => void;
  export let showDetails = false;

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    document.body.style.overflow = 'hidden';
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  });

  function handleSnooze(minutes: number) {
    onSnooze(minutes);
    onClose();
  }

  function handleComplete() {
    onComplete();
    onClose();
  }

  function toggleDetails() {
    showDetails = !showDetails;
  }
</script>

<div class="modal-overlay" on:click|stopPropagation={onClose} transition:fade={{ duration: 200 }}>
  <div class="modal-content" on:click|stopPropagation transition:scale={{ duration: 250, start: 0.95 }}>
    <div class="modal-header">
      <div class="icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
      </div>
      <h2 class="title">{reminder.title}</h2>
    </div>

    <div class="modal-body">
      {#if reminder.content}
        <p class="content">{reminder.content}</p>
      {/if}

      {#if showDetails}
        <div class="details" transition:fade={{ duration: 200 }}>
          <div class="detail-row">
            <span class="label">下次提醒</span>
            <span class="value">{formatDateTime(reminder.nextRunAt)}</span>
          </div>
          <div class="detail-row">
            <span class="label">重复策略</span>
            <span class="value">{getStrategyLabel(reminder.repeatStrategy)}</span>
          </div>
          {#if reminder.lastRunAt}
            <div class="detail-row">
              <span class="label">上次提醒</span>
              <span class="value">{formatDateTime(reminder.lastRunAt)}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="modal-actions">
      <button class="btn btn-secondary" on:click={toggleDetails}>
        {showDetails ? '收起详情' : '查看详情'}
      </button>
      <button class="btn btn-secondary" on:click={() => handleSnooze(5)}>
        延迟 5 分钟
      </button>
      <button class="btn btn-secondary" on:click={() => handleSnooze(60)}>
        延迟 1 小时
      </button>
      <button class="btn btn-primary" on:click={handleComplete}>
        标记完成
      </button>
      <button class="btn btn-primary btn-dismiss" on:click={onClose}>
        我知道了
      </button>
    </div>
  </div>
</div>

<script lang="ts" context="module">
  function getStrategyLabel(strategy: string): string {
    const labels: Record<string, string> = {
      once: '仅一次',
      interval: '间隔提醒',
      daily: '每天',
      weekly: '每周',
      cron: '自定义 Cron'
    };
    return labels[strategy] || strategy;
  }
</script>

<style>
  .modal-overlay {
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
  }

  .modal-content {
    background: var(--bg-primary);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    width: 90%;
    max-width: 420px;
    padding: 32px;
    position: relative;
  }

  .modal-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 16px;
    background: var(--accent-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon :global(svg) {
    width: 28px;
    height: 28px;
  }

  .title {
    font-size: 22px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .modal-body {
    margin-bottom: 28px;
  }

  .content {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.6;
    text-align: center;
    margin: 0;
  }

  .details {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
  }

  .label {
    color: var(--text-tertiary);
  }

  .value {
    color: var(--text-primary);
    font-weight: 500;
  }

  .modal-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn {
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

  .btn-dismiss {
    margin-top: 4px;
  }

  @media (max-width: 480px) {
    .modal-content {
      padding: 24px 20px;
    }

    .title {
      font-size: 19px;
    }
  }
</style>
