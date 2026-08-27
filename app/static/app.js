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
async function loadCockpitProviders() {
  try {
    const res = await fetch("/cockpit/providers");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      renderCockpitProviders(json.data);
    }
  } catch (err) {
    console.error("Cockpit load error:", err);
  }
}

function renderCockpitProviders(providers) {
  const list = document.getElementById("provider-status-list");
  if (!list) return;
  list.innerHTML = "";

  for (const [key, p] of Object.entries(providers)) {
    const card = document.createElement("div");
    card.className = "provider-card-item";
    const activeAcc = (p.accounts || []).find(a => a.status === "active") || (p.accounts || [])[0] || {};
    const used = activeAcc.quota_used || 0;
    const total = activeAcc.quota_total || 100;
    const pct = Math.min(100, Math.round((used / total) * 100));

    card.innerHTML = `
      <div class="provider-card-header">
        <span>${p.name}</span>
        <span style="color:#d96b27; font-size:11px;">${activeAcc.name || "Default"}</span>
      </div>
      <div class="quota-bar-wrap">
        <div class="quota-bar-fill" style="width: ${pct}%;"></div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:10px; color:#6b635b;">
        <span>Quota: ${used}/${total} (${pct}%)</span>
        <span>Reset: ${activeAcc.reset_time || "24h"}</span>
      </div>
    `;
    list.appendChild(card);
  }
}

// --------------------------------------------------------------------------
// 弹窗控制
// --------------------------------------------------------------------------
function openCockpitModal() {
  document.getElementById("cockpit-modal").classList.remove("hidden");
  loadCockpitProviders();
}
function closeCockpitModal() {
  document.getElementById("cockpit-modal").classList.add("hidden");
}
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
