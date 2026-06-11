<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { settingsStore, exportData, importData, remindersStore } from '../store';
  import type { DndPeriod, ThemeMode } from '../types';
  import { WEEKDAYS_FULL } from '../types';

  export let onBack: () => void;

  let showDndForm = false;
  let editingDndIndex: number | null = null;
  let dndForm = {
    start_hour: 23,
    start_min: 0,
    end_hour: 8,
    end_min: 0,
    days: [0, 1, 2, 3, 4, 5, 6] as number[]
  };

  let showDataSection = false;
  let importError = '';

  function handleThemeChange(theme: string) {
    settingsStore.update({ theme: theme as ThemeMode });
  }

  function handleSoundToggle() {
    settingsStore.update({ soundEnabled: !$settingsStore.soundEnabled });
  }

  function handleDesktopNotificationsToggle() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        settingsStore.update({ desktopNotifications: !$settingsStore.desktopNotifications });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            settingsStore.update({ desktopNotifications: true });
          }
        });
      }
    }
  }

  function handleModalDurationChange(duration: number) {
    settingsStore.update({ defaultModalDuration: duration });
  }

  function handleDurationChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    handleModalDurationChange(Number(target.value));
  }

  function openDndForm(period?: DndPeriod, index?: number) {
    if (period) {
      dndForm = { ...period, days: [...period.days] };
      editingDndIndex = index ?? null;
    } else {
      dndForm = {
        start_hour: 23,
        start_min: 0,
        end_hour: 8,
        end_min: 0,
        days: [0, 1, 2, 3, 4, 5, 6]
      };
      editingDndIndex = null;
    }
    showDndForm = true;
  }

  function closeDndForm() {
    showDndForm = false;
    editingDndIndex = null;
  }

  function toggleDndDay(day: number) {
    if (dndForm.days.includes(day)) {
      dndForm.days = dndForm.days.filter(d => d !== day);
    } else {
      dndForm.days = [...dndForm.days, day].sort();
    }
  }

  function saveDnd() {
    if (dndForm.days.length === 0) {
      alert('请选择至少一天');
      return;
    }

    if (editingDndIndex !== null) {
      settingsStore.updateDndPeriod(editingDndIndex, dndForm as DndPeriod);
    } else {
      settingsStore.addDndPeriod(dndForm as DndPeriod);
    }

    closeDndForm();
  }

  function deleteDnd(index: number) {
    if (confirm('确定要删除这个免打扰时段吗？')) {
      settingsStore.removeDndPeriod(index);
    }
  }

  function handleExport() {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reminder-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = importData(content);
      if (success) {
        importError = '';
        alert('导入成功！');
      } else {
        importError = '导入失败：文件格式不正确或版本不兼容';
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  function handleClearAll() {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      if (confirm('再次确认：真的要删除所有提醒和设置吗？')) {
        remindersStore.clearAll();
        alert('数据已清空');
      }
    }
  }

  function formatDndTime(period: DndPeriod): string {
    const start = `${String(period.start_hour).padStart(2, '0')}:${String(period.start_min).padStart(2, '0')}`;
    const end = `${String(period.end_hour).padStart(2, '0')}:${String(period.end_min).padStart(2, '0')}`;
    return `${start} - ${end}`;
  }

  function formatDndDays(days: number[]): string {
    if (days.length === 7) return '每天';
    if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return '工作日';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return '周末';
    return days.map(d => WEEKDAYS_FULL[d]).join('、');
  }

  function getNotificationPermissionText(): string {
    if (!('Notification' in window)) return '不支持';
    switch (Notification.permission) {
      case 'granted': return '已允许';
      case 'denied': return '已拒绝';
      default: return '未授权';
    }
  }
</script>

<div class="settings-page">
  <header class="page-header">
    <button class="back-btn" on:click={onBack}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
      返回
    </button>
    <h1 class="page-title">设置</h1>
    <div style="width: 60px;"></div>
  </header>

  <div class="settings-content">
    <section class="settings-section">
      <h2 class="section-title">通用</h2>
      <div class="settings-card">
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">主题</span>
            <span class="setting-desc">选择界面外观</span>
          </div>
          <div class="theme-options">
            {#each ['light', 'dark', 'auto'] as theme}
              <button
                class="theme-btn {$settingsStore.theme === theme ? 'active' : ''}"
                on:click={() => handleThemeChange(theme)}
              >
                {getThemeIcon(theme)}
                <span>{getThemeLabel(theme)}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">提示音</span>
            <span class="setting-desc">提醒触发时播放提示音</span>
          </div>
          <div class="switch {$settingsStore.soundEnabled ? 'active' : ''}" on:click={handleSoundToggle}>
            <div class="switch-thumb"></div>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">桌面通知</span>
            <span class="setting-desc">系统级通知，当前状态：{getNotificationPermissionText()}</span>
          </div>
          <div class="switch {$settingsStore.desktopNotifications ? 'active' : ''}" on:click={handleDesktopNotificationsToggle}>
            <div class="switch-thumb"></div>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">弹窗默认时长</span>
            <span class="setting-desc">0 表示需要手动关闭</span>
          </div>
          <select
            bind:value={$settingsStore.defaultModalDuration}
            on:change={handleDurationChange}
            class="setting-select"
          >
            <option value={0}>手动关闭</option>
            <option value={5}>5 秒</option>
            <option value={10}>10 秒</option>
            <option value={30}>30 秒</option>
            <option value={60}>1 分钟</option>
          </select>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h2 class="section-title">免打扰时段</h2>
        <button class="add-btn" on:click={() => openDndForm()}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加
        </button>
      </div>

      <div class="settings-card">
        {#if $settingsStore.dndPeriods.length === 0}
          <div class="empty-list">
            <p>暂无免打扰时段</p>
          </div>
        {:else}
          {#each $settingsStore.dndPeriods as period, index}
            <div class="dnd-item">
              <div class="dnd-info">
                <div class="dnd-time">{formatDndTime(period)}</div>
                <div class="dnd-days">{formatDndDays(period.days)}</div>
              </div>
              <div class="dnd-actions">
                <button class="icon-btn" on:click={() => openDndForm(period, index)} title="编辑">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </button>
                <button class="icon-btn delete" on:click={() => deleteDnd(index)} title="删除">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
            {#if index < $settingsStore.dndPeriods.length - 1}
              <div class="divider"></div>
            {/if}
          {/each}
        {/if}
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header" on:click={() => showDataSection = !showDataSection}>
        <h2 class="section-title">数据管理</h2>
        <svg class="chevron {showDataSection ? 'open' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {#if showDataSection}
        <div class="settings-card" transition:slide={{ duration: 200 }}>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">导出数据</span>
              <span class="setting-desc">导出所有提醒和设置为 JSON 文件</span>
            </div>
            <button class="btn btn-secondary" on:click={handleExport}>导出</button>
          </div>

          <div class="divider"></div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">导入数据</span>
              <span class="setting-desc">从备份文件恢复数据</span>
            </div>
            <label class="btn btn-secondary">
              导入
              <input type="file" accept=".json" on:change={handleImport} style="display: none;" />
            </label>
          </div>

          {#if importError}
            <p class="import-error">{importError}</p>
          {/if}

          <div class="divider"></div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label danger">清空所有数据</span>
              <span class="setting-desc">删除所有提醒和设置，不可恢复</span>
            </div>
            <button class="btn btn-danger" on:click={handleClearAll}>清空</button>
          </div>
        </div>
      {/if}
    </section>

    <p class="version-info">Svelte 提醒工具 v1.0.0</p>
  </div>
</div>

{#if showDndForm}
  <div class="modal-overlay" on:click={closeDndForm} transition:fade={{ duration: 200 }}>
    <div class="modal-content" on:click|stopPropagation transition:fade={{ duration: 250 }}>
      <div class="modal-header">
        <h3>{editingDndIndex !== null ? '编辑免打扰时段' : '添加免打扰时段'}</h3>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">开始时间</label>
            <div class="time-picker">
              <select bind:value={dndForm.start_hour} class="form-input">
                {#each Array.from({ length: 24 }, (_, i) => i) as hour}
                  <option value={hour}>{String(hour).padStart(2, '0')}</option>
                {/each}
              </select>
              <span class="time-sep">:</span>
              <select bind:value={dndForm.start_min} class="form-input">
                {#each Array.from({ length: 60 }, (_, i) => i) as min}
                  <option value={min}>{String(min).padStart(2, '0')}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">结束时间</label>
            <div class="time-picker">
              <select bind:value={dndForm.end_hour} class="form-input">
                {#each Array.from({ length: 24 }, (_, i) => i) as hour}
                  <option value={hour}>{String(hour).padStart(2, '0')}</option>
                {/each}
              </select>
              <span class="time-sep">:</span>
              <select bind:value={dndForm.end_min} class="form-input">
                {#each Array.from({ length: 60 }, (_, i) => i) as min}
                  <option value={min}>{String(min).padStart(2, '0')}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">重复</label>
          <div class="weekday-buttons">
            {#each WEEKDAYS_FULL as day, i}
              <button
                class="weekday-btn {dndForm.days.includes(i) ? 'active' : ''}"
                on:click={() => toggleDndDay(i)}
                type="button"
              >
                {day.slice(1)}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={closeDndForm}>取消</button>
        <button class="btn btn-primary" on:click={saveDnd}>保存</button>
      </div>
    </div>
  </div>
{/if}

<script lang="ts" context="module">
  function getThemeLabel(theme: string): string {
    const labels: Record<string, string> = {
      light: '浅色',
      dark: '深色',
      auto: '跟随系统'
    };
    return labels[theme] || theme;
  }

  function getThemeIcon(theme: string): string {
    const icons: Record<string, string> = {
      light: '☀️',
      dark: '🌙',
      auto: '🖥️'
    };
    return icons[theme] || '📱';
  }
</script>

<style>
  .settings-page {
    min-height: 100vh;
    padding-bottom: 40px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    background: var(--bg-primary);
    z-index: 10;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: var(--radius-md);
    color: var(--accent-color);
    font-size: 14px;
    transition: all var(--transition-fast);
  }

  .back-btn:hover {
    background: var(--bg-secondary);
  }

  .back-btn :global(svg) {
    width: 18px;
    height: 18px;
  }

  .page-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .settings-content {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }

  .settings-section {
    margin-bottom: 28px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    cursor: pointer;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
  }

  .chevron {
    width: 20px;
    height: 20px;
    color: var(--text-tertiary);
    transition: transform var(--transition-fast);
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    color: var(--accent-color);
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .add-btn:hover {
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  }

  .add-btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .settings-card {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    gap: 16px;
  }

  .setting-info {
    flex: 1;
    min-width: 0;
  }

  .setting-label {
    display: block;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .setting-label.danger {
    color: var(--danger-color);
  }

  .setting-desc {
    display: block;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .setting-select {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
  }

  .theme-options {
    display: flex;
    gap: 6px;
  }

  .theme-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    font-size: 11px;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
    border: 2px solid transparent;
  }

  .theme-btn.active {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .theme-btn span {
    font-size: 18px;
  }

  .switch {
    position: relative;
    width: 48px;
    height: 28px;
    border-radius: 14px;
    background: var(--bg-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
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

  .divider {
    height: 1px;
    background: var(--border-color);
    margin: 0 16px;
  }

  .empty-list {
    padding: 24px;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 14px;
  }

  .dnd-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
  }

  .dnd-info {
    flex: 1;
  }

  .dnd-time {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .dnd-days {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .dnd-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .icon-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .icon-btn.delete:hover {
    color: var(--danger-color);
    background: color-mix(in srgb, var(--danger-color) 10%, transparent);
  }

  .icon-btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
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
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }

  .btn-danger {
    background: var(--danger-color);
    color: white;
  }

  .btn-danger:hover {
    opacity: 0.9;
  }

  .import-error {
    padding: 12px 16px;
    color: var(--danger-color);
    font-size: 13px;
  }

  .version-info {
    text-align: center;
    color: var(--text-tertiary);
    font-size: 12px;
    margin-top: 32px;
  }

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
    padding: 20px;
  }

  .modal-content {
    background: var(--bg-primary);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }

  .modal-body {
    padding: 20px 24px;
  }

  .form-row {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
  }

  .form-group {
    flex: 1;
  }

  .form-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .time-picker {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .time-picker select {
    flex: 1;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 15px;
    text-align: center;
    outline: none;
  }

  .time-sep {
    font-size: 18px;
    font-weight: 500;
  }

  .weekday-buttons {
    display: flex;
    gap: 6px;
  }

  .weekday-btn {
    flex: 1;
    padding: 10px 0;
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

  .modal-footer {
    display: flex;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-color);
  }

  .modal-footer .btn {
    flex: 1;
  }

  @media (max-width: 480px) {
    .settings-content {
      padding: 16px;
    }

    .setting-item {
      padding: 14px;
    }

    .modal-overlay {
      padding: 0;
      align-items: flex-end;
    }

    .modal-content {
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    }
  }
</style>
