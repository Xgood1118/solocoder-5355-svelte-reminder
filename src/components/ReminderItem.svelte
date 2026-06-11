<script lang="ts">
  import type { Reminder } from '../types';
  import { formatDateTime, getCountdownText } from '../utils';

  export let reminder: Reminder;
  export let onToggle: () => void;
  export let onEdit: () => void;
  export let onDelete: () => void;
  export let selected = false;
  export let onSelect: (() => void) | undefined = undefined;
  export let selectMode = false;

  let showActions = false;

  function getStatusText(): string {
    switch (reminder.status) {
      case 'active': return '运行中';
      case 'paused': return '已暂停';
      case 'completed': return '已完成';
      default: return reminder.status;
    }
  }

  function getStrategyText(): string {
    switch (reminder.repeatStrategy) {
      case 'once': return '一次';
      case 'interval': return `每${reminder.intervalMin}分钟`;
      case 'daily': return '每天';
      case 'weekly': return '每周';
      case 'cron': return 'Cron';
      default: return reminder.repeatStrategy;
    }
  }
</script>

<div class="reminder-item {reminder.status} {selected ? 'selected' : ''}">
  {#if selectMode}
    <div class="checkbox" on:click={onSelect}>
      <div class="checkbox-inner {selected ? 'checked' : ''}">
        {#if selected}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        {/if}
      </div>
    </div>
  {/if}

  <div class="item-main" on:click|stopPropagation={() => showActions = !showActions}>
    <div class="item-header">
      <h3 class="item-title">{reminder.title}</h3>
      <span class="status-badge {reminder.status}">{getStatusText()}</span>
    </div>

    {#if reminder.content}
      <p class="item-content">{reminder.content}</p>
    {/if}

    <div class="item-meta">
      <div class="meta-item">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>{formatDateTime(reminder.nextRunAt)}</span>
      </div>
      <div class="meta-item countdown">
        {getCountdownText(reminder.nextRunAt)}
      </div>
      <div class="meta-item strategy">
        {getStrategyText()}
      </div>
    </div>

    {#if reminder.tags && reminder.tags.length > 0}
      <div class="item-tags">
        {#each reminder.tags as tag}
          <span class="tag">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="item-actions">
    <button class="action-btn toggle-btn {reminder.status === 'active' ? 'active' : ''}" on:click|stopPropagation={onToggle} title={reminder.status === 'active' ? '暂停' : '启用'}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        {#if reminder.status === 'active'}
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        {:else}
          <polygon points="5 3 19 12 5 21 5 3"/>
        {/if}
      </svg>
    </button>
    <button class="action-btn edit-btn" on:click|stopPropagation={onEdit} title="编辑">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    </button>
    <button class="action-btn delete-btn" on:click|stopPropagation={onDelete} title="删除">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .reminder-item {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 16px;
    margin-bottom: 10px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    transition: all var(--transition-fast);
    cursor: pointer;
    border: 2px solid transparent;
  }

  .reminder-item:hover {
    background: var(--bg-tertiary);
  }

  .reminder-item.selected {
    border-color: var(--accent-color);
    background: color-mix(in srgb, var(--accent-color) 8%, var(--bg-secondary));
  }

  .reminder-item.completed {
    opacity: 0.6;
  }

  .reminder-item.completed .item-title {
    text-decoration: line-through;
  }

  .checkbox {
    padding-top: 2px;
  }

  .checkbox-inner {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .checkbox-inner.checked {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .checkbox-inner :global(svg) {
    width: 14px;
    height: 14px;
  }

  .item-main {
    flex: 1;
    min-width: 0;
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
  }

  .item-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-badge {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }

  .status-badge.active {
    background: color-mix(in srgb, var(--success-color) 15%, transparent);
    color: var(--success-color);
  }

  .status-badge.paused {
    background: color-mix(in srgb, var(--warning-color) 15%, transparent);
    color: var(--warning-color);
  }

  .status-badge.completed {
    background: color-mix(in srgb, var(--text-tertiary) 20%, transparent);
    color: var(--text-tertiary);
  }

  .item-content {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 10px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .meta-item :global(svg) {
    width: 14px;
    height: 14px;
  }

  .meta-item.countdown {
    color: var(--accent-color);
    font-weight: 500;
  }

  .meta-item.strategy {
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .item-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  .tag {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .item-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .reminder-item:hover .item-actions {
    opacity: 1;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .action-btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .toggle-btn.active {
    color: var(--success-color);
  }

  .delete-btn:hover {
    color: var(--danger-color);
    background: color-mix(in srgb, var(--danger-color) 10%, transparent);
  }

  @media (max-width: 640px) {
    .item-actions {
      opacity: 1;
    }

    .item-actions {
      flex-direction: row;
    }
  }
</style>
