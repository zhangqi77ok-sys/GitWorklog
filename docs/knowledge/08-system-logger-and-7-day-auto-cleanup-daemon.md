# 08 - 系统日志诊断追踪系统与 7 天自动清理定时任务设计

> **归档编号**：KNOW-08  
> **关联规范**：`AGENTS.md`【铁律 6】、`AGENTS.md`【铁律 1.5】  
> **核心领域**：日志诊断 / 7天日志留存清理 / 错误捕获与自愈分析

---

## ① 知识点与问题背景 (Context & Problem Statement)

在用户使用应用的过程中，曾因特定配置项空值触发了 `TypeError: Cannot read properties of undefined (reading 'toUpperCase')` 报错。虽然前端已经通过 `<ErrorBoundary>` 错误边界拦截了整页崩溃，但用户无法直观查看历史报错堆栈。

**用户明确需求**：
“系统加上日志功能，并且定时任务只保存七天内的日志，这样就能查看报错是什么情况。”

---

## ② 核心原理与根本原因剖析 (Knowledge Content & Root Cause)

### 1. `toUpperCase()` 空指针崩溃原因
- 在 `SettingsModal.tsx` 动态渲染接入模式时，代码为 `模式: {channelForm.ingress_type.toUpperCase()}`；
- 当 `channelForm.ingress_type` 为 `undefined` 时，调用 `.toUpperCase()` 抛出未捕获 `TypeError`。
- **解决方案**：引入类型安全防御：`(channelForm.ingress_type || 'api_key').toUpperCase()`。

### 2. 全链路日志架构图谱 (Full-Stack Logging Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tcode 全量日志与 7 天留存架构                     │
├───────────────────────────────────┬────────────────────────────────────┤
│ 前端捕获 (Frontend Log Client)    │ 后端日志守护核 (Backend Log Core) │
├───────────────────────────────────┼────────────────────────────────────┤
│ 1. ErrorBoundary 错误边界捕获     │ 1. logger.py 全局日志记录器         │
│ 2. window.onerror 运行时错误      │ 2. 文件存盘: %APPDATA%/Tcode/logs/ │
│ 3. window.onunhandledrejection    │    - tcode_app.log (主日志)         │
│ 4. 发送 POST /api/system/log      │    - tcode_error.log (报错日志)     │
└───────────────────────────────────┴────────────────────────────────────┘
                                     ▲
                                     │  (每日后台守护任务)
                                     ▼
                    ┌──────────────────────────────────┐
                    │ 7 天旧日志自动清理 (Cron / Daemon) │
                    │ - 判断文件 mtime > 7 天则自动删除│
                    │ - 判断日志行 [YYYY-MM-DD < 7天前 │
                    └──────────────────────────────────┘
```

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 后端日志模块与 7 天清理算法 (`logger.py`)

```python
def cleanup_old_logs(max_days: int = 7) -> int:
    """清理 7 天前的历史日志文件与日志超期记录"""
    now = time.time()
    cutoff = now - (max_days * 86400)
    cleaned_files = 0
    
    for fname in os.listdir(LOG_DIR):
        fpath = os.path.join(LOG_DIR, fname)
        if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff:
            os.remove(fpath)
            cleaned_files += 1

    # 截断主日志文件中 7 天前的历史记录
    _rotate_and_truncate_log(MAIN_LOG_PATH, max_days)
    _rotate_and_truncate_log(ERROR_LOG_PATH, max_days)
    return cleaned_files
```

### 2. 后端 24 小时定时任务注册 (`desktop_app.py`)
应用启动时立即执行一次清理，并启动后台 24 小时循环 Timer：

```python
# 应用启动时执行 7 天日志留存清理
logger.cleanup_old_logs(7)

def log_cleanup_scheduler():
    try:
        logger.cleanup_old_logs(7)
    except Exception:
        pass
    t_next = threading.Timer(86400, log_cleanup_scheduler)
    t_next.daemon = True
    t_next.start()

t_sched = threading.Timer(86400, log_cleanup_scheduler)
t_sched.daemon = True
t_sched.start()
```

### 3. 前端可视化日志排错面板 (`SettingsModal.tsx`)
在全局设置中心新增“系统日志与排错”专属 Tab：
- 动态显示包含报错堆栈的格式化控制台输出；
- 提供 `[ 🔄 刷新日志 ]`、`[ 📋 复制全部 ]` 与 `[ 🧹 立即清理 7 天前旧日志 ]`；
- 显示系统保留规则提示：`🛡️ 7天规则已激活 (7-Day Retention Active)`。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **日志文件编码安全**：
   写日志与读日志必须统一指定 `encoding='utf-8', errors='ignore'`，防止 Windows 中文环境下出现 GBK 编码崩溃；
2. **异步非阻塞日志透传**：
   前端在 ErrorBoundary 中异步 `fetch('/api/system/log')` 采用 fire-and-forget 模式，避免网络延迟阻塞 UI 响应；
3. **敏感 Key 自动脱敏规则**：
   在记录网络请求日志时，对包含 `sk-***` 的 Header 或请求体自动做掩码处理，保障凭据安全。
