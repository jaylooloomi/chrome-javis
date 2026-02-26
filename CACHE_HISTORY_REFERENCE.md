# 缓存历史页面 - 快速参考卡

## 🚀 立即开始

### 步骤 1: 获取扩展ID
1. 打开 Chrome：`chrome://extensions/`
2. 找到 "OmniAssistant" 
3. 复制扩展ID (例: `abcdefghijklmnopqrstuvwxyz`)

### 步骤 2: 访问缓存历史页面
在地址栏输入：
```
chrome-extension://YOUR_EXTENSION_ID/cache-history.html
```

### 步骤 3: 查看缓存
- 📊 顶部显示统计卡片（总数、最近、容量）
- 📋 中间显示缓存列表（最多10条）
- 💡 底部有功能说明

---

## 📊 页面布局

```
┌─────────────────────────────────────────────┐
│              📊 缓存历史                     │
├─────────────────────────────────────────────┤
│  [总缓存数]  [最近记录]  [最大容量]         │
│      0           0            10           │
├─────────────────────────────────────────────┤
│  🔄 刷新数据    🗑️ 清空缓存                 │
├─────────────────────────────────────────────┤
│  📋 最近 10 条缓存                          │
│  ┌──────────────────────────────────────┐   │
│  │ #1 "用户输入内容"                    │   │
│  │ 技能: skill_name                     │   │
│  │ 参数: {...}                          │   │
│  │ ⏱️ 2 分钟前                          │   │
│  └──────────────────────────────────────┘   │
│  (如果没有缓存：📭 还没有缓存记录)          │
├─────────────────────────────────────────────┤
│  💡 说明                                    │
│  - 显示最近10条缓存                        │
│  - 当前会话有效                            │
│  - 刷新页面后清空                          │
└─────────────────────────────────────────────┘
```

---

## 🎮 交互指南

### 刷新数据
```
点击 🔄 刷新数据 按钮
  ↓
显示加载动画
  ↓
获取最新缓存统计
  ↓
✅ 缓存数据已更新 (3秒后自动隐藏)
```

### 清空缓存
```
点击 🗑️ 清空缓存 按钮
  ↓
出现确认对话框
  ↓
点击"确定"
  ↓
所有缓存被删除
  ↓
列表为空，显示 📭
```

### 查看缓存详情
```
每条缓存显示：
├─ 用户输入 (灰色背景框)
├─ 技能名称 (完整技能名)
├─ 执行参数 (JSON格式，最长200字)
└─ 时间 (相对时间如"2分钟前")
```

---

## 📈 统计卡片解释

### 总缓存数 (紫色)
- 含义：所有保存的AI推理结果数
- 范围：0 - 无限制
- 用途：了解缓存总体规模

### 最近记录 (粉红色)
- 含义：最近使用列表中的项数
- 范围：0 - 10 (最多)
- 用途：查看最近活动

### 最大容量 (青色)
- 含义：最近使用列表的大小限制
- 固定值：10
- 用途：参考值，表示系统配置

---

## 🕐 时间格式化规则

| 时间差 | 显示格式 | 例子 |
|-------|--------|------|
| < 1秒 | 刚刚 | 刚刚 |
| 1-60秒 | N秒前 | 30秒前 |
| 1-60分钟 | N分钟前 | 5分钟前 |
| 1-24小时 | N小时前 | 3小时前 |
| ≥ 1天 | N天前 | 2天前 |

---

## ⌨️ 快捷操作

### 使用JavaScript直接调用
在浏览器控制台运行：

```javascript
// 查询缓存统计
chrome.runtime.sendMessage({ action: 'get_cache_stats' }, (resp) => {
    console.log('缓存数:', resp.data.totalCacheSize);
    console.log('最近记录:', resp.data.recentEntries);
});

// 清空所有缓存
chrome.runtime.sendMessage({ action: 'clear_cache' }, (resp) => {
    console.log(resp.message);  // "缓存已清空"
});
```

---

## ❌ 常见问题快速解决

### Q: 页面显示空白
**A:** 
- 检查扩展ID是否正确
- 确认 service-worker.js 已加载（chrome://extensions）
- 刷新页面 (Ctrl+R)

### Q: 缓存显示为0
**A:**
- 首次访问时正常（缓存为空）
- 使用AI功能后会增加
- 刷新页面会清空

### Q: 无法清空缓存
**A:**
- 确认点击了确认对话框的"确定"
- 检查控制台错误 (F12)
- 检查Service Worker状态

### Q: 时间显示不对
**A:**
- 系统时间可能有偏差
- 刷新页面重新计算
- 时间是相对的（相对当前时刻）

---

## 🔧 开发者模式

### 启用调试日志
打开浏览器DevTools (F12)，控制台显示以下信息：

```
[CacheHistory] 页面加载
[CacheHistory] DOM 加载完成，获取缓存历史
[CacheHistory] 请求缓存统计数据
[CacheHistory] 收到响应: {...}
```

### 测试API响应
```javascript
// 在DevTools控制台测试
await chrome.runtime.sendMessage({ action: 'get_cache_stats' })
// 查看完整响应数据
```

---

## 💾 数据持久化说明

### 当前行为
- ✅ 缓存在当前浏览器会话中保持
- ✅ 刷新页面保留缓存数据
- ❌ 关闭浏览器后数据丢失
- ❌ 不支持跨会话保存

### 未来改进
- 计划使用 `chrome.storage` API
- 支持跨会话保存（可选）
- 可配置的过期策略（如7天）

---

## 🎨 样式定制

### 修改统计卡片颜色
编辑 `cache-history.html` 中的CSS：

```css
/* 紫色 → 红色 */
.stat-card.total {
    background: linear-gradient(135deg, #ff6b6b 0%, #c92a2a 100%);
}

/* 粉红色 → 橙色 */
.stat-card.recent {
    background: linear-gradient(135deg, #ffa94d 0%, #ff922b 100%);
}

/* 青色 → 绿色 */
.stat-card.max {
    background: linear-gradient(135deg, #51cf66 0%, #2f9e44 100%);
}
```

### 修改主题颜色
主要颜色定义：
- 主绿色：`#28a745` (按钮、边框)
- 背景色：`#f5f5f5`
- 文字色：`#333`

---

## 📚 相关文档

更多详细信息请参考：
- [使用指南](CACHE_HISTORY_USAGE.md) - API、功能、后续改进
- [快速开始](CACHE_HISTORY_QUICKSTART.md) - 访问、功能、问题解决
- [完整总结](CACHE_HISTORY_COMPLETE_SUMMARY.md) - 架构、设计、技术细节

---

## 📞 获取帮助

遇到问题？

1. **检查日志**
   - 打开DevTools (F12)
   - 查看"Console"标签中的错误信息
   - 查看Service Worker日志

2. **验证设置**
   - 扩展ID是否正确
   - Chrome版本是否 ≥ 127
   - Service Worker是否运行

3. **尝试重置**
   - 禁用再启用扩展
   - 刷新缓存历史页面
   - 清空浏览器缓存

---

**更新日期**: 2024年2月27日  
**版本**: 1.0  
**状态**: ✅ 正常运行

---

## ⭐ 快速参考命令

```bash
# 在Chrome地址栏中直接粘贴以下（替换ID）
chrome-extension://YOUR_EXT_ID/cache-history.html

# DevTools中查询缓存
chrome.runtime.sendMessage({action:'get_cache_stats'},(r)=>console.log(r))

# DevTools中清空缓存
chrome.runtime.sendMessage({action:'clear_cache'},(r)=>console.log(r))
```

保存此卡片便于快速查阅！📌
