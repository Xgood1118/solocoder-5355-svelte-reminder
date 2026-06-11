# Svelte 提醒工具

一个基于 Svelte 4 + Vite + TypeScript 的屏幕弹窗提醒工具，纯前端实现，所有数据存储在 localStorage 中，无需后端。

## 功能特性

### 核心功能
- **模态弹窗提醒**：到点弹出模态窗口，不关闭就一直显示在最前面
- **多种提醒策略**：
  - **一次**：指定日期时间，提醒一次后标记完成
  - **间隔**：每 N 分钟提醒一次，直到标记完成
  - **每天**：每天固定时间提醒
  - **每周**：指定星期几和时间提醒
  - **Cron**：使用 Cron 表达式自定义任意时间规则

### 高级功能
- **免打扰时段**：可配置多个免打扰时间段，期间的提醒会被缓存，结束后统一提示
- **桌面通知**：支持浏览器原生通知（Notification API）
- **主题切换**：支持浅色/深色/跟随系统三种主题模式
- **提示音**：提醒触发时播放提示音（可关闭）
- **延迟提醒**：支持延迟 5 分钟或 1 小时后再提醒
- **标签分类**：为提醒打标签，便于管理和筛选
- **搜索过滤**：按标题、内容、标签搜索提醒
- **批量操作**：多选删除、批量暂停
- **数据导入导出**：JSON 格式导入导出数据
- **响应式设计**：完美适配移动端和桌面端

### 技术特性
- 使用 **croner** 库解析 Cron 表达式（~5KB）
- **Page Visibility API** 检测页面可见性，标签页恢复时补算错过的提醒
- 数据持久化到 **localStorage**，带版本号便于后续迁移
- **Svelte transition** 动画，弹窗淡入淡出效果
- 纯前端实现，构建产物 gzip 后 < 50KB

## 使用方法

### 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 运行单元测试
npm run test
```

### 创建提醒

1. 点击右下角 **+** 按钮或右上角的加号
2. 输入提醒标题和详细内容
3. 选择提醒策略：
   - **一次**：选择具体的日期和时间
   - **间隔**：设置间隔分钟数
   - **每天**：设置每天的提醒时间
   - **每周**：选择星期几和时间
   - **Cron**：输入 Cron 表达式（高级用户）
4. 可选：添加标签、开启/关闭提示音
5. 点击"创建提醒"

### 弹窗操作

提醒触发时会弹出模态窗口，你可以：
- **我知道了**：关闭弹窗（间隔提醒会自动安排下一次）
- **延迟 5 分钟**：5 分钟后再次提醒
- **延迟 1 小时**：1 小时后再次提醒
- **标记完成**：标记为已完成，不再提醒
- **查看详情**：展开查看更多信息

### 免打扰时段

在设置页面可以配置免打扰时段：
- 免打扰期间，到点的提醒会被放入队列
- 免打扰结束后，会显示"您有 N 条错过的提醒"
- 支持跨天时段（如 23:00 - 次日 08:00）
- 支持指定星期几生效

### 数据管理

在设置页面的数据管理部分：
- **导出数据**：导出所有提醒和设置为 JSON 文件
- **导入数据**：从备份文件恢复数据
- **清空数据**：删除所有数据（不可恢复）

## 数据模型

### Reminder（提醒）

```typescript
interface Reminder {
  id: string;              // UUID
  title: string;           // 标题
  content: string;         // 详细内容
  repeatStrategy: 'once' | 'interval' | 'daily' | 'weekly' | 'cron';
  cronExpr?: string;       // Cron 表达式（cron 策略）
  intervalMin?: number;    // 间隔分钟数（interval 策略）
  fixedTime?: { hour: number; minute: number };  // 固定时间（daily/weekly）
  weeklyDays?: number[];   // 星期几（weekly 策略，0=周日）
  nextRunAt: string;       // 下次触发时间 ISO 字符串
  lastRunAt?: string;      // 上次触发时间 ISO 字符串
  status: 'active' | 'paused' | 'completed';
  soundEnabled: boolean;   // 是否播放提示音
  createdAt: string;       // 创建时间
  updatedAt: string;       // 更新时间
  tags?: string[];         // 标签列表
}
```

### Settings（设置）

```typescript
interface Settings {
  theme: 'light' | 'dark' | 'auto';
  soundEnabled: boolean;
  desktopNotifications: boolean;
  defaultModalDuration: number;  // 0 = 手动关闭
  defaultRepeatStrategy: RepeatStrategy;
  dndPeriods: DndPeriod[];
}
```

### DndPeriod（免打扰时段）

```typescript
interface DndPeriod {
  start_hour: number;
  start_min: number;
  end_hour: number;
  end_min: number;
  days: number[];  // 0-6，周日到周六
}
```

## Cron 表达式说明

Cron 表达式格式：`分 时 日 月 周`

| 字段 | 范围 | 允许的特殊字符 |
|------|------|---------------|
| 分钟 | 0-59 | `*` `,` `-` `/` |
| 小时 | 0-23 | `*` `,` `-` `/` |
| 日期 | 1-31 | `*` `,` `-` `/` |
| 月份 | 1-12 | `*` `,` `-` `/` |
| 星期 | 0-6 | `*` `,` `-` `/` |

常用示例：
- `0 9 * * 1-5` — 工作日早上 9 点
- `0 12 * * 0,6` — 周末中午 12 点
- `*/30 * * * *` — 每 30 分钟
- `0 * * * *` — 每小时整点
- `0 9 1 * *` — 每月 1 号早上 9 点

## 部署到 GitHub Pages

1. 构建项目：
   ```bash
   npm run build
   ```

2. 将 `dist/` 目录的内容推送到 `gh-pages` 分支。

3. 访问地址：`https://<your-username>.github.io/solocoder-5355-svelte-reminder/`

## 注意事项

- 浏览器休眠或标签页不活跃时，定时器可能不够精确，页面重新激活时会自动补算
- 数据存储在浏览器 localStorage 中，清除浏览器数据会导致提醒丢失，建议定期导出备份
- 单条提醒内容建议控制在 1KB 以内，避免超出 localStorage 容量限制
- 桌面通知需要浏览器授权，且仅在页面打开时有效

## 技术栈

- **Svelte 4** — UI 框架
- **Vite 5** — 构建工具
- **TypeScript** — 类型系统
- **croner** — Cron 表达式解析
- **vitest** — 单元测试

## License

MIT
