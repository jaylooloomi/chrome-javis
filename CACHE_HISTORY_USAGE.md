# 缓存历史页面使用指南

## 概述
`cache-history.html` 和 `cache-history.js` 提供了一个专门的用户界面来查看和管理 AI 结果缓存。

## 功能特性

### 1. 缓存统计卡片
显示三个关键指标：
- **总缓存数**：当前存储的所有缓存条目数量
- **最近记录**：最近使用列表中的条目数量（最多10条）
- **最大容量**：最近使用列表的容量限制

### 2. 缓存列表
展示最多10条最近使用的缓存记录，每条包含：
- **用户输入**：原始的用户查询文本
- **技能**：识别出的执行技能名称
- **参数**：执行技能所需的参数（JSON格式）
- **时间戳**：相对时间（如"2分钟前"）

### 3. 控制按钮
- **🔄 刷新数据**：重新获取最新的缓存统计信息
- **🗑️ 清空缓存**：清空所有缓存数据（确认后执行）

## 技术细节

### 消息协议

#### 获取缓存统计 (get_cache_stats)
```javascript
// 发送请求
chrome.runtime.sendMessage({ action: 'get_cache_stats' }, (response) => {
    // response: {
    //   status: 'success',
    //   data: {
    //     totalCacheSize: number,
    //     recentCount: number,
    //     maxRecent: number,
    //     recentEntries: [{userInput, skill, args, timestamp}, ...],
    //     oldestEntry: {...}
    //   }
    // }
});
```

#### 清空缓存 (clear_cache)
```javascript
// 发送请求
chrome.runtime.sendMessage({ action: 'clear_cache' }, (response) => {
    // response: {
    //   status: 'success',
    //   message: '缓存已清空'
    // }
});
```

### 时间格式化
时间戳自动格式化为相对时间格式：
- `1秒前`
- `5分钟前`
- `2小时前`
- `1天前`
- 等等

### 错误处理
所有错误都会在页面顶部显示用户友好的错误消息：
- 成功操作：绿色背景（3秒后自动隐藏）
- 错误操作：红色背景（持续显示）

## 访问方式

### 方式1：直接URL访问
在Chrome地址栏输入：
```
chrome-extension://[extension-id]/cache-history.html
```

### 方式2：添加菜单项（可选）
可以在未来的版本中添加快捷菜单项，让用户通过上下文菜单或工具栏快速访问。

### 方式3：SidePanel链接（可选）
可以在SidePanel中添加一个链接，方便用户快速查看缓存。

## 开发注意事项

### 文件依赖
- `cache-history.html` - UI结构和样式
- `cache-history.js` - 交互逻辑
- `service-worker.js` - 后端数据提供

### 样式特点
- 响应式网格布局
- 渐变背景的统计卡片
- 平滑的过渡和悬停效果
- 适应各种屏幕宽度

### 扩展建议
1. **持久化存储**：使用 `chrome.storage` 或 IndexedDB 保存缓存跨会话
2. **搜索功能**：添加搜索框来过滤缓存条目
3. **导出功能**：允许用户将缓存导出为 JSON 或 CSV
4. **缓存统计**：显示缓存命中率、最常用技能等统计信息
5. **缓存重放**：允许用户重新执行历史缓存中的技能

## 测试清单

- [ ] 页面加载时正确显示缓存统计
- [ ] 刷新按钮能够更新缓存数据
- [ ] 时间戳正确格式化
- [ ] 空缓存状态正确显示
- [ ] 清空缓存确认对话框工作正常
- [ ] 清空后列表正确更新为空状态
- [ ] 错误消息正确显示（如Service Worker不可用）
- [ ] 页面在不同屏幕宽度上响应良好
- [ ] 所有文本正确显示（中文和英文）
