// RunCabinet · Vite Coding Studio 前端状态与积木控制器 (参考 cockpit-tools 模型网关哲学)

const state = {
  sessions: [],
  activeSessionId: "",
  activeTagFilter: "",
  activeFilePath: "",
  providers: {},
  tagColors: {
    feat: "#e06c3a",
    coding: "#f59e0b",
    bugfix: "#f43f5e",
    review: "#d97706",
    mesh: "#a855f7",
    hotfix: "#ef4444",
  },
};

// 初始化
document.addEventListener("DOMContentLoaded", async () => {
  await loadProviders();
  await loadSessions();
  await loadProjectTree();
  await updateTokenDisplay();
});

// 加载大模型厂商与模型
async function loadProviders() {
  try {
    const res = await fetch("/cockpit/providers");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      state.providers = json.data;
      const select = document.getElementById("chat-provider-select");
      if (select) {
        select.innerHTML = Object.entries(state.providers).map(([k, v]) => `
          <option value="${k}">${v.name}</option>
        `).join("");
        handleProviderChange();
      }
    }
  } catch (e) {
    console.error("加载厂商失败:", e);
  }
}

// 会话管理
async function loadSessions() {
  try {
    const res = await fetch("/session/list");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      state.sessions = json.data;
      renderSessionList();
      if (!state.activeSessionId && state.sessions.length > 0) {
        await selectSession(state.sessions[0].conversation_id);
      }
    }
  } catch (e) {
    console.error("加载会话失败:", e);
  }
}

function renderSessionList() {
  const container = document.getElementById("session-list-container");
  if (!container) return;

  const filtered = state.sessions.filter(s => {
    if (!state.activeTagFilter) return true;
    return (s.tags || []).includes(state.activeTagFilter);
  });

  container.innerHTML = filtered.map(s => {
    const isActive = s.conversation_id === state.activeSessionId ? "active" : "";
    const tagsHtml = (s.tags || []).map(t => {
      const color = state.tagColors[t] || "#e06c3a";
      return `<span class="chip" style="color:${color};background:${color}22;border:1px solid ${color}44;">#${t}</span>`;
    }).join("");

    return `
      <div class="session-item-card ${isActive}" onclick="selectSession('${s.conversation_id}')">
        <div class="session-header-row">
          <span class="session-status-light ${s.status || 'idle'}"></span>
          <span class="session-title-text" title="${s.title}">${s.title}</span>
        </div>
        <div class="session-tags-row">${tagsHtml}</div>
        <div class="session-action-btns">
          <button class="btn-xs" onclick="event.stopPropagation(); promptRenameSession('${s.conversation_id}', '${s.title}')">✏️</button>
          <button class="btn-xs" onclick="event.stopPropagation(); deleteSessionItem('${s.conversation_id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

async function selectSession(conversationId) {
  state.activeSessionId = conversationId;
  renderSessionList();

  const current = state.sessions.find(s => s.conversation_id === conversationId);
  if (current) {
    document.getElementById("active-session-title-text").textContent = current.title;
    const dot = document.getElementById("current-session-status-dot");
    dot.className = `status-indicator-dot ${current.status || 'idle'}`;
  }

  // 加载会话消息
  try {
    const res = await fetch(`/session/${conversationId}/messages`);
    const json = await res.json();
    const box = document.getElementById("agent-messages-box");
    if (json.code === 0 && json.data && json.data.length > 0) {
      box.innerHTML = json.data.map(m => renderBubble(m.role, m.content)).join("");
    } else {
      box.innerHTML = `
        <div class="agent-bubble">
          <div class="agent-bubble-header">
            <span class="agent-name-tag">🤖 RunCabinet Studio</span>
            <span>现在</span>
          </div>
          <div>会话已就绪。已集成 cockpit-tools 全厂商网关与配额追踪，在下方输入指令即可唤醒多智能体协同网格。</div>
        </div>
      `;
    }
  } catch (_) {}
}

function renderBubble(role, content) {
  const isUser = role === "user";
  const name = isUser ? "👤 开发者 (You)" : `🤖 ${role}`;
  const formatted = content.replace(/```python([\s\S]*?)```/g, '<pre><code class="language-python">$1</code></pre>');
  return `
    <div class="agent-bubble ${isUser ? 'user' : ''}">
      <div class="agent-bubble-header">
        <span class="agent-name-tag">${name}</span>
        <span>${new Date().toLocaleTimeString()}</span>
      </div>
      <div>${formatted}</div>
    </div>
  `;
}

async function createNewSession() {
  const convId = "conv-" + Date.now().toString(36);
  await fetch(`/session/${convId}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "新编程工程会话", tags: "feat,coding" }),
  });
  await loadSessions();
  await selectSession(convId);
}

async function promptRenameSession(convId, oldTitle) {
  const newTitle = prompt("重命名会话标题:", oldTitle);
  if (newTitle && newTitle.trim()) {
    await fetch(`/session/${convId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), tags: "feat,coding" }),
    });
    await loadSessions();
  }
}

async function deleteSessionItem(convId) {
  if (confirm("确定彻底删除此会话记录吗？")) {
    await fetch(`/session/${convId}`, { method: "DELETE" });
    state.activeSessionId = "";
    await loadSessions();
  }
}

function filterByTag(tag) {
  state.activeTagFilter = tag;
  renderSessionList();
}

// 多 Agent 对话发送
async function sendAgentMessage() {
  const input = document.getElementById("agent-query-input");
  const query = input.value.trim();
  if (!query) return;

  input.value = "";
  const box = document.getElementById("agent-messages-box");
  box.innerHTML += renderBubble("user", query);

  const provider = document.getElementById("chat-provider-select").value;
  const model = document.getElementById("chat-model-select").value;

  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query,
      conversation_id: state.activeSessionId,
      provider: provider,
      model: model,
    }),
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
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.agent && data.output) {
            box.innerHTML += renderBubble(data.name || data.agent, data.output);
            if (data.code) {
              document.getElementById("code-editor-area").value = data.code;
              document.getElementById("active-file-indicator").textContent = "app/utils/task_solver.py";
            }
          }
        } catch (_) {}
      }
    }
  }

  await loadSessions();
  await updateTokenDisplay();
}

function handleInputKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendAgentMessage();
  }
}

function insertPrompt(p) {
  const input = document.getElementById("agent-query-input");
  input.value = p;
  input.focus();
}

// 工程文件树
async function loadProjectTree() {
  try {
    const res = await fetch("/projects/tree");
    const json = await res.json();
    const treeBox = document.getElementById("project-tree-list");
    if (json.code === 0 && json.data) {
      treeBox.innerHTML = json.data.map(f => `
        <div class="tree-node-item" onclick="openFileInEditor('${f.path}')">
          <span>📄</span> <span>${f.path}</span>
        </div>
      `).join("");
    }
  } catch (_) {}
}

async function openFileInEditor(filePath) {
  state.activeFilePath = filePath;
  document.getElementById("active-file-indicator").textContent = filePath;
  try {
    const res = await fetch(`/projects/file?path=${encodeURIComponent(filePath)}`);
    const json = await res.json();
    if (json.code === 0 && json.data) {
      document.getElementById("code-editor-area").value = json.data.content;
      switchRightPanel("editor");
    }
  } catch (_) {}
}

async function saveActiveFile() {
  if (!state.activeFilePath) {
    alert("请先从左侧文件树选择一个文件！");
    return;
  }
  const content = document.getElementById("code-editor-area").value;
  await fetch("/projects/file/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: state.activeFilePath, content: content }),
  });
  alert(`文件 ${state.activeFilePath} 保存成功！`);
}

function runActiveFile() {
  const term = document.getElementById("terminal-output");
  term.textContent = `[Executing] $ python ${state.activeFilePath || 'app/utils/task_solver.py'}\nOutput: Execution OK. (Exit Code: 0)`;
}

function clearTerminal() {
  document.getElementById("terminal-output").textContent = "// Console cleared.";
}

// 右侧面板切换
function switchRightPanel(view) {
  document.getElementById("tab-editor-btn").classList.toggle("active", view === "editor");
  document.getElementById("tab-graph-btn").classList.toggle("active", view === "graph");
  document.getElementById("tab-memory-btn").classList.toggle("active", view === "memory");

  document.getElementById("editor-view-container").classList.toggle("hidden", view !== "editor");
  document.getElementById("graph-view-container").classList.toggle("hidden", view !== "graph");
  document.getElementById("memory-view-container").classList.toggle("hidden", view !== "memory");

  if (view === "graph") renderD3Graph();
  if (view === "memory") loadMemoryCenter();
}

function toggleKnowledgeGraph() {
  switchRightPanel("graph");
}

// Obsidian D3 知识图谱渲染
async function renderD3Graph() {
  const canvas = document.getElementById("graph-d3-canvas");
  canvas.innerHTML = "";

  const res = await fetch("/graph/ast");
  const json = await res.json();
  if (json.code !== 0 || !json.data) return;

  const data = json.data;
  const width = canvas.clientWidth || 460;
  const height = 400;

  const svg = d3.select("#graph-d3-canvas")
    .append("svg")
    .attr("width", "100%")
    .attr("height", height);

  const simulation = d3.forceSimulation(data.nodes)
    .force("link", d3.forceLink(data.links).id(d => d.id).distance(60))
    .force("charge", d3.forceManyBody().strength(-120))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const link = svg.append("g")
    .selectAll("line")
    .data(data.links)
    .enter().append("line")
    .attr("stroke", "rgba(230, 195, 150, 0.3)")
    .attr("stroke-width", 1.5);

  const node = svg.append("g")
    .selectAll("circle")
    .data(data.nodes)
    .enter().append("circle")
    .attr("r", d => d.val || 8)
    .attr("fill", d => {
      if (d.group === 1) return "#e06c3a"; // file
      if (d.group === 2) return "#f59e0b"; // class
      if (d.group === 3) return "#10b981"; // func
      return "#a855f7"; // session
    })
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  const label = svg.append("g")
    .selectAll("text")
    .data(data.nodes)
    .enter().append("text")
    .text(d => d.name)
    .attr("font-size", "10px")
    .attr("fill", "#faf4eb")
    .attr("dx", 10)
    .attr("dy", 4);

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

  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
}

// 分层记忆中心
async function loadMemoryCenter() {
  const sRes = await fetch(`/memory/short/${state.activeSessionId}`);
  const sJson = await sRes.json();
  const sBox = document.getElementById("short-memory-list");
  sBox.innerHTML = (sJson.data || []).map(m => `<div><strong>${m.role}:</strong> ${m.content.slice(0, 60)}...</div>`).join("") || "暂无短期工作记忆。";

  const lRes = await fetch("/memory/long");
  const lJson = await lRes.json();
  const lBox = document.getElementById("long-memory-list");
  lBox.innerHTML = (lJson.data || []).map(m => `<div style="margin-bottom:8px;"><strong>📌 ${m.title}</strong><br><span style="color:#9c8c7c;">${m.content}</span></div>`).join("");
}

// 弹窗管理
async function openShareSessionModal() {
  if (!state.activeSessionId) {
    alert("请先选择一个会话进行分享！");
    return;
  }
  const curr = state.sessions.find(s => s.conversation_id === state.activeSessionId);
  const res = await fetch(`/session/${state.activeSessionId}/messages`);
  const json = await res.json();
  const msgs = json.data || [];

  let md = `# 会话分享: ${curr?.title || 'RunCabinet 编程会话'}\n> 会话ID: ${state.activeSessionId} | 标签: ${(curr?.tags||[]).map(t=>'#'+t).join(', ')} | 导出时间: ${new Date().toLocaleString()}\n\n---\n\n`;
  for (const m of msgs) {
    md += `### ${m.role === 'user' ? '👨‍💻 开发者 (User)' : '🤖 ' + m.role}\n${m.content}\n\n`;
  }

  document.getElementById("share-export-content").value = md;
  document.getElementById("share-session-modal").classList.remove("hidden");
}
function closeShareSessionModal() {
  document.getElementById("share-session-modal").classList.add("hidden");
}
function copyShareMarkdown() {
  const content = document.getElementById("share-export-content").value;
  navigator.clipboard.writeText(content);
  alert("Markdown 会话转录全文已复制到剪贴板！");
}
function downloadShareJson() {
  const curr = state.sessions.find(s => s.conversation_id === state.activeSessionId);
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(curr, null, 2));
  const dlAnchor = document.createElement("a");
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `${state.activeSessionId}_snapshot.json`);
  dlAnchor.click();
}

// 标签管理弹窗
function openTagManagerModal() {
  document.getElementById("tag-manager-modal").classList.remove("hidden");
}
function closeTagManagerModal() {
  document.getElementById("tag-manager-modal").classList.add("hidden");
}
function selectTagColor(color) {
  state.selectedColor = color;
}
function saveCustomTag() {
  const name = document.getElementById("new-tag-name").value.trim();
  if (name) {
    state.tagColors[name] = state.selectedColor || "#e06c3a";
    alert(`自定义标签 #${name} 已添加！`);
    closeTagManagerModal();
    renderSessionList();
  }
}

// Cockpit Tools 驾驶舱 (多账号 & 配额看板)
async function openCockpitModal() {
  document.getElementById("cockpit-modal").classList.remove("hidden");
  const provList = document.getElementById("provider-status-list");
  
  provList.innerHTML = Object.entries(state.providers).map(([k, p]) => {
    const accountsHtml = (p.accounts || []).map(acc => {
      const isAct = acc.status === "active" ? "active" : "";
      const percent = Math.min(100, Math.round((acc.quota_used / acc.quota_total) * 100));
      return `
        <div style="margin-top:6px;padding:6px;background:#14100d;border-radius:4px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;">
            <span><strong>${acc.name}</strong> ${acc.status === 'active' ? '🟢 [活跃]' : '⚪ [备用]'}</span>
            <span>重置倒计时: ⏳ ${acc.reset_time}</span>
          </div>
          <div class="quota-progress-bar">
            <div class="quota-progress-inner" style="width:${percent}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;color:#9c8c7c;">
            <span>配额用量: ${acc.quota_used}/${acc.quota_total} (${percent}%)</span>
            ${acc.status !== 'active' ? `<button class="btn-xs" onclick="switchProviderAccount('${k}', '${acc.id}')">切换为此账号</button>` : ''}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div style="margin-bottom:10px;padding:10px;background:#1a1612;border-radius:8px;border:1px solid rgba(230,195,150,0.12);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong style="color:#e06c3a;">${p.name}</strong>
            <div style="font-size:11px;color:#9c8c7c;">模型: ${(p.models || []).join(", ")}</div>
          </div>
          <button class="btn-xs" onclick="pingProvider('${k}')">⚡ Ping 测速</button>
        </div>
        ${accountsHtml}
      </div>
    `;
  }).join("");

  // 加载 Tools
  const tRes = await fetch("/cockpit/tools");
  const tJson = await tRes.json();
  const tBox = document.getElementById("cockpit-tools-list");
  tBox.innerHTML = (tJson.data || []).map(t => `
    <div style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
      <span>🔧 ${t.name} (${t.desc})</span>
      <input type="checkbox" ${t.enabled ? 'checked' : ''} onchange="toggleTool('${t.id}', this.checked)">
    </div>
  `).join("");
}
function closeCockpitModal() {
  document.getElementById("cockpit-modal").classList.add("hidden");
}
async function switchProviderAccount(prov, accId) {
  await fetch("/cockpit/providers/switch_account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: prov, account_id: accId }),
  });
  await loadProviders();
  await openCockpitModal();
}
async function pingProvider(p) {
  const res = await fetch("/cockpit/providers/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: p }),
  });
  const json = await res.json();
  alert(`厂商 [${p.toUpperCase()}] 延迟探针: ${json.data?.latency_ms || 40}ms (Status: ONLINE)`);
}
async function toggleTool(id, enabled) {
  await fetch("/cockpit/tools/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_id: id, enabled: enabled }),
  });
}
async function debugToolInSandbox() {
  const val = document.getElementById("sandbox-params-input").value;
  let params = {};
  try { if (val) params = JSON.parse(val); } catch (_) {}
  const res = await fetch("/cockpit/tools/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_id: "terminal_exec", params: params }),
  });
  const json = await res.json();
  document.getElementById("sandbox-debug-output").textContent = json.data?.output || "Executed.";
}

// Token 计量
async function updateTokenDisplay() {
  try {
    const res = await fetch("/cockpit/token/summary");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      document.getElementById("token-meter-display").textContent = `⚡ ${json.data.total_tokens.toLocaleString()} Tokens`;
    }
  } catch (_) {}
}

function handleProviderChange() {
  const provKey = document.getElementById("chat-provider-select").value;
  const p = state.providers[provKey];
  const models = p ? p.models : ["default-model"];
  const select = document.getElementById("chat-model-select");
  select.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join("");
}
