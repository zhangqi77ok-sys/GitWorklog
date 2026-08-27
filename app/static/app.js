// Vite Coding Platform - Warm Cabinet JS Engine
const $ = (id) => document.getElementById(id);

const state = {
  token: localStorage.getItem("auth_token") || "",
  user: null,
  activeSessionId: "",
  activeTagFilter: "",
  activeFilePath: "",
  projectPath: "e:\\pro\\agent-learning",
  sessions: [],
  selectedAgentRole: "architect",
  selectedModel: "qwen3.7-flash",
  currentMainView: "coding",
  currentRightTab: "editor",
  debugToolId: "",
  selectedTagColor: "#e06c3a",
  customTags: JSON.parse(localStorage.getItem("custom_tags") || '{"feat":"#e06c3a","coding":"#f59e0b","bugfix":"#f43f5e","review":"#d97706","mesh":"#a855f7","hotfix":"#ef4444"}'),
};

// 1. 初始化
document.addEventListener("DOMContentLoaded", async () => {
  initGraphCanvas();
  renderTagFilterChips();
  if (!state.token) {
    showLoginModal();
  } else {
    await initApp();
  }
});

function showLoginModal() {
  $("login-modal").classList.remove("hidden");
}

async function login() {
  const u = $("username").value.trim();
  const p = $("password").value.trim();
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    const json = await res.json();
    if (json.code === 0 && json.data?.token) {
      state.token = json.data.token;
      localStorage.setItem("auth_token", state.token);
      $("login-modal").classList.add("hidden");
      await initApp();
      showToast("登录成功，欢迎使用 RunCabinet 编程工作台！");
    } else {
      showToast(json.message || "登录失败", "error");
    }
  } catch (err) {
    showToast("网络请求异常", "error");
  }
}

async function initApp() {
  $("login-modal").classList.add("hidden");
  await fetchCurrentUser();
  await loadSessions();
  await refreshProjectTree();
  await updateTokenMetrics();
  loadCockpitTools();
  loadLlmProviders();
}

async function fetchCurrentUser() {
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0) {
      state.user = json.data;
      $("current-user-badge").textContent = (state.user.nickname || state.user.username || "A")[0].toUpperCase();
    }
  } catch (_) {}
}

// 2. 标签与自定义颜色管理
function renderTagFilterChips() {
  const container = $("tag-filter-chips");
  if (!container) return;
  const tags = Object.keys(state.customTags);
  container.innerHTML = `
    <span class="tag-chip ${!state.activeTagFilter ? 'active' : ''}" onclick="filterSessionsByTag('')">全部</span>
    ${tags.map((t) => {
      const color = state.customTags[t] || "#e06c3a";
      const active = state.activeTagFilter === t ? 'active' : '';
      return `<span class="tag-chip ${active}" style="color:${color}; border-color:${active ? color : 'transparent'}" onclick="filterSessionsByTag('${t}')">#${t}</span>`;
    }).join("")}
  `;
}

function openTagManagerModal() {
  $("tag-manager-modal").classList.remove("hidden");
}

function closeTagManagerModal() {
  $("tag-manager-modal").classList.add("hidden");
}

function selectTagColor(el) {
  document.querySelectorAll(".color-dot-choice").forEach((d) => d.classList.remove("selected"));
  el.classList.add("selected");
  state.selectedTagColor = el.getAttribute("data-color");
}

function saveCustomTag() {
  const name = $("custom-tag-name").value.trim().replace(/^#/, "");
  if (!name) return showToast("请输入标签名称", "error");
  state.customTags[name] = state.selectedTagColor;
  localStorage.setItem("custom_tags", JSON.stringify(state.customTags));
  renderTagFilterChips();
  renderSessionList();
  closeTagManagerModal();
  showToast(`已保存自定义标签: #${name}`);
}

function filterSessionsByTag(tag) {
  state.activeTagFilter = tag;
  renderTagFilterChips();
  renderSessionList();
}

// 3. 会话管理 (三色状态灯 + 标签颜色徽章 + 删除 + 重命名)
async function loadSessions() {
  try {
    const res = await fetch("/api/session", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      state.sessions = json.data;
      if (state.sessions.length === 0) {
        // 自动创建一个默认初始会话
        const convId = "conv-cabinet-main";
        await fetch(`/api/session/${convId}/rename`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
          body: JSON.stringify({ title: "RunCabinet 暖色多Agent协同工程", tags: "feat,coding,review" }),
        });
        state.sessions = [{ conversation_id: convId, title: "RunCabinet 暖色多Agent协同工程", tags: "feat,coding,review", status: "idle" }];
      }
      renderSessionList();
      if (!state.activeSessionId && state.sessions.length > 0) {
        await selectSession(state.sessions[0].conversation_id);
      }
    }
  } catch (_) {}
}

function renderSessionList() {
  const container = $("session-list-container");
  if (!container) return;
  const filtered = state.sessions.filter((s) => {
    if (!state.activeTagFilter) return true;
    return (s.tags || "").includes(state.activeTagFilter);
  });

  container.innerHTML = filtered.map((s) => {
    const activeClass = s.conversation_id === state.activeSessionId ? "active" : "";
    const dotColor = s.status === "running" ? "blue" : (s.status === "failed" ? "red" : "green");
    const rawTags = (s.tags || "").split(",").filter(Boolean);
    const tagsHtml = rawTags.map((t) => {
      const cleanTag = t.trim().replace(/^#/, "");
      const color = state.customTags[cleanTag] || "#e06c3a";
      return `<span class="session-tag-badge" style="color:${color}; background:${color}22; border:1px solid ${color}44;">#${cleanTag}</span>`;
    }).join(" ");

    return `
      <div class="session-item ${activeClass}" onclick="selectSession('${s.conversation_id}')">
        <div class="session-item-left">
          <span class="session-status-dot ${dotColor}" title="状态: ${s.status || 'idle'}"></span>
          <span class="session-title-text" title="${s.title || s.conversation_id}">${s.title || s.conversation_id}</span>
          ${tagsHtml}
        </div>
        <div class="session-actions" onclick="event.stopPropagation()">
          <button class="session-mini-btn" onclick="renameSession('${s.conversation_id}')" title="重命名">✏️</button>
          <button class="session-mini-btn" onclick="deleteSession('${s.conversation_id}')" title="删除会话">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

async function createNewSession() {
  const convId = "conv-" + Date.now().toString(36);
  try {
    await fetch(`/api/session/${convId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ title: "新编程开发会话", tags: "feat,coding" }),
    });
    await loadSessions();
    selectSession(convId);
    showToast("已创建新会话！");
  } catch (_) {}
}

async function selectSession(convId) {
  state.activeSessionId = convId;
  renderSessionList();
  await loadSessionMessages(convId);
}

async function renameSession(convId) {
  const newTitle = prompt("请输入会话新名称:");
  if (!newTitle) return;
  const newTags = prompt("请输入标签(逗号分隔, 如: feat,coding,review):", "feat,coding");
  try {
    await fetch(`/api/session/${convId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ title: newTitle, tags: newTags || "" }),
    });
    await loadSessions();
  } catch (_) {}
}

async function deleteSession(convId) {
  if (!confirm(`确认删除会话 [${convId}] 及其历史记录？`)) return;
  try {
    const res = await fetch(`/api/session/${convId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0) {
      showToast(`已删除会话: ${convId}`);
      state.sessions = state.sessions.filter((s) => s.conversation_id !== convId);
      if (state.activeSessionId === convId) {
        state.activeSessionId = state.sessions.length > 0 ? state.sessions[0].conversation_id : "";
      }
      renderSessionList();
      if (state.activeSessionId) loadSessionMessages(state.activeSessionId);
    }
  } catch (err) {
    showToast("删除会话失败", "error");
  }
}

// 4. 会话内容分享与导出 (Share Modal)
async function openShareSessionModal() {
  if (!state.activeSessionId) return showToast("请先选择一个会话进行分享", "error");
  $("share-session-modal").classList.remove("hidden");
  $("share-export-content").value = "⏳ 正在生成会话转录快照...";

  try {
    const res = await fetch(`/api/session/${state.activeSessionId}/messages`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    const msgs = json.data || [];
    const active = state.sessions.find((s) => s.conversation_id === state.activeSessionId);
    let md = `# 会话分享: ${active?.title || state.activeSessionId}\n`;
    md += `> 会话ID: ${state.activeSessionId} | 标签: ${active?.tags || "无"} | 导出时间: ${new Date().toLocaleString()}\n\n---\n\n`;

    msgs.forEach((m) => {
      const sender = m.role === "user" ? "👨‍💻 开发者 (User)" : `🤖 ${m.role.toUpperCase()}`;
      md += `### ${sender}\n${m.content}\n\n`;
    });

    $("share-export-content").value = md;
  } catch (_) {
    $("share-export-content").value = "获取会话内容失败";
  }
}

function closeShareSessionModal() {
  $("share-session-modal").classList.add("hidden");
}

function copyShareMarkdown() {
  const content = $("share-export-content").value;
  navigator.clipboard.writeText(content).then(() => {
    showToast("📋 已复制 Markdown 会话记录到剪贴板！");
  }).catch(() => {
    showToast("复制失败，请手动全选复制", "error");
  });
}

function downloadSessionJson() {
  const active = state.sessions.find((s) => s.conversation_id === state.activeSessionId);
  const data = {
    conversation_id: state.activeSessionId,
    title: active?.title,
    tags: active?.tags,
    exported_at: new Date().toISOString(),
    content: $("share-export-content").value,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session_${state.activeSessionId}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("💾 已下载 JSON 会话快照文件！");
}

// 5. 核心视图切换
function switchMainView(view) {
  state.currentMainView = view;
  document.querySelectorAll(".rail-btn").forEach((b) => b.classList.remove("active"));
  const btn = $(`rail-btn-${view}`);
  if (btn) btn.classList.add("active");

  if (view === "cockpit") {
    $("view-coding").classList.add("hidden");
    $("view-cockpit").classList.remove("hidden");
    loadCockpitTools();
    updateTokenMetrics();
    loadLlmProviders();
  } else {
    $("view-cockpit").classList.add("hidden");
    $("view-coding").classList.remove("hidden");
  }
}

// 6. Token 计量与指标大盘
async function updateTokenMetrics() {
  try {
    const res = await fetch("/api/cockpit/token/summary", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      const d = json.data;
      const total = d.total_tokens || 1280;
      $("token-meter-chip").textContent = `⚡ ${total.toLocaleString()} Tokens`;
      if ($("kpi-total-tokens")) $("kpi-total-tokens").textContent = total.toLocaleString();
      if ($("kpi-total-calls")) $("kpi-total-calls").textContent = d.total_calls || 4;
      if ($("kpi-avg-latency")) $("kpi-avg-latency").textContent = `${d.avg_latency_ms || 385}ms`;
    }
  } catch (_) {}
}

// 7. Cockpit Tools 驾驶舱
async function loadCockpitTools() {
  const container = $("cockpit-tools-list");
  if (!container) return;
  try {
    const res = await fetch("/api/cockpit/tools", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      const tools = json.data;
      const activeCount = tools.filter((t) => t.enabled).length;
      if ($("kpi-active-tools")) $("kpi-active-tools").textContent = `${activeCount} / ${tools.length}`;

      container.innerHTML = tools.map((t) => `
        <div class="cockpit-tool-card">
          <div class="tool-top-row">
            <span class="tool-name-tag">${t.icon || "🛠️"} ${t.name}</span>
            <button class="toggle-switch-btn ${t.enabled ? 'enabled' : 'disabled'}" onclick="toggleToolStatus('${t.tool_id}', ${!t.enabled})">
              ${t.enabled ? '● 已启用' : '○ 已禁用'}
            </button>
          </div>
          <p class="tool-desc">${t.description}</p>
          <div class="tool-footer-row">
            <span>分类: <b>${t.category.toUpperCase()}</b> | 耗时: ${t.last_latency_ms || 0}ms</span>
            <button class="btn-tool-pill" onclick="openToolDebugModal('${t.tool_id}', '${t.name}')">🧪 在线调试</button>
          </div>
        </div>
      `).join("");
    }
  } catch (_) {}
}

async function toggleToolStatus(toolId, enabled) {
  try {
    await fetch("/api/cockpit/tools/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ tool_id: toolId, enabled: enabled }),
    });
    loadCockpitTools();
  } catch (_) {}
}

function openToolDebugModal(toolId, toolName) {
  state.debugToolId = toolId;
  $("debug-tool-name").textContent = `${toolName} (${toolId})`;
  $("debug-tool-params").value = JSON.stringify({ command: "pytest" }, null, 2);
  $("debug-tool-result").textContent = "// 点击「执行调用」运行...";
  $("tool-debug-modal").classList.remove("hidden");
}

function closeToolDebugModal() {
  $("tool-debug-modal").classList.add("hidden");
}

async function confirmInvokeDebugTool() {
  let params = {};
  try {
    params = JSON.parse($("debug-tool-params").value);
  } catch (_) {
    return showToast("参数必须是有效 JSON", "error");
  }
  $("debug-tool-result").textContent = "🚀 正在执行调用...";
  try {
    const res = await fetch("/api/cockpit/tools/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ tool_id: state.debugToolId, parameters: params }),
    });
    const json = await res.json();
    $("debug-tool-result").textContent = JSON.stringify(json.data || json, null, 2);
  } catch (e) {
    $("debug-tool-result").textContent = "错误: " + e.message;
  }
}

// 8. 多智能体消息与代码渲染
async function loadSessionMessages(convId) {
  const container = $("agent-messages-box");
  if (!container) return;
  try {
    const res = await fetch(`/api/session/${convId}/messages`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      if (json.data.length === 0) {
        container.innerHTML = `
          <div class="welcome-box">
            <h3>⚡ RunCabinet 暖色调多智能体编程环境</h3>
            <p>当前会话 ID: <code>${convId}</code>。支持自然语言编程、三色呼吸灯、跨会话引用与一键分享。</p>
          </div>
        `;
      } else {
        container.innerHTML = json.data.map((m) => renderMessageBubble(m)).join("");
      }
      container.scrollTop = container.scrollHeight;
    }
  } catch (_) {}
}

function renderMessageBubble(m) {
  const roleName = m.role === "user" ? "开发者 (You)" : (m.role === "coder" ? "Coder 研发工程师" : (m.role === "reviewer" ? "Reviewer 审查员" : (m.role === "tester" ? "Tester 单测工程师" : "Architect 主架构师")));
  const isUser = m.role === "user";
  return `
    <div class="agent-bubble ${isUser ? 'user' : ''}">
      <div class="agent-bubble-header">
        <span class="agent-name-tag">${isUser ? '👤' : '🤖'} ${roleName}</span>
        <span>${new Date().toLocaleTimeString()}</span>
      </div>
      <div>${renderMarkdown(m.content)}</div>
    </div>
  `;
}

function renderMarkdown(md) {
  if (!md) return "";
  let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```([a-zA-Z0-9_\-\.:]*)[\r\n]+([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^\*]+)\*\*/g, "<b>$1</b>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

async function sendAgentMessage() {
  const input = $("agent-query-input");
  const query = input.value.trim();
  if (!query) return;
  input.value = "";

  const container = $("agent-messages-box");
  container.innerHTML += `
    <div class="agent-bubble user">
      <div class="agent-bubble-header">
        <span class="agent-name-tag">👤 开发者 (You)</span>
        <span>${new Date().toLocaleTimeString()}</span>
      </div>
      <div>${query}</div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;

  try {
    const res = await fetch("/api/mesh/collaborate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({
        conversation_id: state.activeSessionId,
        user_query: query,
        project_path: state.projectPath,
      }),
    });
    const json = await res.json();
    if (json.code === 0 && json.data?.steps) {
      json.data.steps.forEach((step) => {
        container.innerHTML += `
          <div class="agent-bubble">
            <div class="agent-bubble-header">
              <span class="agent-name-tag">${step.role === 'coder' ? '👨‍💻 Coder' : (step.role === 'reviewer' ? '🔍 Reviewer' : '🧪 Tester')}</span>
              <span>${new Date().toLocaleTimeString()}</span>
            </div>
            <div>${renderMarkdown(step.result)}</div>
          </div>
        `;
      });
      container.scrollTop = container.scrollHeight;
      await updateTokenMetrics();
    }
  } catch (_) {}
}

// 9. 文件树与代码编辑
async function refreshProjectTree() {
  try {
    const res = await fetch("/api/files/tree?depth=3", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      renderTreeNodes(json.data, $("project-tree-list"));
    }
  } catch (_) {}
}

function renderTreeNodes(nodes, container, depth = 0) {
  if (!container) return;
  container.innerHTML = "";
  nodes.forEach((node) => {
    const el = document.createElement("div");
    el.className = "tree-node-item";
    el.style.paddingLeft = `${depth * 14 + 6}px`;
    const icon = node.type === "directory" ? "📁" : "📄";
    el.innerHTML = `<span>${icon}</span> <span>${node.name}</span>`;
    el.onclick = () => {
      if (node.type === "file") openFileInEditor(node.path);
    };
    container.appendChild(el);
    if (node.children && node.children.length > 0) {
      const sub = document.createElement("div");
      renderTreeNodes(node.children, sub, depth + 1);
      container.appendChild(sub);
    }
  });
}

async function openFileInEditor(relPath) {
  state.activeFilePath = relPath;
  $("active-file-indicator").textContent = relPath;
  switchRightTab("editor");
  try {
    const res = await fetch(`/api/files/content?path=${encodeURIComponent(relPath)}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0) {
      $("code-editor-area").value = json.data.content;
    }
  } catch (_) {}
}

async function saveActiveFileCode() {
  if (!state.activeFilePath) return showToast("请先选择要保存的文件", "error");
  const content = $("code-editor-area").value;
  try {
    const res = await fetch("/api/files/content", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ path: state.activeFilePath, content: content }),
    });
    const json = await res.json();
    if (json.code === 0) showToast(`已保存文件: ${state.activeFilePath}`);
  } catch (_) {}
}

// 10. Obsidian 暖色星空力导向图谱
let graphSimulation = { nodes: [], links: [], animId: null };

function initGraphCanvas() {
  const canvas = $("obsidian-graph-canvas");
  if (!canvas) return;
  const resize = () => {
    canvas.width = canvas.parentElement.clientWidth || 500;
    canvas.height = canvas.parentElement.clientHeight || 400;
  };
  window.addEventListener("resize", resize);
  setTimeout(resize, 100);
}

async function reloadObsidianGraph() {
  try {
    const res = await fetch("/api/graph/project", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      startGraphPhysics(json.data.nodes, json.data.links);
    }
  } catch (_) {}
}

function startGraphPhysics(rawNodes, rawLinks) {
  const canvas = $("obsidian-graph-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  const nodes = rawNodes.map((n) => ({
    ...n,
    x: w / 2 + (Math.random() - 0.5) * (w * 0.7),
    y: h / 2 + (Math.random() - 0.5) * (h * 0.7),
    vx: 0,
    vy: 0,
    radius: n.type === "project" ? 9 : (n.type === "python" ? 6 : (n.type === "commit" ? 5 : 4)),
    color: n.type === "project" ? "#e06c3a" : (n.type === "python" ? "#38bdf8" : (n.type === "function" ? "#10b981" : (n.type === "class" ? "#ec4899" : "#f59e0b"))),
  }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const links = rawLinks.map((l) => ({
    source: nodeMap.get(l.source),
    target: nodeMap.get(l.target),
  })).filter((l) => l.source && l.target);

  function step() {
    ctx.fillStyle = "#090705";
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      n1.vx += (w / 2 - n1.x) * 0.0005;
      n1.vy += (h / 2 - n1.y) * 0.0005;

      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 180) {
          const force = (180 - dist) / dist * 0.04;
          n1.vx -= dx * force;
          n1.vy -= dy * force;
          n2.vx += dx * force;
          n2.vy += dy * force;
        }
      }
    }

    links.forEach((l) => {
      const dx = l.target.x - l.source.x;
      const dy = l.target.y - l.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 40) * 0.005;
      l.source.vx += dx * force;
      l.source.vy += dy * force;
      l.target.vx -= dx * force;
      l.target.vy -= dy * force;

      ctx.strokeStyle = "rgba(224, 108, 58, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.stroke();
    });

    nodes.forEach((n) => {
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;

      n.x = Math.max(n.radius, Math.min(w - n.radius, n.x));
      n.y = Math.max(n.radius, Math.min(h - n.radius, n.y));

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();

      if (n.type === "project" || n.type === "commit" || nodes.length <= 25) {
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#faebd7";
        ctx.fillText(n.label, n.x + n.radius + 4, n.y + 4);
      }
    });

    graphSimulation.animId = requestAnimationFrame(step);
  }

  if (graphSimulation.animId) cancelAnimationFrame(graphSimulation.animId);
  step();
}

function switchRightTab(tab) {
  state.currentRightTab = tab;
  document.querySelectorAll(".wb-tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".wb-tab-pane").forEach((p) => p.classList.remove("active"));
  const btn = $(`tab-btn-${tab}`);
  const pane = $(`pane-${tab}`);
  if (btn) btn.classList.add("active");
  if (pane) pane.classList.add("active");
  if (tab === "graph") reloadObsidianGraph();
}

function toggleRightTab(tab) {
  switchMainView("coding");
  switchRightTab(tab);
}

function applyPromptChip(text) { $("agent-query-input").value = text; }
function openNewFileModal() { $("new-file-modal").classList.remove("hidden"); }
function closeNewFileModal() { $("new-file-modal").classList.add("hidden"); }

async function confirmCreateNewFile() {
  const relPath = $("new-file-relpath").value.trim();
  if (!relPath) return showToast("请输入文件路径", "error");
  try {
    const res = await fetch("/api/files/content", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ path: relPath, content: "# Auto generated file\n" }),
    });
    if (res.ok) {
      showToast(`已创建文件: ${relPath}`);
      closeNewFileModal();
      await refreshProjectTree();
      openFileInEditor(relPath);
    }
  } catch (_) {}
}

function showToast(msg, type = "info") {
  const container = $("toast-container");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "toast-msg";
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// 绑定全局作用域
window.login = login;
window.switchMainView = switchMainView;
window.switchRightTab = switchRightTab;
window.toggleRightTab = toggleRightTab;
window.renderTagFilterChips = renderTagFilterChips;
window.openTagManagerModal = openTagManagerModal;
window.closeTagManagerModal = closeTagManagerModal;
window.selectTagColor = selectTagColor;
window.saveCustomTag = saveCustomTag;
window.filterSessionsByTag = filterSessionsByTag;
window.createNewSession = createNewSession;
window.selectSession = selectSession;
window.renameSession = renameSession;
window.deleteSession = deleteSession;
window.openShareSessionModal = openShareSessionModal;
window.closeShareSessionModal = closeShareSessionModal;
window.copyShareMarkdown = copyShareMarkdown;
window.downloadSessionJson = downloadSessionJson;
window.sendAgentMessage = sendAgentMessage;
window.refreshProjectTree = refreshProjectTree;
window.openFileInEditor = openFileInEditor;
window.saveActiveFileCode = saveActiveFileCode;
window.reloadObsidianGraph = reloadObsidianGraph;
window.loadCockpitTools = loadCockpitTools;
window.toggleToolStatus = toggleToolStatus;
window.openToolDebugModal = openToolDebugModal;
window.closeToolDebugModal = closeToolDebugModal;
window.confirmInvokeDebugTool = confirmInvokeDebugTool;
window.applyPromptChip = applyPromptChip;
window.openNewFileModal = openNewFileModal;
window.closeNewFileModal = closeNewFileModal;
window.confirmCreateNewFile = confirmCreateNewFile;