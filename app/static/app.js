// Vite Coding Platform - Desktop Multi-Agent Studio Controller
const state = {
  token: localStorage.getItem("auth_token") || "",
  currentUser: null,
  currentProject: "e:\\pro\\agent-learning",
  currentBranch: "main",
  sessions: [],
  currentSessionId: "",
  activeFilePath: "",
  activeFileContent: "",
  activeTagFilter: "",
  graphData: { nodes: [], edges: [] },
  isGenerating: false,
};

const $ = (id) => document.getElementById(id);

function showToast(msg, duration = 2500) {
  const container = $("toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "toast-msg";
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 200); }, duration);
}

async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (state.token) {
    options.headers["Authorization"] = `Bearer ${state.token}`;
  }
  const res = await fetch(url, options);
  if (res.status === 401) {
    showLoginModal();
  }
  return res;
}

// 1. 初始化与登录
async function initApp() {
  if (!state.token) {
    showLoginModal();
    return;
  }
  await loadCurrentUser();
  await loadSessions();
  await refreshProjectTree();
  await reloadObsidianGraph();
  await loadLongTermMemories();
  setupEventListeners();
}

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
      showToast("登录成功，进入 Vite Coding 桌面工作台！");
      await initApp();
    } else {
      showToast("登录失败: " + (json.message || "密码错误"));
    }
  } catch (e) {
    showToast("连接服务器异常: " + e.message);
  }
}

async function loadCurrentUser() {
  try {
    const res = await apiFetch("/api/auth/me");
    const json = await res.json();
    if (json.code === 0 && json.data) {
      state.currentUser = json.data;
      if ($("current-user-badge")) {
        $("current-user-badge").textContent = (json.data.username || "U")[0].toUpperCase();
      }
    }
  } catch (e) { console.error("加载用户信息失败:", e); }
}

// 2. 会话管理 (带 🔵 运行 / 🟢 就绪 / 🔴 失败 状态灯，标签与重命名)
async function loadSessions() {
  try {
    const res = await apiFetch("/session/list");
    const json = await res.json();
    if (json.code === 0) {
      state.sessions = json.data || [];
      renderSessionList();
      if (!state.currentSessionId && state.sessions.length > 0) {
        selectSession(state.sessions[0].conversation_id);
      } else if (state.sessions.length === 0) {
        await createNewSession();
      }
    }
  } catch (e) { console.error("加载会话失败:", e); }
}

function renderSessionList() {
  const container = $("session-list-container");
  if (!container) return;
  
  let list = state.sessions;
  if (state.activeTagFilter) {
    list = list.filter(s => (s.tags || []).includes(state.activeTagFilter));
  }
  
  container.innerHTML = list.map(s => {
    const isActive = s.conversation_id === state.currentSessionId ? "active" : "";
    // 三色状态灯：blue=running, green=idle, red=failed
    let dotClass = "green";
    if (s.status === "running") dotClass = "blue";
    else if (s.status === "failed") dotClass = "red";
    
    const tagsHtml = (s.tags || []).map(t => `<span class="session-tag-badge">#${escapeHtml(t)}</span>`).join(" ");
    
    return `
      <div class="session-item ${isActive}" onclick="selectSession('${s.conversation_id}')">
        <div class="session-item-left">
          <span class="session-status-dot ${dotClass}" title="状态: ${s.status || 'idle'}"></span>
          <span class="session-title-text" id="title-text-${s.conversation_id}">${escapeHtml(s.title || '新对话')}</span>
          ${tagsHtml}
        </div>
        <div class="session-actions" onclick="event.stopPropagation()">
          <button class="session-mini-btn" onclick="promptRenameSession('${s.conversation_id}', '${escapeHtml(s.title)}')">✏️</button>
          <button class="session-mini-btn" onclick="promptAddTag('${s.conversation_id}')">🏷️</button>
          <button class="session-mini-btn" onclick="deleteSession('${s.conversation_id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

async function createNewSession() {
  const convId = "conv-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
  try {
    const res = await apiFetch(`/session/${convId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["coding", "vite"] })
    });
    await loadSessions();
    selectSession(convId);
    showToast("✨ 已创建新会话！");
  } catch (e) {
    state.currentSessionId = convId;
    renderSessionList();
  }
}

async function selectSession(convId) {
  state.currentSessionId = convId;
  renderSessionList();
  await loadSessionMessages(convId);
  await loadShortTermBuffer(convId);
}

async function loadSessionMessages(convId) {
  const box = $("agent-messages-box");
  if (!box) return;
  try {
    const res = await apiFetch(`/session/${convId}/messages`);
    const json = await res.json();
    if (json.code === 0 && Array.isArray(json.data) && json.data.length > 0) {
      box.innerHTML = json.data.map(m => renderMessageBubble(m.role, m.content, m.extra)).join("");
      decorateCodeBlocks(box);
    } else {
      box.innerHTML = `
        <div class="welcome-box">
          <h3>⚡ Vite Coding 多智能体自主编程环境</h3>
          <p>当前会话 ID: <code>${convId}</code>。支持自然语言开发需求、跨会话引用（输入 <code>@</code> 引用其他会话）、多 Agent 自动协同（A 编码 -> B 审查 -> C 跑单测）与 Obsidian 动态图谱。</p>
        </div>
      `;
    }
  } catch (e) { console.error("加载消息失败:", e); }
}

function renderMessageBubble(role, content, extra) {
  const isUser = role === "user";
  const avatar = isUser ? "👤" : (role === "reviewer" ? "🔍" : (role === "tester" ? "🧪" : "👨‍💻"));
  const roleName = isUser ? "开发者 (You)" : (role === "reviewer" ? "Reviewer 审查员" : (role === "tester" ? "Tester 单测工程师" : "Coder 研发工程师"));
  
  return `
    <div class="agent-bubble ${isUser ? 'user' : ''}">
      <div class="agent-bubble-header">
        <span class="agent-name-tag">${avatar} ${roleName}</span>
        <span>${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="bubble-body">${renderMarkdown(content)}</div>
    </div>
  `;
}

async function promptRenameSession(convId, oldTitle) {
  const newTitle = prompt("重命名会话标题:", oldTitle);
  if (newTitle && newTitle.trim()) {
    await apiFetch(`/session/${convId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    await loadSessions();
    showToast("已重命名会话！");
  }
}

async function promptAddTag(convId) {
  const s = state.sessions.find(x => x.conversation_id === convId);
  const current = (s?.tags || []).join(",");
  const tagStr = prompt("输入标签（逗号分隔，如: feat,bugfix,review）:", current);
  if (tagStr !== null) {
    const tags = tagStr.split(",").map(t => t.trim()).filter(Boolean);
    await apiFetch(`/session/${convId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    await loadSessions();
    showToast("已更新会话标签！");
  }
}

async function deleteSession(convId) {
  if (confirm("确定删除该会话记录吗？")) {
    await apiFetch(`/session/${convId}`, { method: "DELETE" });
    if (state.currentSessionId === convId) state.currentSessionId = "";
    await loadSessions();
    showToast("会话已删除");
  }
}

function filterSessionsByTag(tag) {
  state.activeTagFilter = tag;
  const chips = document.querySelectorAll(".tag-filter-chips .tag-chip");
  chips.forEach(c => {
    if (c.textContent.replace("#", "") === (tag || "全部")) c.classList.add("active");
    else c.classList.remove("active");
  });
  renderSessionList();
}

function onSessionSearchInput(query) {
  const q = query.toLowerCase().trim();
  const container = $("session-list-container");
  if (!container) return;
  const items = container.querySelectorAll(".session-item");
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = (!q || text.includes(q)) ? "flex" : "none";
  });
}

// 3. 跨会话引用 (@ 快捷联想与上下文注入)
function checkCitationTrigger(e) {
  const input = $("agent-query-input");
  const val = input.value;
  const lastAt = val.lastIndexOf("@");
  const popover = $("citation-popover");
  
  if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === " " || val[lastAt - 1] === "\n")) {
    const query = val.slice(lastAt + 1).toLowerCase();
    const matches = state.sessions.filter(s => s.conversation_id !== state.currentSessionId && (s.title.toLowerCase().includes(query) || (s.tags || []).some(t => t.includes(query))));
    if (matches.length > 0) {
      popover.classList.remove("hidden");
      $("citation-items-list").innerHTML = matches.slice(0, 5).map(m => `
        <div class="popover-item" onclick="insertCitation('${m.conversation_id}', '${escapeHtml(m.title)}')">
          <span>💬 <b>${escapeHtml(m.title)}</b> (${(m.tags || []).map(t => '#' + t).join(' ')})</span>
          <span style="font-size:10px; color:#64748b;">${m.conversation_id.slice(-6)}</span>
        </div>
      `).join("");
      return;
    }
  }
  popover.classList.add("hidden");
}

function insertCitation(convId, title) {
  const input = $("agent-query-input");
  const val = input.value;
  const lastAt = val.lastIndexOf("@");
  if (lastAt !== -1) {
    input.value = val.slice(0, lastAt) + `@session:${convId} [${title}] ` + val.slice(lastAt + 1);
  }
  $("citation-popover").classList.add("hidden");
  input.focus();
}

// 4. 发送指令与多智能体流 (Parent-Child, Coder -> Reviewer -> Tester)
async function sendAgentMessage() {
  const input = $("agent-query-input");
  const query = input.value.trim();
  if (!query) return;
  input.value = "";
  $("citation-popover").classList.add("hidden");
  
  const box = $("agent-messages-box");
  box.innerHTML += renderMessageBubble("user", query);
  box.scrollTop = box.scrollHeight;
  
  // 更新状态灯为 blue (running)
  await apiFetch(`/session/${state.currentSessionId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "running" }),
  });
  const currentS = state.sessions.find(s => s.conversation_id === state.currentSessionId);
  if (currentS) currentS.status = "running";
  renderSessionList();
  
  // 检查是否触发多 Agent 协同流水线
  const role = $("agent-role-select").value;
  if (role === "architect" || query.includes("多Agent") || query.includes("协同") || query.includes("流水线")) {
    await runMultiAgentCollaboration(query);
  } else {
    await runSingleAgentChat(query, role);
  }
}

async function runMultiAgentCollaboration(query) {
  const box = $("agent-messages-box");
  showToast("🤖 启动多智能体协作流水线 (Coder -> Reviewer -> Tester)...");
  
  try {
    const res = await apiFetch("/api/mesh/collaborate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: state.currentSessionId,
        task_prompt: query,
        target_file: "data/demo_agentic_calc.py"
      }),
    });
    const json = await res.json();
    if (json.code === 0 && json.data?.events) {
      for (const evt of json.data.events) {
        await new Promise(r => setTimeout(r, 600));
        let role = evt.sender || "coder";
        let content = evt.payload?.summary || "";
        if (evt.payload?.code) {
          content += `\n\n\`\`\`python:${evt.payload.file_path || 'data/demo_agentic_calc.py'}\n${evt.payload.code}\n\`\`\``;
        }
        box.innerHTML += renderMessageBubble(role, content);
        decorateCodeBlocks(box);
        box.scrollTop = box.scrollHeight;
      }
      
      // 更新状态灯为 green (idle/done)
      await apiFetch(`/session/${state.currentSessionId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "idle" }),
      });
      if (currentS = state.sessions.find(s => s.conversation_id === state.currentSessionId)) currentS.status = "idle";
      renderSessionList();
      await reloadObsidianGraph();
    }
  } catch (e) {
    showToast("多智能体执行异常: " + e.message);
  }
}

async function runSingleAgentChat(query, role) {
  const box = $("agent-messages-box");
  try {
    const res = await apiFetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: state.currentSessionId,
        query: query,
        project_path: state.currentProject,
        active_file: state.activeFilePath,
      }),
    });
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedText = "";
    
    // 插入临时助手气泡
    const bubbleId = "bubble-" + Date.now();
    box.innerHTML += `
      <div class="agent-bubble" id="${bubbleId}">
        <div class="agent-bubble-header">
          <span class="agent-name-tag">👨‍💻 Coder 研发工程师</span>
          <span>思考并编写中...</span>
        </div>
        <div class="bubble-body" id="${bubbleId}-content"></div>
      </div>
    `;
    box.scrollTop = box.scrollHeight;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.event === "delta" && data.text) {
              accumulatedText += data.text;
              $(`${bubbleId}-content`).innerHTML = renderMarkdown(accumulatedText);
              box.scrollTop = box.scrollHeight;
            }
          } catch (_) {}
        }
      }
    }
    
    decorateCodeBlocks(box);
    
    // 更新状态灯为 green
    await apiFetch(`/session/${state.currentSessionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "idle" }),
    });
    if (currentS = state.sessions.find(s => s.conversation_id === state.currentSessionId)) currentS.status = "idle";
    renderSessionList();
  } catch (e) {
    showToast("生成异常: " + e.message);
  }
}

// 5. 交互式代码操作栏挂载与文件写入
function decorateCodeBlocks(container) {
  const pres = container.querySelectorAll("pre:not([data-decorated])");
  pres.forEach((pre) => {
    pre.setAttribute("data-decorated", "true");
    const code = pre.querySelector("code");
    if (!code) return;
    const rawCode = code.innerText;
    
    // 探测文件名
    let targetFile = state.activeFilePath || "data/demo.py";
    const headerMatch = rawCode.match(/^#\s*(?:file|filepath|path):\s*([^\r\n]+)/i) || code.className.match(/language-python:([^\s]+)/);
    if (headerMatch) targetFile = headerMatch[1].trim();

    const actionBar = document.createElement("div");
    actionBar.className = "agent-code-action-bar";
    actionBar.innerHTML = `
      <span class="agent-target-file">📄 ${escapeHtml(targetFile)}</span>
      <div class="agent-action-buttons">
        <button class="action-pill-green" onclick="applyAgentCodeToProject('${escapeHtml(targetFile)}', this)">✨ 写入磁盘工程</button>
        <button class="action-pill-cyan" onclick="loadCodeToEditor('${escapeHtml(targetFile)}', this)">👁️ 载入编辑器</button>
        <button class="action-pill-amber" onclick="runGeneratedTest('${escapeHtml(targetFile)}')">▶️ 运行单测</button>
      </div>
    `;
    pre.parentNode.insertBefore(actionBar, pre);
  });
}

async function applyAgentCodeToProject(relPath, btn) {
  const pre = btn.closest(".agent-code-action-bar").nextElementSibling;
  const codeEl = pre ? pre.querySelector("code") : null;
  const content = codeEl ? codeEl.innerText : "";
  if (!content) return showToast("未探测到有效代码");
  
  try {
    const res = await apiFetch("/api/projects/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_path: state.currentProject,
        file_path: relPath,
        content: content,
      }),
    });
    const json = await res.json();
    if (json.code === 0) {
      showToast(`✨ 代码已成功写入磁盘工程: [${relPath}]！`);
      state.activeFilePath = relPath;
      state.activeFileContent = content;
      $("active-file-indicator").textContent = relPath;
      $("code-editor-area").value = content;
      switchRightTab("editor");
      await refreshProjectTree();
      await reloadObsidianGraph();
    } else {
      showToast("写入失败: " + (json.message || json.detail));
    }
  } catch (e) { showToast("写入异常: " + e.message); }
}

function loadCodeToEditor(relPath, btn) {
  const pre = btn.closest(".agent-code-action-bar").nextElementSibling;
  const codeEl = pre ? pre.querySelector("code") : null;
  const content = codeEl ? codeEl.innerText : "";
  state.activeFilePath = relPath;
  state.activeFileContent = content;
  $("active-file-indicator").textContent = relPath;
  $("code-editor-area").value = content;
  switchRightTab("editor");
  showToast(`已载入文件 [${relPath}] 到编辑器`);
}

async function runGeneratedTest(relPath) {
  switchRightTab("editor");
  openTerminalDrawer();
  const cmd = relPath.includes("test_") ? `uv run pytest ${relPath} -v` : `uv run pytest tests/ -v`;
  await runWorkspaceCommand(cmd);
}

// 6. 文件树与编辑器控制
async function refreshProjectTree() {
  try {
    const res = await apiFetch(`/api/projects/tree?project_path=${encodeURIComponent(state.currentProject)}`);
    const json = await res.json();
    if (json.code === 0) {
      renderProjectTree(json.data || []);
    }
  } catch (e) { console.error("加载文件树失败:", e); }
}

function renderProjectTree(nodes) {
  const container = $("project-tree-list");
  if (!container) return;
  
  function buildHtml(items, depth = 0) {
    return items.map(item => {
      const indent = depth * 12;
      if (item.type === "directory") {
        return `
          <div class="tree-node-item" style="padding-left: ${indent}px;">
            <span>📁</span> <b>${escapeHtml(item.name)}</b>
          </div>
          ${item.children ? buildHtml(item.children, depth + 1) : ""}
        `;
      } else {
        const isSelected = item.path === state.activeFilePath ? "active" : "";
        return `
          <div class="tree-node-item ${isSelected}" style="padding-left: ${indent}px;" onclick="openProjectFile('${escapeHtml(item.path)}')">
            <span>📄</span> <span>${escapeHtml(item.name)}</span>
          </div>
        `;
      }
    }).join("");
  }
  
  container.innerHTML = buildHtml(nodes);
}

async function openProjectFile(relPath) {
  try {
    const res = await apiFetch(`/api/projects/file?project_path=${encodeURIComponent(state.currentProject)}&file_path=${encodeURIComponent(relPath)}`);
    const json = await res.json();
    if (json.code === 0 && json.data) {
      state.activeFilePath = relPath;
      state.activeFileContent = json.data.content || "";
      $("active-file-indicator").textContent = relPath;
      $("code-editor-area").value = state.activeFileContent;
      switchRightTab("editor");
      renderProjectTree(state.treeNodes || []);
      showToast(`已打开文件: ${relPath}`);
    }
  } catch (e) { showToast("打开文件失败: " + e.message); }
}

async function saveActiveFileCode() {
  if (!state.activeFilePath) return showToast("请先在左侧选择或新建一个文件");
  const content = $("code-editor-area").value;
  try {
    const res = await apiFetch("/api/projects/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_path: state.currentProject,
        file_path: state.activeFilePath,
        content: content,
      }),
    });
    const json = await res.json();
    if (json.code === 0) {
      showToast(`💾 文件已保存: [${state.activeFilePath}]`);
      await reloadObsidianGraph();
    } else {
      showToast("保存失败: " + (json.message || json.detail));
    }
  } catch (e) { showToast("保存异常: " + e.message); }
}

async function runActiveFileCode() {
  if (!state.activeFilePath) return showToast("请先选择要执行的代码文件");
  let cmd = `uv run python ${state.activeFilePath}`;
  if (state.activeFilePath.endsWith(".py") && state.activeFilePath.includes("test_")) {
    cmd = `uv run pytest ${state.activeFilePath} -v`;
  }
  openTerminalDrawer();
  await runWorkspaceCommand(cmd);
}

// 7. 新建文件弹窗
function openNewFileModal() { $("new-file-modal").classList.remove("hidden"); }
function closeNewFileModal() { $("new-file-modal").classList.add("hidden"); }

async function confirmCreateNewFile() {
  const relPath = $("new-file-relpath").value.trim();
  const initContent = $("new-file-init-content").value;
  if (!relPath) return showToast("请输入相对文件路径");
  
  try {
    const res = await apiFetch("/api/projects/create-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_path: state.currentProject,
        file_path: relPath,
        initial_content: initContent,
      }),
    });
    const json = await res.json();
    if (json.code === 0) {
      closeNewFileModal();
      showToast(`✨ 文件 [${relPath}] 创建成功并已载入！`);
      state.activeFilePath = relPath;
      state.activeFileContent = initContent;
      $("active-file-indicator").textContent = relPath;
      $("code-editor-area").value = initContent;
      switchRightTab("editor");
      await refreshProjectTree();
      await reloadObsidianGraph();
    } else {
      showToast("创建失败: " + (json.message || json.detail));
    }
  } catch (e) { showToast("创建异常: " + e.message); }
}

// 8. 终端控制台
function toggleTerminalDrawer() {
  const drawer = $("terminal-drawer");
  drawer.classList.toggle("hidden");
}
function openTerminalDrawer() { $("terminal-drawer").classList.remove("hidden"); }
function clearTerminalOutput() { $("terminal-output").textContent = "// Vite Coding Terminal Ready.\n$ "; }

async function runWorkspaceCommand(cmd) {
  const outputEl = $("terminal-output");
  const badgeEl = $("terminal-status-badge");
  outputEl.textContent += `\n$ ${cmd}\n[执行中...]\n`;
  badgeEl.textContent = "运行中";
  badgeEl.style.color = "#38bdf8";
  
  try {
    const res = await apiFetch("/api/projects/run-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_path: state.currentProject,
        command: cmd,
        timeout_seconds: 40,
      }),
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      const d = json.data;
      const isSuccess = d.exit_code === 0;
      badgeEl.textContent = isSuccess ? "成功" : `退出码: ${d.exit_code}`;
      badgeEl.style.color = isSuccess ? "#10b981" : "#ef4444";
      
      outputEl.textContent += `[完成] 耗时: ${d.duration_seconds}s | 退出码: ${d.exit_code}\n\n${d.stdout || ''}${d.stderr ? '\n[Stderr]\n' + d.stderr : ''}\n$ `;
      outputEl.scrollTop = outputEl.scrollHeight;
    } else {
      outputEl.textContent += `\n[执行错误]: ${json.message || json.detail}\n$ `;
    }
  } catch (e) {
    outputEl.textContent += `\n[网络异常]: ${e.message}\n$ `;
  }
}

// 9. Obsidian 动态知识图谱力导向绘制引擎 (Canvas Force-Directed Simulation)
let graphAnimationId = null;
let graphSimulation = { nodes: [], edges: [], hoveredNode: null };

async function reloadObsidianGraph() {
  try {
    const res = await apiFetch(`/api/graph/project?project_path=${encodeURIComponent(state.currentProject)}`);
    const json = await res.json();
    if (json.code === 0 && json.data) {
      initObsidianGraphCanvas(json.data);
    }
  } catch (e) { console.error("加载知识图谱失败:", e); }
}

function initObsidianGraphCanvas(data) {
  const canvas = $("obsidian-graph-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  const width = canvas.parentElement.clientWidth || 500;
  const height = canvas.parentElement.clientHeight || 400;
  canvas.width = width;
  canvas.height = height;
  
  // 初始化物理节点坐标
  const nodes = data.nodes.map((n, i) => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * (width * 0.7),
    y: height / 2 + (Math.random() - 0.5) * (height * 0.7),
    vx: 0,
    vy: 0,
    radius: n.val || 8,
  }));
  
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const edges = data.edges.map(e => ({
    source: nodeMap.get(e.source),
    target: nodeMap.get(e.target),
    color: e.color || "rgba(255,255,255,0.15)",
    label: e.label
  })).filter(e => e.source && e.target);
  
  graphSimulation = { nodes, edges, hoveredNode: null };
  
  if (graphAnimationId) cancelAnimationFrame(graphAnimationId);
  
  function step() {
    ctx.clearRect(0, 0, width, height);
    
    // 物理力模拟 (斥力 + 弹力 + 中心重力)
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      // 中心引力
      a.vx += (width / 2 - a.x) * 0.0005;
      a.vy += (height / 2 - a.y) * 0.0005;
      
      // 节点间斥力
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 180) {
          const force = (180 - dist) / dist * 0.02;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }
    }
    
    // 连线弹力
    for (const edge of edges) {
      const dx = edge.target.x - edge.source.x;
      const dy = edge.target.y - edge.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 70) * 0.003;
      edge.source.vx += dx * force;
      edge.source.vy += dy * force;
      edge.target.vx -= dx * force;
      edge.target.vy -= dy * force;
    }
    
    // 绘制连线
    for (const edge of edges) {
      ctx.beginPath();
      ctx.moveTo(edge.source.x, edge.source.y);
      ctx.lineTo(edge.target.x, edge.target.y);
      ctx.strokeStyle = edge.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // 更新位置并绘制节点
    for (const n of nodes) {
      n.x += n.vx * 0.85;
      n.y += n.vy * 0.85;
      n.vx *= 0.85;
      n.vy *= 0.85;
      
      // 边界约束
      n.x = Math.max(20, Math.min(width - 20, n.x));
      n.y = Math.max(20, Math.min(height - 20, n.y));
      
      // 节点发光晕环
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = (n.color || "#6366f1") + "33";
      ctx.fill();
      
      // 实体圆点
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = n.color || "#6366f1";
      ctx.fill();
      
      // 标签文字：仅悬浮节点或关键节点高亮显示，与 Obsidian 一致保持纯净星空美感
      if (n === graphSimulation.hoveredNode || n.type === "project" || n.type === "commit" || nodes.length <= 25) {
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillStyle = n === graphSimulation.hoveredNode ? "#38bdf8" : "#cbd5e1";
        ctx.fillText(n.label, n.x + n.radius + 4, n.y + 4);
      }
    }
    
    graphAnimationId = requestAnimationFrame(step);
  }
  
  step();
  
  // 鼠标交互：点击节点打开文件
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = nodes.find(n => {
      const dx = n.x - mx;
      const dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
    });
    canvas.style.cursor = hit ? "pointer" : "default";
    graphSimulation.hoveredNode = hit;
  };
  
  canvas.onclick = () => {
    if (graphSimulation.hoveredNode && graphSimulation.hoveredNode.path) {
      openProjectFile(graphSimulation.hoveredNode.path);
      showToast(`🎯 图谱定位: ${graphSimulation.hoveredNode.details || graphSimulation.hoveredNode.label}`);
    }
  };
}

// 10. 分层记忆中心 (短期上下文 + 长期语义规范)
async function loadLongTermMemories() {
  try {
    const res = await apiFetch("/api/memory/long-term/list");
    const json = await res.json();
    if (json.code === 0) {
      renderLongTermMemories(json.data || []);
    }
  } catch (e) { console.error("加载长期记忆失败:", e); }
}

function renderLongTermMemories(memories) {
  const container = $("long-term-memory-list");
  if (!container) return;
  container.innerHTML = memories.map(m => `
    <div class="memory-card">
      <div class="mem-title">💡 ${escapeHtml(m.title)} <span style="font-size:10px; color:#a5b4fc;">[${m.category}]</span></div>
      <div class="mem-content">${escapeHtml(m.content)}</div>
    </div>
  `).join("");
}

async function onMemorySearch(query) {
  try {
    const res = await apiFetch(`/api/memory/search?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (json.code === 0) {
      renderLongTermMemories(json.data || []);
    }
  } catch (e) {}
}

async function loadShortTermBuffer(convId) {
  try {
    const res = await apiFetch(`/api/memory/short-term/${convId}`);
    const json = await res.json();
    const box = $("short-term-buffer-display");
    if (box) {
      if (json.code === 0 && json.data && json.data.length > 0) {
        box.textContent = JSON.stringify(json.data, null, 2);
      } else {
        box.textContent = "// 当前会话短期记忆缓存已就绪，记录多轮开发上下文与临时代码片段。";
      }
    }
  } catch (e) {}
}

function openAddMemoryModal() { $("add-memory-modal").classList.remove("hidden"); }
function closeAddMemoryModal() { $("add-memory-modal").classList.add("hidden"); }

async function confirmAddMemory() {
  const category = $("new-mem-category").value.trim() || "architecture";
  const title = $("new-mem-title").value.trim();
  const content = $("new-mem-content").value.trim();
  const tags = ($("new-mem-tags").value || "").split(",").map(t => t.trim()).filter(Boolean);
  if (!title || !content) return showToast("请填写规范标题与内容");
  
  try {
    const res = await apiFetch("/api/memory/long-term/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title, content, tags }),
    });
    const json = await res.json();
    if (json.code === 0) {
      closeAddMemoryModal();
      showToast("✨ 长期记忆/规范已持久化！");
      await loadLongTermMemories();
    }
  } catch (e) { showToast("添加记忆异常: " + e.message); }
}

// 11. 视图与 Tab 切换
function switchRightTab(tabName) {
  ["editor", "graph", "memory"].forEach(t => {
    $(`pane-${t}`).classList.toggle("active", t === tabName);
    $(`tab-btn-${t}`).classList.toggle("active", t === tabName);
  });
  if (tabName === "graph") reloadObsidianGraph();
}

function toggleRightTab(tabName) {
  switchRightTab(tabName);
}

function applyPromptChip(text) {
  const input = $("agent-query-input");
  input.value = text;
  input.focus();
}

function setupEventListeners() {
  const input = $("agent-query-input");
  if (input) {
    input.addEventListener("input", checkCitationTrigger);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendAgentMessage();
      }
    });
  }
  
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveActiveFileCode();
    }
  });
}

function renderMarkdown(md) {
  if (!md) return "";
  let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```([a-zA-Z0-9_\-\.:]*)[\r\n]+([\s\S]*?)```/g, (_, lang, code) => {
    const cleanCode = code.trim();
    return `<pre><code class="language-${lang}">${cleanCode}</code></pre>`;
  });
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^\*]+)\*\*/g, "<b>$1</b>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

window.addEventListener("DOMContentLoaded", initApp);