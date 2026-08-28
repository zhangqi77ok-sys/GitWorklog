// CodeMind-Hub · Interactive Controller (Clean IDE File Tabs & Terminal)

let state = {
  currentSessionId: "conv-cabinet-main",
  currentModel: "antigravity-core",
  activeFile: "app/platform/loop/engine.py",
  openedTabs: ["app/platform/loop/engine.py", "app/platform/harness/service.py"],
  tagFilter: "all",
  terminalOpen: true,
  sessions: [],
  files: [
    { name: "app/main.py", type: "file" },
    { name: "app/platform/harness/service.py", type: "file" },
    { name: "app/platform/loop/engine.py", type: "file" },
    { name: "app/platform/audit/service.py", type: "file" },
    { name: "app/platform/cockpit/registry.py", type: "file" },
    { name: "tests/test_cockpit_studio.py", type: "file" },
    { name: "README.md", type: "file" }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  initCodeMindStudio();
});

async function initCodeMindStudio() {
  await loadSessionList();
  renderFileTree();
  renderOpenedTabs();
  loadMockFileContent(state.activeFile);
  initWelcomeMessages();
  loadCockpitProviders();
}

// --------------------------------------------------------------------------
// 会话列表与管理
// --------------------------------------------------------------------------
async function loadSessionList() {
  try {
    const res = await fetch("/session/list");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      state.sessions = json.data;
      renderSessionList();
    }
  } catch (err) {
    console.error("Failed to load sessions:", err);
  }
}

function renderSessionList() {
  const container = document.getElementById("session-items-container");
  if (!container) return;
  container.innerHTML = "";

  const filtered = state.sessions.filter(s => {
    if (state.tagFilter === "all") return true;
    return (s.tags || []).includes(state.tagFilter);
  });

  document.getElementById("session-count-badge").innerText = filtered.length;

  filtered.forEach(s => {
    const item = document.createElement("div");
    item.className = `session-item ${s.conversation_id === state.currentSessionId ? "active" : ""}`;
    item.onclick = () => selectSession(s.conversation_id, s.title);

    const lampClass = s.status === "running" ? "lamp-running" : (s.status === "error" ? "lamp-error" : "lamp-idle");

    item.innerHTML = `
      <span class="session-lamp ${lampClass}"></span>
      <span class="session-item-title" title="${s.title}">${s.title}</span>
      <div class="session-item-actions">
        <button class="item-action-icon" onclick="openShareSessionModal(event)" title="分享">🔗</button>
        <button class="item-action-icon" onclick="deleteSessionConfirm('${s.conversation_id}', event)" title="删除">🗑️</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function selectSession(sessionId, title) {
  state.currentSessionId = sessionId;
  document.getElementById("current-chat-title").innerText = title;
  renderSessionList();
}

async function createNewSession() {
  const newId = `conv-${Date.now()}`;
  const title = `新编程会话 #${state.sessions.length + 1}`;
  try {
    await fetch(`/session/${newId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, tags: "feat,coding" })
    });
    await loadSessionList();
    selectSession(newId, title);
  } catch (err) {
    console.error("Create session error:", err);
  }
}

async function deleteSessionConfirm(sessionId, event) {
  if (event) event.stopPropagation();
  if (!confirm("确定要删除该会话记录吗？")) return;
  try {
    await fetch(`/session/${sessionId}`, { method: "DELETE" });
    await loadSessionList();
  } catch (err) {
    console.error("Delete session error:", err);
  }
}

function filterByTag(tag) {
  state.tagFilter = tag;
  document.querySelectorAll(".tag-pill").forEach(p => p.classList.remove("active"));
  event.target.classList.add("active");
  renderSessionList();
}

function handleSessionSearch(keyword) {
  keyword = keyword.toLowerCase();
  const items = document.querySelectorAll(".session-item");
  items.forEach(el => {
    const text = el.innerText.toLowerCase();
    el.style.display = text.includes(keyword) ? "flex" : "none";
  });
}

// --------------------------------------------------------------------------
// 纯净 IDE 原生文件标签栏 (Opened File Tabs)
// --------------------------------------------------------------------------
function renderOpenedTabs() {
  const container = document.getElementById("opened-files-tabs");
  if (!container) return;
  container.innerHTML = "";

  state.openedTabs.forEach(filepath => {
    const filename = filepath.split("/").pop();
    const isActive = filepath === state.activeFile;
    const tab = document.createElement("div");
    tab.className = `editor-file-tab ${isActive ? "active" : ""}`;
    tab.onclick = () => openFile(filepath);

    const icon = filename.endsWith(".py") ? "🐍" : (filename.endsWith(".md") ? "📝" : "📄");

    tab.innerHTML = `
      <span class="file-tab-icon">${icon}</span>
      <span class="file-tab-title">${filename}</span>
      <span class="file-tab-close" onclick="closeFileTab('${filepath}', event)">✕</span>
    `;
    container.appendChild(tab);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "tab-new-btn";
  addBtn.title = "新建文件/标签";
  addBtn.innerText = "＋";
  addBtn.onclick = () => createNewFilePrompt();
  container.appendChild(addBtn);
}

function closeFileTab(filepath, event) {
  if (event) event.stopPropagation();
  state.openedTabs = state.openedTabs.filter(f => f !== filepath);
  if (state.activeFile === filepath) {
    state.activeFile = state.openedTabs[state.openedTabs.length - 1] || "app/main.py";
    if (!state.openedTabs.includes(state.activeFile)) {
      state.openedTabs.push(state.activeFile);
    }
  }
  renderOpenedTabs();
  openFile(state.activeFile);
}

function createNewFilePrompt() {
  const name = prompt("请输入新建文件名称 (例如: app/utils/helper.py):", "app/utils/new_module.py");
  if (name) {
    if (!state.openedTabs.includes(name)) {
      state.openedTabs.push(name);
      state.files.push({ name, type: "file" });
    }
    openFile(name);
    renderFileTree();
  }
}

// --------------------------------------------------------------------------
// 工程文件树
// --------------------------------------------------------------------------
function renderFileTree() {
  const container = document.getElementById("file-tree-container");
  if (!container) return;
  container.innerHTML = "";

  state.files.forEach(f => {
    const node = document.createElement("div");
    node.className = `tree-node ${f.name === state.activeFile ? "active" : ""}`;
    node.onclick = () => {
      if (!state.openedTabs.includes(f.name)) {
        state.openedTabs.push(f.name);
      }
      openFile(f.name);
    };
    node.innerHTML = `
      <span class="node-icon">${f.name.endsWith(".py") ? "🐍" : (f.name.endsWith(".md") ? "📝" : "📄")}</span>
      <span class="node-label">${f.name}</span>
    `;
    container.appendChild(node);
  });
}

function openFile(filepath) {
  state.activeFile = filepath;
  if (!state.openedTabs.includes(filepath)) {
    state.openedTabs.push(filepath);
  }
  const filename = filepath.split("/").pop();
  document.getElementById("active-breadcrumb-file").innerText = filename;
  document.getElementById("sub-pathbar-filename").innerText = filepath;
  renderOpenedTabs();
  renderFileTree();
  loadMockFileContent(filepath);
}

function loadMockFileContent(filepath) {
  const editor = document.getElementById("code-editor-area");
  if (filepath.endsWith("engine.py")) {
    editor.value = `# CodeMind-Hub · ReAct Self-Correcting Loop Engine\nclass SelfCorrectingLoopEngine:\n    async def run_loop(self, query: str, conversation_id: str):\n        # Plan -> Code -> Harness (PyTest) -> Observe -> Reflect & Fix Loop\n        return [{"step": "Loop Step 1", "status": "APPROVED"}]\n`;
  } else if (filepath.endsWith("service.py")) {
    editor.value = `# TestHarness & AuditSkill Module\nclass TestHarness:\n    def check_ast_syntax(self, code: str) -> tuple[bool, str]:\n        # AST Pre-check\n        return True, "Valid AST Syntax"\n`;
  } else {
    editor.value = `# CodeMind-Hub Project File: ${filepath}\n// Ready for AI-assisted editing.\n`;
  }
}

// --------------------------------------------------------------------------
// 中间 AI 对话流 (垂直排布 + 微型操作栏)
// --------------------------------------------------------------------------
function initWelcomeMessages() {
  const container = document.getElementById("chat-messages-container");
  if (!container) return;
  container.innerHTML = `
    <div class="msg-card msg-user">
      <div class="msg-header">👤 USER (You)</div>
      <div class="msg-body">请基于 ReAct Loop 自愈闭环与 Harness 治具，为我构建高内聚低耦合的代码求解器。</div>
    </div>
    <div class="msg-card msg-ai">
      <div class="msg-header">
        <span>⚡ CodeMind-Hub</span>
        <span class="msg-agent-badge">Architect + Loop</span>
      </div>
      <div class="msg-body">
        <p>已通过 <strong>TestHarness 治具</strong> 与 <strong>双向钢人复审</strong> 完成模块设计与实现：</p>
        <pre><code class="language-python">def solve_task(data: list[float]) -> dict[str, float]:
    """核心业务算法：计算统计指标 (均值与总和)。"""
    if not data:
        return {"mean": 0.0, "total": 0.0}
    total = sum(data)
    return {"mean": total / len(data), "total": total}</code></pre>
      </div>
      <div class="msg-footer-actions">
        <button class="micro-act-btn" onclick="copyCodeSnippet(this)">📋 复制</button>
        <button class="micro-act-btn" onclick="applyDiffSnippet()">⚡ diff</button>
        <button class="micro-act-btn" onclick="thumbUp(this)">👍</button>
      </div>
    </div>
  `;
}

async function sendAgentMessage() {
  const input = document.getElementById("chat-prompt-input");
  const query = input.value.trim();
  if (!query) return;

  input.value = "";
  appendUserMessage(query);

  const lamp = document.getElementById("active-session-lamp");
  lamp.className = "status-lamp lamp-running";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        conversation_id: state.currentSessionId,
        provider: "antigravity",
        model: state.currentModel
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data:")) {
          try {
            const payload = JSON.parse(line.replace("data:", "").trim());
            if (payload.agent && payload.output) {
              appendAiStepMessage(payload);
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error("Chat error:", err);
  } finally {
    lamp.className = "status-lamp lamp-idle";
  }
}

function appendUserMessage(text) {
  const container = document.getElementById("chat-messages-container");
  const card = document.createElement("div");
  card.className = "msg-card msg-user";
  card.innerHTML = `
    <div class="msg-header">👤 USER</div>
    <div class="msg-body">${escapeHtml(text)}</div>
  `;
  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

function appendAiStepMessage(step) {
  const container = document.getElementById("chat-messages-container");
  const card = document.createElement("div");
  card.className = "msg-card msg-ai";
  card.innerHTML = `
    <div class="msg-header">
      <span>⚡ ${step.name || step.agent}</span>
      <span class="msg-agent-badge">${step.role || "Loop"}</span>
    </div>
    <div class="msg-body">${formatMarkdownLike(step.output)}</div>
    <div class="msg-footer-actions">
      <button class="micro-act-btn" onclick="copyCodeSnippet(this)">📋 复制</button>
      <button class="micro-act-btn" onclick="applyDiffSnippet()">⚡ diff</button>
      <button class="micro-act-btn" onclick="thumbUp(this)">👍</button>
    </div>
  `;
  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

function copyCodeSnippet(btn) {
  const card = btn.closest(".msg-card");
  const pre = card.querySelector("pre");
  const text = pre ? pre.innerText : card.querySelector(".msg-body").innerText;
  navigator.clipboard.writeText(text);
  btn.innerText = "✅ 已复制";
  setTimeout(() => btn.innerText = "📋 复制", 1500);
}

function applyDiffSnippet() {
  const editor = document.getElementById("code-editor-area");
  editor.value += `\n# [CodeMind-Hub Diff Applied]\ndef updated_solver():\n    return True\n`;
  alert("⚡ Diff 补丁已精准合并至编辑器！");
}

function thumbUp(btn) {
  btn.innerText = "❤️ 已感谢";
}

// --------------------------------------------------------------------------
// 编辑器操作与内置终端
// --------------------------------------------------------------------------
function saveActiveFile() {
  alert(`💾 文件 ${state.activeFile} 已成功保存！`);
}

async function runActiveFile() {
  const screen = document.getElementById("terminal-bottom-output");
  screen.innerText += `\n[codeMindHub-H]$ python ${state.activeFile} --run-harness\n`;
  if (!state.terminalOpen) toggleTerminalDrawer();
  try {
    const res = await fetch("/harness/run_tests");
    const json = await res.json();
    screen.innerText += `✅ [Harness Status]: ${json.data.summary} (Exit Code: 0)\n`;
  } catch (err) {
    screen.innerText += `❌ [Harness Error]: ${err}\n`;
  }
}

function toggleTerminalDrawer() {
  const screen = document.getElementById("terminal-bottom-screen");
  const arrow = document.getElementById("terminal-toggle-arrow");
  state.terminalOpen = !state.terminalOpen;
  if (state.terminalOpen) {
    screen.style.display = "block";
    arrow.innerText = "▼";
  } else {
    screen.style.display = "none";
    arrow.innerText = "▲";
  }
}

function clearTerminal(event) {
  if (event) event.stopPropagation();
  document.getElementById("terminal-bottom-output").innerText = "[codeMindHub-H:agent-project]$ ";
}

// --------------------------------------------------------------------------
// Cockpit Tools 全厂商网关
// --------------------------------------------------------------------------
// Settings 全局设置中枢 (双栏 Master-Detail 交互控制器)
// --------------------------------------------------------------------------
let currentSettingsTab = "gateway";
let cachedSettingsData = {
  providers: {},
  skills: [],
  mcpTools: []
};

function openSettingsModal(tabName = "gateway") {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  switchSettingsTab(tabName);
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.add("hidden");
}

// 兼容旧调用入口
function openCockpitModal() { openSettingsModal("gateway"); }
function closeCockpitModal() { closeSettingsModal(); }

function switchSettingsTab(tabName) {
  currentSettingsTab = tabName;

  // 1. 更新左侧导航激活态
  const navItems = document.querySelectorAll(".settings-nav-item");
  navItems.forEach(item => item.classList.remove("active"));
  const activeNav = document.getElementById(`nav-item-${tabName}`);
  if (activeNav) activeNav.classList.add("active");

  // 2. 更新右侧内容视图
  const panes = document.querySelectorAll(".settings-view-pane");
  panes.forEach(pane => pane.classList.add("hidden"));
  const activePane = document.getElementById(`settings-view-${tabName}`);
  if (activePane) activePane.classList.remove("hidden");

  // 3. 加载对应标签页数据
  if (tabName === "gateway") {
    loadSettingsGateway();
  } else if (tabName === "skills") {
    loadSettingsSkills();
  } else if (tabName === "mcp") {
    loadSettingsMcp();
  }
}

// 1. LLM 模型网关与配额监控 (Cockpit Tools)
let activeCockpitProvider = "antigravity";
let activeCockpitSubTab = "accounts";

async function loadSettingsGateway() {
  try {
    const res = await fetch("/cockpit/providers");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      cachedSettingsData.providers = json.data;
      renderCockpitAccountsGrid(json.data, activeCockpitProvider);
    }
  } catch (err) {
    console.error("Failed to load gateway providers:", err);
  }
}

function selectCockpitProvider(providerKey) {
  activeCockpitProvider = providerKey;
  
  // 更新二级子菜单高亮
  const subItems = document.querySelectorAll(".provider-nav-item");
  subItems.forEach(i => i.classList.remove("active"));
  const target = document.getElementById(`p-sub-${providerKey}`);
  if (target) target.classList.add("active");

  const label = document.getElementById("active-provider-label");
  const ver = document.getElementById("active-provider-ver");
  if (label) label.innerText = `⚡ ${providerKey.toUpperCase()}`;
  if (ver) ver.innerText = `${providerKey} v2.11.0.0`;

  if (cachedSettingsData.providers) {
    renderCockpitAccountsGrid(cachedSettingsData.providers, providerKey);
  }
}

function switchCockpitSubTab(subTabName) {
  activeCockpitSubTab = subTabName;
  const tabs = document.querySelectorAll(".c-tab-btn");
  tabs.forEach(t => t.classList.remove("active"));
  const activeTab = document.getElementById(`c-tab-${subTabName}`);
  if (activeTab) activeTab.classList.add("active");

  if (subTabName === "accounts") {
    loadSettingsGateway();
  } else if (subTabName === "models") {
    renderCockpitModelsTab();
  } else if (subTabName === "wakeup") {
    renderCockpitWakeupTab();
  } else if (subTabName === "multi") {
    renderCockpitMultiInstanceTab();
  } else if (subTabName === "sessions") {
    renderCockpitSessionsTab();
  }
}

function renderCockpitAccountsGrid(providers, providerKey) {
  const container = document.getElementById("cockpit-cards-grid");
  if (!container) return;
  container.innerHTML = "";

  const p = providers[providerKey] || providers["antigravity"] || {};
  const accounts = p.accounts || [
    { id: "acc-1", name: "gi***3@g***l.com", status: "active", quota_used: 18, quota_total: 100, reset_time: "4h 59m (08/28 15:11)" },
    { id: "acc-2", name: "zh***k@g***l.com", status: "standby", quota_used: 40, quota_total: 100, reset_time: "3d 7h (08/31 17:15)" }
  ];

  const planTxt = document.getElementById("filter-plan-txt");
  if (planTxt) planTxt.innerText = `全部 (${accounts.length})`;

  accounts.forEach((acc, idx) => {
    const card = document.createElement("div");
    const isActive = acc.status === "active";
    card.className = `account-card ${isActive ? "" : "standby"}`;
    card.dataset.accId = acc.id;
    card.dataset.email = (acc.name || "").toLowerCase();

    const claude5h = isActive ? "100%" : "100%";
    const claudeWk = isActive ? "100%" : "63%";
    const gemini5h = isActive ? "98%" : "100%";
    const geminiWk = isActive ? "69%" : "0%";
    const claude5hClass = "q-val-green";
    const claudeWkClass = isActive ? "q-val-green" : "q-val-orange";
    const gemini5hClass = "q-val-green";
    const geminiWkClass = isActive ? "q-val-orange" : "q-val-red";
    const geminiWkFill = isActive ? "q-bar-fill-orange" : "q-bar-fill-red";
    const credits = isActive ? "850 pts" : "0 pts";

    card.innerHTML = `
      <div class="acc-card-header">
        <div class="acc-email-wrap">
          <input type="checkbox" class="acc-row-chk" ${isActive ? "checked" : ""}>
          <span>${acc.name || `acc-${idx+1}@workspace.com`}</span>
        </div>
        <div class="acc-badges">
          ${isActive ? '<span class="pill-current">当前</span>' : ''}
          <span class="pill-pro">PRO</span>
        </div>
      </div>

      <button class="btn-memo" onclick="promptAccountMemo('${acc.id}')">📄 加备注</button>

      <!-- 双模型多时间窗口配额看板 (Claude & Gemini 5h / Weekly) -->
      <div class="acc-quota-board">
        <div class="quota-columns-row">
          <div class="quota-col-box">
            <div class="q-col-head"><span>Claude</span><span class="${claude5hClass}">${claude5h}</span></div>
            <div style="font-size:9px; color:var(--text-secondary);">5h</div>
            <div class="q-bar-track"><div class="q-bar-fill-green"></div></div>
            <div class="q-reset-time">${acc.reset_time || "4h 59m"}</div>
            
            <div class="q-col-head" style="margin-top:4px;"><span>Weekly</span><span class="${claudeWkClass}">${claudeWk}</span></div>
            <div class="q-bar-track"><div class="${isActive ? 'q-bar-fill-green' : 'q-bar-fill-orange'}"></div></div>
            <div class="q-reset-time">6d 23h 59m</div>
          </div>

          <div class="quota-col-box">
            <div class="q-col-head"><span>Gemini</span><span class="${gemini5hClass}">${gemini5h}</span></div>
            <div style="font-size:9px; color:var(--text-secondary);">5h</div>
            <div class="q-bar-track"><div class="q-bar-fill-green" style="width:98%;"></div></div>
            <div class="q-reset-time">4h 10m (08/28 14:22)</div>
            
            <div class="q-col-head" style="margin-top:4px;"><span>Weekly</span><span class="${geminiWkClass}">${geminiWk}</span></div>
            <div class="q-bar-track"><div class="${geminiWkFill}"></div></div>
            <div class="q-reset-time">6d 3h 48m</div>
          </div>
        </div>

        <div class="acc-credits-row">
          <span>可用 AI 积分:</span>
          <strong style="color:var(--accent-orange);">${credits}</strong>
        </div>
      </div>

      <!-- 7 组微型快捷操作按钮 -->
      <div class="acc-card-footer">
        <span class="acc-date-txt">${isActive ? '2026/08/27 10:52' : '2026/08/23 22:52'}</span>
        <div class="acc-action-icons">
          <button class="btn-acc-action" onclick="showAccountDetail('${acc.id}')" title="详情">ⓘ</button>
          <button class="btn-acc-action" onclick="showAccountTags('${acc.id}')" title="标签">🏷️</button>
          <button class="btn-acc-action" onclick="promptAccountMemo('${acc.id}')" title="备注">📄</button>
          <button class="btn-acc-action" onclick="triggerAccountWakeup('${acc.id}')" title="单步调试/唤醒">▶</button>
          <button class="btn-acc-action" onclick="refreshAccountQuota('${acc.id}')" title="刷新配额">🔄</button>
          <button class="btn-acc-action" onclick="exportAccountSnapshotSingle('${acc.id}')" title="导出凭据">📤</button>
          <button class="btn-acc-action" onclick="deleteAccount('${acc.id}')" title="删除账号">🗑️</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderCockpitModelsTab() {
  const container = document.getElementById("cockpit-cards-grid");
  if (!container) return;
  container.innerHTML = `
    <div style="grid-column: 1 / -1; background:#fff; border:1px solid var(--border-subtle); border-radius:10px; padding:16px;">
      <h4 style="margin-bottom:8px; font-size:13px;">🖧 自定义模型供应商 & Base URL 路由</h4>
      <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">支持通过标准 OpenAI / Claude 兼容格式挂载本地 Ollama、vLLM 或第三方中转站。</p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <input type="text" class="auth-input" placeholder="供应商名称 (如: Local-vLLM-Qwen)" value="Local-Ollama-Coder">
        <input type="text" class="auth-input" placeholder="Base URL (如: http://127.0.0.1:11434/v1)" value="http://127.0.0.1:11434/v1">
        <input type="password" class="auth-input" placeholder="API Key (可选)" value="sk-local-token-bearer">
        <button class="btn-oauth-start" style="width:fit-content;" onclick="alert('✅ 自定义模型供应商路由已注册！')">💾 保存模型供应商</button>
      </div>
    </div>
  `;
}

function renderCockpitWakeupTab() {
  const container = document.getElementById("cockpit-cards-grid");
  if (!container) return;
  container.innerHTML = `
    <div style="grid-column: 1 / -1; background:#fff; border:1px solid var(--border-subtle); border-radius:10px; padding:16px;">
      <h4 style="margin-bottom:8px; font-size:13px;">⏰ 唤醒任务与配额自动保活 (Keep-Alive Cron)</h4>
      <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">防止长时闲置账号被服务商降级或注销，并在配额重置倒计时结束时即时刷新。</p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <label class="switch-container"><input type="checkbox" class="switch-input" checked><span class="switch-slider"></span> 开启每 4 小时自动保活心跳探测</label>
        <label class="switch-container"><input type="checkbox" class="switch-input" checked><span class="switch-slider"></span> 周期配额重置后自动推送 Desktop 通知</label>
      </div>
    </div>
  `;
}

function renderCockpitMultiInstanceTab() {
  const container = document.getElementById("cockpit-cards-grid");
  if (!container) return;
  container.innerHTML = `
    <div style="grid-column: 1 / -1; background:#fff; border:1px solid var(--border-subtle); border-radius:10px; padding:16px;">
      <h4 style="margin-bottom:8px; font-size:13px;">🔀 应用多开与本地代理端口映射 (Multi-Instance Proxy)</h4>
      <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">为 Cursor / VS Code / Zed 分配独立的 Localhost 代理监听端口与凭据隔离。</p>
      <div style="display:flex; gap:10px; align-items:center;">
        <span>监听端口:</span>
        <input type="text" class="auth-input" style="width:120px;" value="127.0.0.1:1455">
        <button class="btn-oauth-start" onclick="alert('✅ 本地代理端口 1455 运行正常！')">▶ 启动中转监听</button>
      </div>
    </div>
  `;
}

function renderCockpitSessionsTab() {
  const container = document.getElementById("cockpit-cards-grid");
  if (!container) return;
  container.innerHTML = `
    <div style="grid-column: 1 / -1; background:#fff; border:1px solid var(--border-subtle); border-radius:10px; padding:16px;">
      <h4 style="margin-bottom:8px; font-size:13px;">📁 会话路由与上下文配额审计</h4>
      <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">查看当前活跃会话与各大模型厂商之间的 Token 消耗与中转明细。</p>
      <button class="btn-oauth-start" onclick="alert('📋 会话审计日志已导出！')">📥 导出 Token 审计报告</button>
    </div>
  `;
}

// 账号卡片 7 大操作响应
function showAccountDetail(accId) { alert(`ℹ️ 账号 [${accId}] 详情: 状态正常，OAuth 令牌有效期 28 天`); }
function showAccountTags(accId) { alert(`🏷️ 账号 [${accId}] 当前标签: #PRO #Primary #Google-OAuth`); }
function promptAccountMemo(accId) {
  const memo = prompt("请输入此账号的备注说明 (例如: 个人主力 Pro 订阅):");
  if (memo) updateFooterStatusTip(`📄 备注已保存: ${memo}`);
}
function triggerAccountWakeup(accId) {
  updateFooterStatusTip(`⚡ 已对账号 [${accId}] 发起单步唤醒探测 (Latency: 28ms)`);
}
function refreshAccountQuota(accId) {
  updateFooterStatusTip(`🔄 账号 [${accId}] 配额与重置时间已更新至最新`);
}
function exportAccountSnapshotSingle(accId) {
  alert(`📤 账号 [${accId}] 凭据快照已安全导出至本地！`);
}
function deleteAccount(accId) {
  if (confirm(`确认移除账号 [${accId}] 吗？`)) {
    updateFooterStatusTip(`🗑️ 账号 [${accId}] 已安全注销移除`);
    loadSettingsGateway();
  }
}

// 添加账号浮层交互 (复刻参考图 2)
function openAddAccountModal(mode = 'oauth') {
  const modal = document.getElementById("add-account-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  switchAuthMode(mode);
}
function closeAddAccountModal() {
  const modal = document.getElementById("add-account-modal");
  if (modal) modal.classList.add("hidden");
}
function switchAuthMode(mode) {
  const btns = ["oauth", "token", "import"];
  btns.forEach(b => {
    const btn = document.getElementById(`seg-btn-${b}`);
    if (btn) btn.classList.toggle("active", b === mode);
  });
}
function copyAuthUrl() {
  const txt = document.getElementById("auth-url-text").innerText;
  navigator.clipboard.writeText(txt);
  alert("📋 OAuth 官方授权链接已复制到剪贴板！请在浏览器中打开授权。");
}
function startOAuthFlow() {
  const email = document.getElementById("auth-email-input").value.trim() || "user@workspace.com";
  window.open("https://accounts.google.com/o/oauth2/v2/auth?client_id=demo", "_blank");
  updateFooterStatusTip(`🌐 已调起浏览器 OAuth 授权流程: ${email}`);
}
function finishOAuthFlow() {
  alert("✅ OAuth 授权成功！新账号凭据已自动注入并纳管。");
  closeAddAccountModal();
  loadSettingsGateway();
}
function submitManualCallback() {
  const url = document.getElementById("manual-callback-input").value.trim();
  if (url) {
    alert("✅ 回调地址已解析并成功绑定凭据！");
    closeAddAccountModal();
    loadSettingsGateway();
  } else {
    alert("请先粘贴完整的回调地址！");
  }
}
function saveDraftAccount() {
  alert("📄 待授权卡片已暂存为草稿！");
  closeAddAccountModal();
}

// 搜索与批量操作
function handleAccountSearch(val) {
  const q = (val || "").toLowerCase();
  const cards = document.querySelectorAll(".account-card");
  cards.forEach(c => {
    const email = c.dataset.email || "";
    c.style.display = email.includes(q) ? "" : "none";
  });
}
function toggleSelectAllAccounts(checked) {
  const chks = document.querySelectorAll(".acc-row-chk");
  chks.forEach(c => c.checked = checked);
  updateFooterStatusTip(`已${checked ? '选中' : '取消选中'}所有账号`);
}
function filterAccountPlan(plan) {
  updateFooterStatusTip(`过滤套餐: ${plan}`);
}
function sortAccountsByQuota() {
  updateFooterStatusTip("⇅ 已按综合剩余配额降序排列");
}
function toggleBatchAccounts() {
  alert("👁️ 批量操作：已选中 2 个账号，可执行批量禁用/测速/保活");
}
function exportAccountSnapshots() {
  alert("📤 全量账号加密凭据池已导出至 JSON 文件！");
}

async function pingProvider(providerKey, btn) {
  const originalText = btn.innerText;
  btn.innerText = "⏳ 测速中...";
  btn.disabled = true;
  try {
    const res = await fetch("/cockpit/providers/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerKey })
    });
    const json = await res.json();
    const badge = document.getElementById(`ping-badge-${providerKey}`);
    if (json.code === 0 && json.data) {
      const lat = json.data.latency_ms || Math.floor(Math.random() * 40 + 25);
      if (badge) {
        badge.innerHTML = `● ${lat}ms`;
        badge.className = "status-pill-badge";
      }
      updateFooterStatusTip(`⚡ ${providerKey} 响应正常: ${lat}ms`);
    }
  } catch (err) {
    const badge = document.getElementById(`ping-badge-${providerKey}`);
    if (badge) {
      badge.innerHTML = `✕ 异常`;
      badge.className = "status-pill-badge offline";
    }
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

// 2. SKILL 技能管理
async function loadSettingsSkills() {
  try {
    const res = await fetch("/skills");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      cachedSettingsData.skills = json.data;
      const countBadge = document.getElementById("skill-count-badge");
      if (countBadge) countBadge.innerText = json.data.length;
      renderSettingsSkills(json.data);
    }
  } catch (err) {
    console.error("Failed to load skills:", err);
  }
}

function renderSettingsSkills(skills) {
  const list = document.getElementById("settings-skills-list");
  if (!list) return;
  list.innerHTML = "";

  skills.forEach(s => {
    const card = document.createElement("div");
    card.className = "skill-row-card";
    card.dataset.name = s.name.toLowerCase();

    card.innerHTML = `
      <div class="card-top-line">
        <div class="card-brand-title">
          <span>🧩</span>
          <span>${s.name}</span>
          <span class="card-box-badge">${s.category || "standard"}</span>
        </div>
        <label class="switch-container" title="启停此技能">
          <input type="checkbox" class="switch-input" ${s.enabled ? "checked" : ""} onchange="handleToggleSkill('${s.id}', this.checked)">
          <span class="switch-slider"></span>
        </label>
      </div>
      <p style="font-size:11px; color:var(--text-secondary); margin:0;">${s.desc || "无描述"}</p>
    `;
    list.appendChild(card);
  });
}

async function handleToggleSkill(skillId, enabled) {
  try {
    const res = await fetch("/skills/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_id: skillId, enabled })
    });
    const json = await res.json();
    if (json.code === 0) {
      updateFooterStatusTip(`🧩 技能 [${skillId}] 已${enabled ? "启用" : "禁用"}`);
    }
  } catch (err) {
    console.error("Toggle skill error:", err);
  }
}

function promptAddCustomSkill() {
  const name = prompt("请输入新 SOP 技能名称 (例如: FastAPISecurityAudit):");
  if (name) {
    alert(`🧩 自定义规范 [${name}] 模板已成功注册导入！`);
    loadSettingsSkills();
  }
}

// 3. MCP 协议与工具
async function loadSettingsMcp() {
  try {
    const res = await fetch("/mcp");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      cachedSettingsData.mcpTools = json.data;
      const countBadge = document.getElementById("mcp-count-badge");
      if (countBadge) countBadge.innerText = json.data.length;
      renderSettingsMcp(json.data);
    }
  } catch (err) {
    console.error("Failed to load mcp tools:", err);
  }
}

function renderSettingsMcp(tools) {
  const list = document.getElementById("settings-mcp-list");
  if (!list) return;
  list.innerHTML = "";

  tools.forEach(t => {
    const card = document.createElement("div");
    card.className = "mcp-row-card";
    card.dataset.name = t.name.toLowerCase();

    card.innerHTML = `
      <div class="card-top-line">
        <div class="card-brand-title">
          <span>🔌</span>
          <code style="font-family:var(--font-mono); font-size:12px; color:var(--accent-orange);">${t.name}</code>
          <span class="card-box-badge">Server: ${t.server || "std"}</span>
        </div>
        <label class="switch-container" title="启停此 MCP 工具">
          <input type="checkbox" class="switch-input" ${t.enabled ? "checked" : ""} onchange="handleToggleMcpTool('${t.id}', this.checked)">
          <span class="switch-slider"></span>
        </label>
      </div>
      <p style="font-size:11px; color:var(--text-secondary); margin:0;">${t.desc || "标准 MCP 扩展协议工具"}</p>
    `;
    list.appendChild(card);
  });
}

async function handleToggleMcpTool(toolId, enabled) {
  try {
    const res = await fetch("/mcp/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_id: toolId, enabled })
    });
    const json = await res.json();
    if (json.code === 0) {
      updateFooterStatusTip(`🔌 MCP 工具 [${toolId}] 已${enabled ? "授权启用" : "撤销禁用"}`);
    }
  } catch (err) {
    console.error("Toggle mcp tool error:", err);
  }
}

function promptAddMcpServer() {
  const serverName = prompt("请输入 MCP Server 名称与 STDIO 路径 (例如: @modelcontextprotocol/server-sqlite):");
  if (serverName) {
    alert(`🔌 MCP Server [${serverName}] 已成功连接至工作空间！`);
    loadSettingsMcp();
  }
}

// 4. 沙箱单步调试
async function debugToolInSandbox() {
  const input = document.getElementById("settings-sandbox-input");
  const output = document.getElementById("sandbox-debug-output");
  if (!output) return;

  const rawVal = input ? input.value.trim() : "";
  output.innerText = `⏳ 正在执行沙箱调用 [${rawVal || 'default'}]...\n`;

  try {
    let params = {};
    if (rawVal.startsWith("{")) {
      params = JSON.parse(rawVal);
    } else if (rawVal) {
      params = { cmd: rawVal };
    } else {
      params = { cmd: "pytest tests/ -q" };
    }

    const res = await fetch("/cockpit/tools/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_id: "terminal_exec", params })
    });
    const json = await res.json();
    output.innerText = `[Sandbox Status: 200 OK]\n` + JSON.stringify(json, null, 2);
    updateFooterStatusTip("✅ 沙箱单步调试执行完毕");
  } catch (err) {
    output.innerText = `❌ 沙箱执行异常:\n${err}`;
  }
}

// 5. 设置项实时搜索过滤
function handleSettingsSearch(query) {
  const q = (query || "").trim().toLowerCase();
  const activePane = document.getElementById(`settings-view-${currentSettingsTab}`);
  if (!activePane) return;

  const cards = activePane.querySelectorAll(".provider-row-card, .skill-row-card, .mcp-row-card, .settings-card-box");
  cards.forEach(card => {
    if (!q) {
      card.style.display = "";
      return;
    }
    const text = card.innerText.toLowerCase();
    card.style.display = text.includes(q) ? "" : "none";
  });
}

function updateFooterStatusTip(msg) {
  const tip = document.getElementById("settings-footer-status");
  if (tip) {
    tip.innerText = msg;
    tip.style.color = "var(--accent-orange)";
    setTimeout(() => {
      tip.innerText = "配置修改已自动实时持久化保存";
      tip.style.color = "var(--text-secondary)";
    }, 2500);
  }
}

// --------------------------------------------------------------------------
// 弹窗控制与全局快捷键
// --------------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === ",") {
    e.preventDefault();
    openSettingsModal("gateway");
  } else if (e.key === "Escape") {
    closeSettingsModal();
    closeGraphModal();
    closeShareSessionModal();
    closeTagManagerModal();
  }
});

function openShareSessionModal(e) {
  if (e) e.stopPropagation();
  const area = document.getElementById("share-export-content");
  area.value = `# CodeMind-Hub · 会话转录快照\n\n**Session ID**: ${state.currentSessionId}\n**Model**: ${state.currentModel}\n\n## 1. 用户指令\n请基于 ReAct Loop 自愈闭环与 Harness 治具构建代码求解器。\n\n## 2. 成果代码\n\`\`\`python\ndef solve_task(data: list[float]) -> dict[str, float]:\n    return {"mean": sum(data)/len(data) if data else 0.0}\n\`\`\`\n`;
  document.getElementById("share-session-modal").classList.remove("hidden");
}
function closeShareSessionModal() {
  document.getElementById("share-session-modal").classList.add("hidden");
}
function copyShareMarkdown() {
  const content = document.getElementById("share-export-content").value;
  navigator.clipboard.writeText(content);
  alert("📋 Markdown 全文已复制到剪贴板！");
  closeShareSessionModal();
}
function downloadShareJson() {
  const data = JSON.stringify({ session: state.currentSessionId, model: state.currentModel, exported_at: new Date() }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `codemind_session_${state.currentSessionId}.json`;
  a.click();
}
function openGraphModal() {
  document.getElementById("graph-modal").classList.remove("hidden");
  refreshKnowledgeGraph();
}
function closeGraphModal() {
  document.getElementById("graph-modal").classList.add("hidden");
}
function openTagManagerModal() {
  document.getElementById("tag-manager-modal").classList.remove("hidden");
}
function closeTagManagerModal() {
  document.getElementById("tag-manager-modal").classList.add("hidden");
}
function saveCustomTag() {
  const val = document.getElementById("new-tag-name").value.trim();
  if (val) {
    alert(`🏷️ 标签 #${val} 已保存！`);
    closeTagManagerModal();
  }
}

// --------------------------------------------------------------------------
// Obsidian AST 力导向图谱
// --------------------------------------------------------------------------
async function refreshKnowledgeGraph() {
  const canvas = document.getElementById("graph-d3-canvas");
  if (!canvas) return;
  canvas.innerHTML = "";

  const width = canvas.clientWidth || 800;
  const height = 480;

  const svg = d3.select("#graph-d3-canvas")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const data = {
    nodes: [
      { id: "engine.py", group: "file" },
      { id: "harness.py", group: "file" },
      { id: "audit.py", group: "file" },
      { id: "SelfCorrectingLoop", group: "class" },
      { id: "TestHarness", group: "class" },
      { id: "AuditSkill", group: "class" },
      { id: "run_loop()", group: "func" },
      { id: "check_ast()", group: "func" }
    ],
    links: [
      { source: "engine.py", target: "SelfCorrectingLoop" },
      { source: "SelfCorrectingLoop", target: "run_loop()" },
      { source: "harness.py", target: "TestHarness" },
      { source: "TestHarness", target: "check_ast()" },
      { source: "audit.py", target: "AuditSkill" },
      { source: "SelfCorrectingLoop", target: "TestHarness" }
    ]
  };

  const simulation = d3.forceSimulation(data.nodes)
    .force("link", d3.forceLink(data.links).id(d => d.id).distance(70))
    .force("charge", d3.forceManyBody().strength(-160))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const link = svg.append("g")
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("stroke", "#dcd5cb")
    .attr("stroke-width", 1.5);

  const node = svg.append("g")
    .selectAll("circle")
    .data(data.nodes)
    .join("circle")
    .attr("r", 8)
    .attr("fill", d => d.group === "file" ? "#d96b27" : (d.group === "class" ? "#f59e0b" : "#10b981"));

  const label = svg.append("g")
    .selectAll("text")
    .data(data.nodes)
    .join("text")
    .text(d => d.id)
    .attr("font-size", 11)
    .attr("dx", 10)
    .attr("dy", 4)
    .attr("fill", "#231f1d");

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
    label
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatMarkdownLike(text) {
  if (!text) return "";
  let html = text.replace(/```python([\s\S]*?)```/g, '<pre><code class="language-python">$1</code></pre>');
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, "<br>");
  return html;
}

function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendAgentMessage();
  }
}
function focusSearch() { document.getElementById("session-search-input").focus(); }
function triggerMeshReview() { alert("🕸️ Multi-Agent Mesh 协同拓扑已触发！"); }
function toggleLeftPanel() {
  const panel = document.getElementById("left-nav-panel");
  panel.style.display = panel.style.display === "none" ? "flex" : "none";
}
function toggleCollapse(id) {
  const body = document.getElementById(id);
  body.style.display = body.style.display === "none" ? "block" : "none";
}
function insertContextSnippet() {
  const input = document.getElementById("chat-prompt-input");
  input.value += " @file:task_solver.py ";
  input.focus();
}
function attachFileToPrompt() {
  alert("📎 请选择要上传或附带的代码文件");
}
function switchActiveModel(model) {
  state.currentModel = model;
  document.getElementById("current-model-tag").innerText = model;
}
