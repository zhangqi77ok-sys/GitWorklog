// Vite Coding Platform - Modern Desktop Operating System JS
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
  currentMainView: "coding", // coding / cockpit / graph / memory
  currentRightTab: "editor",  // editor / graph / memory
  debugToolId: "",
};

// 1. 初始化
document.addEventListener("DOMContentLoaded", async () => {
  initGraphCanvas();
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
      showToast("登录成功，欢迎使用 Vite Coding 平台！");
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
      $("current-user-badge").textContent = (state.user.nickname || state.user.username || "U")[0].toUpperCase();
    }
  } catch (_) {}
}

// 2. 核心视图切换 (Coding / Cockpit / Graph / Memory)
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
  } else if (view === "graph") {
    $("view-cockpit").classList.add("hidden");
    $("view-coding").classList.remove("hidden");
    switchRightTab("graph");
  } else if (view === "memory") {
    $("view-cockpit").classList.add("hidden");
    $("view-coding").classList.remove("hidden");
    switchRightTab("memory");
  } else {
    $("view-cockpit").classList.add("hidden");
    $("view-coding").classList.remove("hidden");
  }
}

// 3. Token 计量与指标统计大盘
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
      if ($("kpi-avg-latency")) $("kpi-avg-latency").textContent = `${d.avg_latency_ms || 420}ms`;

      // 渲染按模型分布条
      const container = $("token-model-breakdown");
      if (container && d.by_model) {
        container.innerHTML = d.by_model.map((m) => `
          <div class="model-token-bar">
            <span>🔮 <b>${m.model}</b> (${m.calls} 次调用)</span>
            <span style="color:#fbbf24; font-family:var(--font-mono); font-weight:600;">⚡ ${m.total_tokens.toLocaleString()} Tokens</span>
          </div>
        `).join("");
      }
    }
  } catch (_) {}
}

// 4. Cockpit Tools 驾驶舱操控台 (列表 / 开关 / 在线调试沙箱)
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
    const res = await fetch("/api/cockpit/tools/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ tool_id: toolId, enabled: enabled }),
    });
    const json = await res.json();
    if (json.code === 0) {
      showToast(`已${enabled ? "启用" : "禁用"}工具: ${toolId}`);
      loadCockpitTools();
    }
  } catch (_) {}
}

function openToolDebugModal(toolId, toolName) {
  state.debugToolId = toolId;
  $("debug-tool-name").textContent = `${toolName} (${toolId})`;
  $("debug-tool-params").value = JSON.stringify({ command: "pytest tests/platform/test_token_meter.py" }, null, 2);
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
  } catch (e) {
    showToast("参数必须是有效 JSON 格式", "error");
    return;
  }
  $("debug-tool-result").textContent = "🚀 正在通过 Cockpit 调用工具...";
  try {
    const res = await fetch("/api/cockpit/tools/invoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ tool_id: state.debugToolId, parameters: params }),
    });
    const json = await res.json();
    $("debug-tool-result").textContent = JSON.stringify(json.data || json, null, 2);
    loadCockpitTools();
    updateTokenMetrics();
  } catch (err) {
    $("debug-tool-result").textContent = "调用失败: " + err.message;
  }
}

// 5. LLM 厂商接入与管理
async function loadLlmProviders() {
  const container = $("llm-providers-container");
  if (!container) return;
  try {
    const res = await fetch("/api/gateway/providers", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      container.innerHTML = json.data.map((p) => `
        <div class="provider-row-card">
          <div class="prov-header">
            <span>🔮 ${p.name} (<code>${p.provider_code}</code>)</span>
            <span class="badge-pill" style="background:${p.has_key ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${p.has_key ? '#34d399' : '#f87171'}">
              ${p.has_key ? '● 密钥就绪' : '○ 缺密钥'}
            </span>
          </div>
          <div class="prov-inputs">
            <input type="text" value="${p.base_url}" placeholder="Base URL" id="prov-url-${p.provider_code}">
            <input type="password" placeholder="sk-***" value="${p.api_key_masked}" id="prov-key-${p.provider_code}">
            <button class="btn-tool-pill btn-run-pill" onclick="testProviderPing('${p.provider_code}')">⚡ 连通性测试</button>
          </div>
        </div>
      `).join("");
    }
  } catch (_) {}
}

async function testProviderPing(code) {
  showToast(`正在测试 ${code} 连通性...`);
  try {
    const res = await fetch("/api/gateway/test-connectivity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ provider_code: code }),
    });
    const json = await res.json();
    if (json.code === 0 && json.data?.ok) {
      showToast(`✅ ${code} 连接成功 (延迟: ${json.data.latency_ms || 240}ms)`);
    } else {
      showToast(`⚠️ ${json.data?.error || '连接超时'}`, "error");
    }
  } catch (_) {
    showToast("网络测试异常", "error");
  }
}

function openAddCustomModelModal() { $("custom-model-modal").classList.remove("hidden"); }
function closeCustomModelModal() { $("custom-model-modal").classList.add("hidden"); }

async function confirmAddCustomModel() {
  const modelId = $("new-model-id").value.trim();
  const modelName = $("new-model-name").value.trim();
  if (!modelId) return showToast("请输入模型代码", "error");
  try {
    const res = await fetch("/api/gateway/providers/bailian/custom-models", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ model_id: modelId, model_name: modelName || modelId }),
    });
    const json = await res.json();
    if (json.code === 0) {
      showToast(`已添加模型: ${modelId}`);
      closeCustomModelModal();
      loadLlmProviders();
    }
  } catch (_) {}
}

// 6. 会话管理 (三色状态灯 + 标签管理 + 重命名)
async function loadSessions() {
  try {
    const res = await fetch("/api/session", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      state.sessions = json.data;
      renderSessionList();
      if (state.sessions.length > 0 && !state.activeSessionId) {
        selectSession(state.sessions[0].conversation_id);
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
    const tagsHtml = (s.tags || "").split(",").filter(Boolean).map((t) => `<span class="session-tag-badge">#${t.trim()}</span>`).join(" ");

    return `
      <div class="session-item ${activeClass}" onclick="selectSession('${s.conversation_id}')">
        <div class="session-item-left">
          <span class="session-status-dot ${dotColor}" title="状态: ${s.status || 'idle'}"></span>
          <span class="session-title-text" title="${s.title || s.conversation_id}">${s.title || s.conversation_id}</span>
          ${tagsHtml}
        </div>
        <div class="session-actions" onclick="event.stopPropagation()">
          <button class="session-mini-btn" onclick="renameSession('${s.conversation_id}')" title="重命名">✏️</button>
          <button class="session-mini-btn" onclick="deleteSession('${s.conversation_id}')" title="删除">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

function filterSessionsByTag(tag) {
  state.activeTagFilter = tag;
  document.querySelectorAll(".tag-chip").forEach((el) => {
    el.classList.toggle("active", el.textContent.includes(tag) || (!tag && el.textContent === "全部"));
  });
  renderSessionList();
}

async function createNewSession() {
  const convId = "conv-" + Date.now().toString(36);
  try {
    const res = await fetch(`/api/session/${convId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ title: "新编程会话", tags: "feat,coding" }),
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
  const newTags = prompt("请输入标签(逗号分隔, 如: feat,bugfix):", "feat,coding");
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
  if (!confirm("确认删除该会话记录？")) return;
  try {
    await fetch(`/api/session/${convId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    await loadSessions();
  } catch (_) {}
}

// 7. 多智能体协作流与消息加载
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
            <h3>⚡ Vite Coding 多智能体自主编程环境</h3>
            <p>当前会话 ID: <code>${convId}</code>。支持自然语言开发需求、跨会话引用（输入 @ 引用其他会话）、多 Agent 自动协同（A 编码 $\\rightarrow$ B 审查 $\\rightarrow$ C 跑单测）与 Obsidian 动态图谱。</p>
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
      <div class="agent-bubble-content">${renderMarkdown(m.content)}</div>
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

// 8. 发送多 Agent 指令
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

  // 触发多 Agent 协同流水线
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
      await refreshProjectTree();
      await updateTokenMetrics();
    }
  } catch (err) {
    showToast("智能体响应失败", "error");
  }
}

// 9. 工程目录树与代码编辑器
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
      if (node.type === "file") {
        openFileInEditor(node.path);
      }
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
    if (json.code === 0) {
      showToast(`已保存文件: ${state.activeFilePath}`);
    }
  } catch (_) {}
}

// 10. Obsidian 物理力导向图谱
let graphSimulation = {
  nodes: [],
  links: [],
  animId: null,
  hoveredNode: null,
};

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
    color: n.type === "project" ? "#6366f1" : (n.type === "python" ? "#38bdf8" : (n.type === "function" ? "#10b981" : (n.type === "class" ? "#ec4899" : "#e11d48"))),
  }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const links = rawLinks.map((l) => ({
    source: nodeMap.get(l.source),
    target: nodeMap.get(l.target),
  })).filter((l) => l.source && l.target);

  graphSimulation.nodes = nodes;
  graphSimulation.links = links;

  function step() {
    ctx.fillStyle = "#040609";
    ctx.fillRect(0, 0, w, h);

    // 物理斥力与引力
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

    // 连线弹簧力
    links.forEach((l) => {
      const dx = l.target.x - l.source.x;
      const dy = l.target.y - l.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 40) * 0.005;
      l.source.vx += dx * force;
      l.source.vy += dy * force;
      l.target.vx -= dx * force;
      l.target.vy -= dy * force;

      ctx.strokeStyle = "rgba(99, 102, 241, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.stroke();
    });

    // 绘制节点
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

      if (n === graphSimulation.hoveredNode || n.type === "project" || n.type === "commit" || nodes.length <= 25) {
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillStyle = n === graphSimulation.hoveredNode ? "#38bdf8" : "#cbd5e1";
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

function toggleTerminalDrawer() {
  $("terminal-drawer").classList.toggle("hidden");
}

function clearTerminalOutput() {
  $("terminal-output").textContent = "// Vite Coding Terminal Ready.\n$ ";
}

function applyPromptChip(text) {
  $("agent-query-input").value = text;
}

function openNewFileModal() { $("new-file-modal").classList.remove("hidden"); }
function closeNewFileModal() { $("new-file-modal").classList.add("hidden"); }

async function confirmCreateNewFile() {
  const relPath = $("new-file-relpath").value.trim();
  const content = $("new-file-init-content").value;
  if (!relPath) return showToast("请输入文件路径", "error");
  try {
    const res = await fetch("/api/files/content", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ path: relPath, content: content }),
    });
    const json = await res.json();
    if (json.code === 0) {
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
window.loadCockpitTools = loadCockpitTools;
window.toggleToolStatus = toggleToolStatus;
window.openToolDebugModal = openToolDebugModal;
window.closeToolDebugModal = closeToolDebugModal;
window.confirmInvokeDebugTool = confirmInvokeDebugTool;
window.loadLlmProviders = loadLlmProviders;
window.testProviderPing = testProviderPing;
window.openAddCustomModelModal = openAddCustomModelModal;
window.closeCustomModelModal = closeCustomModelModal;
window.confirmAddCustomModel = confirmAddCustomModel;
window.createNewSession = createNewSession;
window.selectSession = selectSession;
window.renameSession = renameSession;
window.deleteSession = deleteSession;
window.filterSessionsByTag = filterSessionsByTag;
window.sendAgentMessage = sendAgentMessage;
window.refreshProjectTree = refreshProjectTree;
window.openFileInEditor = openFileInEditor;
window.saveActiveFileCode = saveActiveFileCode;
window.reloadObsidianGraph = reloadObsidianGraph;
window.toggleTerminalDrawer = toggleTerminalDrawer;
window.clearTerminalOutput = clearTerminalOutput;
window.applyPromptChip = applyPromptChip;
window.openNewFileModal = openNewFileModal;
window.closeNewFileModal = closeNewFileModal;
window.confirmCreateNewFile = confirmCreateNewFile;