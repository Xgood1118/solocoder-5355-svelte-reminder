<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import type { Reminder } from '../types';
  import { remindersStore, settingsStore, activeReminders } from '../store';
  import { getTodayStats, getCountdownText } from '../utils';
  import ReminderItem from '../components/ReminderItem.svelte';
  import ReminderForm from '../components/ReminderForm.svelte';
  import ReminderModal from '../components/ReminderModal.svelte';

  export let onNavigateSettings: () => void;

  let showForm = false;
  let editingReminder: Reminder | null = null;
  let currentModal: Reminder | null = null;
  let searchQuery = '';
  let selectMode = false;
  let selectedIds = new Set<string>();
  let sortBy: 'time' | 'title' | 'created' = 'time';
  let filterStatus: 'all' | 'active' | 'paused' | 'completed' = 'all';
  let now = new Date();
  let tickInterval: number | null = null;

  function setSortBy(option: string) {
    sortBy = option as 'time' | 'title' | 'created';
  }

  $: todayStats = getTodayStats($remindersStore);

  $: filteredReminders = getFilteredReminders(
    $remindersStore,
    searchQuery,
    filterStatus,
    sortBy
  );

  function getFilteredReminders(
    reminders: Reminder[],
    query: string,
    status: string,
    sort: string
  ): Reminder[] {
    let filtered = reminders;

    if (status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        r.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    const sorted = [...filtered];
    switch (sort) {
      case 'time':
        sorted.sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'created':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return sorted;
  }

  function handleCreate() {
    editingReminder = null;
    showForm = true;
  }

  function handleEdit(reminder: Reminder) {
    editingReminder = reminder;
    showForm = true;
  }

  function handleDelete(reminder: Reminder) {
    if (confirm(`确定要删除提醒"${reminder.title}"吗？`)) {
      remindersStore.remove(reminder.id);
    }
  }

  function handleToggle(reminder: Reminder) {
    remindersStore.toggleStatus(reminder.id);
  }

  function handleFormSubmit(data: any) {
    if (editingReminder) {
      remindersStore.update(editingReminder.id, data);
    } else {
      remindersStore.add(data);
    }
    showForm = false;
    editingReminder = null;
  }

  function handleFormCancel() {
    showForm = false;
    editingReminder = null;
  }

  function handleModalClose() {
    currentModal = null;
  }

  function handleModalSnooze(minutes: number) {
    if (currentModal) {
      remindersStore.snooze(currentModal.id, minutes);
    }
  }

  function handleModalComplete() {
    if (currentModal) {
      remindersStore.update(currentModal.id, { status: 'completed' });
    }
  }

  function toggleSelectMode() {
    selectMode = !selectMode;
    if (!selectMode) {
      selectedIds.clear();
    }
  }

  function toggleSelect(id: string) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = new Set(selectedIds);
  }

  function selectAll() {
    if (selectedIds.size === filteredReminders.length) {
      selectedIds.clear();
    } else {
      selectedIds = new Set(filteredReminders.map(r => r.id));
    }
  }

  function batchDelete() {
    if (selectedIds.size === 0) return;
    if (confirm(`确定要删除选中的 ${selectedIds.size} 条提醒吗？`)) {
      selectedIds.forEach(id => remindersStore.remove(id));
      selectedIds.clear();
      selectMode = false;
    }
  }

  function batchPause() {
    selectedIds.forEach(id => {
      const r = $remindersStore.find(x => x.id === id);
      if (r && r.status === 'active') {
        remindersStore.toggleStatus(id);
      }
    });
  }

  onMount(() => {
    tickInterval = window.setInterval(() => {
      now = new Date();
    }, 1000);
  });

  onDestroy(() => {
    if (tickInterval) {
      clearInterval(tickInterval);
    }
  });
</script>

<div class="home-page">
  <header class="page-header">
    <div class="header-left">
      <h1 class="page-title">提醒</h1>
      <span class="reminder-count">{$remindersStore.length} 条</span>
    </div>
    <div class="header-right">
      <button class="icon-btn" on:click={toggleSelectMode} title="批量操作">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      </button>
      <button class="icon-btn" on:click={onNavigateSettings} title="设置">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  </header>

  <div class="stats-card">
    <div class="stat-item">
      <div class="stat-value active">{todayStats.active}</div>
      <div class="stat-label">待提醒</div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <div class="stat-value completed">{todayStats.completed}</div>
      <div class="stat-label">已完成</div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <div class="stat-value missed">{todayStats.missed}</div>
      <div class="stat-label">已错过</div>
    </div>
  </div>

  <div class="search-bar">
    <div class="search-input-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="搜索提醒..."
        class="search-input"
      />
      {#if searchQuery}
        <button class="clear-btn" on:click={() => searchQuery = ''}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {/if}
    </div>
    <select bind:value={filterStatus} class="filter-select">
      <option value="all">全部</option>
      <option value="active">运行中</option>
      <option value="paused">已暂停</option>
      <option value="completed">已完成</option>
    </select>
  </div>

  {#if selectMode}
    <div class="batch-actions" transition:slide={{ duration: 200 }}>
      <button class="batch-btn" on:click={selectAll}>
        {selectedIds.size === filteredReminders.length ? '取消全选' : '全选'}
      </button>
      <button class="batch-btn" on:click={batchPause} disabled={selectedIds.size === 0}>
        批量暂停
      </button>
      <button class="batch-btn danger" on:click={batchDelete} disabled={selectedIds.size === 0}>
        批量删除
      </button>
      <span class="selected-count">已选 {selectedIds.size} 项</span>
    </div>
  {/if}

  <div class="sort-bar">
    <span class="sort-label">排序：</span>
    {#each ['time', 'title', 'created'] as option}
      <button
        class="sort-btn {sortBy === option ? 'active' : ''}"
        on:click={() => setSortBy(option)}
      >
        {getSortLabel(option)}
      </button>
    {/each}
  </div>

  <div class="reminder-list">
    {#if filteredReminders.length === 0}
      <div class="empty-state" transition:fade={{ duration: 300 }}>
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <p class="empty-text">
          {#if searchQuery || filterStatus !== 'all'}
            没有找到匹配的提醒
          {:else}
            还没有任何提醒
          {/if}
        </p>
        <p class="empty-hint">点击右下角 + 号创建你的第一个提醒</p>
      </div>
    {:else}
      {#each filteredReminders as reminder (reminder.id)}
        <div in:fade={{ duration: 200 }}>
          <ReminderItem
            reminder={reminder}
            selectMode={selectMode}
            selected={selectedIds.has(reminder.id)}
            onSelect={() => toggleSelect(reminder.id)}
            onToggle={() => handleToggle(reminder)}
            onEdit={() => handleEdit(reminder)}
            onDelete={() => handleDelete(reminder)}
          />
        </div>
      {/each}
    {/if}
  </div>

  <button class="fab" on:click={handleCreate} transition:scale={{ duration: 300 }}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </button>
</div>

{#if showForm}
  <ReminderForm
    reminder={editingReminder}
    onSubmit={handleFormSubmit}
    onCancel={handleFormCancel}
  />
{/if}

{#if currentModal}
  <ReminderModal
    reminder={currentModal}
    onClose={handleModalClose}
    onSnooze={handleModalSnooze}
    onComplete={handleModalComplete}
  />
{/if}

<script lang="ts" context="module">
  function getSortLabel(sort: string): string {
    const labels: Record<string, string> = {
      time: '按时间',
      title: '按标题',
      created: '按创建时间'
    };
    return labels[sort] || sort;
  }
</script>

<style>
  .home-page {
    min-height: 100vh;
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
    padding-bottom: 100px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .page-title {
    font-size: 32px;
    font-weight: 700;
    margin: 0;
  }

  .reminder-count {
    font-size: 14px;
    color: var(--text-tertiary);
  }

  .header-right {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .icon-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .icon-btn :global(svg) {
    width: 22px;
    height: 22px;
  }

  .stats-card {
    display: flex;
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 20px;
    margin-bottom: 20px;
  }

  .stat-item {
    flex: 1;
    text-align: center;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .stat-value.active {
    color: var(--accent-color);
  }

  .stat-value.completed {
    color: var(--success-color);
  }

  .stat-value.missed {
    color: var(--warning-color);
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .stat-divider {
    width: 1px;
    background: var(--border-color);
    margin: 0 10px;
  }

  .search-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
  }

  .search-input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    width: 18px;
    height: 18px;
    color: var(--text-tertiary);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 36px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: all var(--transition-fast);
  }

  .search-input:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    border-radius: 50%;
    transition: all var(--transition-fast);
  }

  .clear-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .clear-btn :global(svg) {
    width: 14px;
    height: 14px;
  }

  .filter-select {
    padding: 10px 14px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    cursor: pointer;
  }

  .batch-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    margin-bottom: 12px;
  }

  .batch-btn {
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .batch-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-color) 15%, var(--bg-tertiary));
    color: var(--accent-color);
  }

  .batch-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .batch-btn.danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--danger-color) 15%, var(--bg-tertiary));
    color: var(--danger-color);
  }

  .selected-count {
    margin-left: auto;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .sort-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .sort-label {
    font-size: 13px;
    color: var(--text-tertiary);
  }

  .sort-btn {
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .sort-btn.active {
    background: var(--accent-color);
    color: white;
  }

  .reminder-list {
    position: relative;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    color: var(--text-tertiary);
    opacity: 0.5;
  }

  .empty-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .empty-text {
    font-size: 16px;
    color: var(--text-secondary);
    margin: 0 0 8px 0;
  }

  .empty-hint {
    font-size: 13px;
    color: var(--text-tertiary);
    margin: 0;
  }

  .fab {
    position: fixed;
    right: 24px;
    bottom: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-lg);
    transition: all var(--transition-fast);
    z-index: 100;
  }

  .fab:hover {
    background: var(--accent-hover);
    transform: scale(1.05);
  }

  .fab :global(svg) {
    width: 24px;
    height: 24px;
  }

  @media (max-width: 640px) {
    .home-page {
      padding: 16px;
      padding-bottom: 80px;
    }

    .page-title {
      font-size: 26px;
    }

    .stats-card {
      padding: 16px 12px;
    }

    .stat-value {
      font-size: 24px;
    }

    .fab {
      width: 52px;
      height: 52px;
      right: 20px;
      bottom: 20px;
    }
  }
</style>
