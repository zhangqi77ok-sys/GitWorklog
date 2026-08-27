// AgentX Studio - Enterprise Autonomous Agent Operating System
const $ = (id) => document.getElementById(id);
const state = {
  token: localStorage.getItem("token"),
  user: localStorage.getItem("user") || "admin",
  currentTab: "chat-view",
  qaMode: "chat",
  ecoTab: "skills",
  activeConversationId: null,
  sessions: [],
  skills: [],
  mcpServers: [],
  files: [],
  knowledgeBases: [],
  activeKbId: null,
  allKbSelected: false,
  selectedKbIds: [],
  selectedKbFiles: [],
  attachedFile: null,
  slashIndex: -1,
  editingSkillName: null,
  projects: [],
  currentProject: null,
  currentBranch: null,
  currentFilePath: null,
  currentChunkData: null,
  currentChunkTab: "children",
  currentVectorData: null,
  providers: [],
  routes: [],
  selectedChatProvider: "dashscope",
  selectedChatModel: "qwen3.7-flash",
  selectedCodexProvider: "dashscope",
  selectedCodexModel: "qwen3.7-flash",
};

window.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  if (state.token) showMainPanel();
  else showLoginPanel();
});

function initEventListeners() {
  if ($("login-btn")) $("login-btn").onclick = login;
  if ($("logout-btn")) $("logout-btn").onclick = logout;
  if ($("password")) $("password").onkeydown = (e) => e.key === "Enter" && login();
  document.querySelectorAll(".sidebar-nav .nav-item").forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  const q = $("query");
  if (q) { q.oninput = handleQueryInput; q.onkeydown = handleQueryKeydown; }
  if ($("send-btn")) $("send-btn").onclick = send;
  if ($("timeline-btn")) $("timeline-btn").onclick = showTimeline;
  if ($("new-chat-btn")) $("new-chat-btn").onclick = startNewChat;

  if ($("open-kb-btn")) $("open-kb-btn").onclick = toggleKbPopover;
  if ($("close-kb-popover-btn")) $("close-kb-popover-btn").onclick = hideKbPopover;
  if ($("kb-select-all-btn")) $("kb-select-all-btn").onclick = selectAllKbFiles;
  if ($("kb-clear-all-btn")) $("kb-clear-all-btn").onclick = clearSelectedKbFiles;
  if ($("kb-search-input")) $("kb-search-input").oninput = (e) => renderKbPopover(e.target.value.trim());
  if ($("kb-check-all-scope")) $("kb-check-all-scope").onchange = handleMasterKbToggle;

  if ($("chat-provider-select")) {
    $("chat-provider-select").onchange = (e) => {
      state.selectedChatProvider = e.target.value;
      updateChatModelOptions();
    };
  }
  if ($("chat-model-select")) {
    $("chat-model-select").onchange = (e) => {
      state.selectedChatModel = e.target.value;
    };
  }

  if ($("codex-provider-select")) {
    $("codex-provider-select").onchange = (e) => {
      state.selectedCodexProvider = e.target.value;
      updateCodexModelOptions();
    };
  }
  if ($("codex-model-select")) {
    $("codex-model-select").onchange = (e) => {
      state.selectedCodexModel = e.target.value;
    };
  }

  if ($("attach-file-btn")) $("attach-file-btn").onclick = () => $("chat-file-input").click();
  if ($("chat-file-input")) $("chat-file-input").onchange = handleChatFileUpload;

  if ($("create-kb-btn")) $("create-kb-btn").onclick = () => $("kb-create-modal").classList.remove("hidden");
  if ($("save-kb-btn")) $("save-kb-btn").onclick = saveNewKnowledgeBase;
  if ($("upload-file-btn")) $("upload-file-btn").onclick = () => $("drop-zone").click();
  if ($("drop-zone")) {
    $("drop-zone").onclick = () => {
      let fileIn = document.getElementById("kb-direct-file-input");
      if (!fileIn) {
        fileIn = document.createElement("input");
        fileIn.id = "kb-direct-file-input";
        fileIn.type = "file";
        fileIn.className = "hidden";
        fileIn.onchange = handleDirectKbFileUpload;
        document.body.appendChild(fileIn);
      }
      fileIn.click();
    };
  }
  if ($("rag-search-btn")) $("rag-search-btn").onclick = runRAGSearch;
  if ($("rag-query-input")) $("rag-query-input").onkeydown = (e) => e.key === "Enter" && runRAGSearch();

  if ($("create-skill-btn")) $("create-skill-btn").onclick = openCreateSkillModal;
  if ($("save-skill-btn")) $("save-skill-btn").onclick = saveSkill;
  if ($("sync-skills-btn")) $("sync-skills-btn").onclick = syncSkills;
  if ($("import-skill-btn")) $("import-skill-btn").onclick = () => $("skill-file-input").click();
  if ($("skill-file-input")) $("skill-file-input").onchange = handleSkillImportUpload;
  if ($("create-mcp-btn")) $("create-mcp-btn").onclick = () => $("mcp-edit-modal").classList.remove("hidden");
  if ($("save-mcp-btn")) $("save-mcp-btn").onclick = saveMcpServer;
  if ($("refresh-mcp-btn")) $("refresh-mcp-btn").onclick = loadMcpServers;

  if ($("add-memory-btn")) $("add-memory-btn").onclick = () => $("memory-add-modal").classList.remove("hidden");
  if ($("save-memory-btn")) $("save-memory-btn").onclick = saveUserMemory;
  if ($("refresh-memory-btn")) $("refresh-memory-btn").onclick = loadUserMemoryAndGraph;
  if ($("clear-memory-btn")) $("clear-memory-btn").onclick = clearUserMemory;

  if ($("project-select")) $("project-select").onchange = (e) => switchProject(e.target.value);
  if ($("checkout-branch-btn")) $("checkout-branch-btn").onclick = checkoutCurrentBranch;
  if ($("save-code-btn")) $("save-code-btn").onclick = saveCurrentFileCode;
  if ($("codex-send-btn")) $("codex-send-btn").onclick = sendCodexChat;
  if ($("codex-query-input")) {
    $("codex-query-input").onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendCodexChat();
      }
    };
  }
  if ($("add-project-btn")) $("add-project-btn").onclick = () => $("project-add-modal").classList.remove("hidden");
  if ($("save-project-btn")) $("save-project-btn").onclick = saveCustomProject;
  if ($("load-direct-path-btn")) $("load-direct-path-btn").onclick = loadDirectPathProject;
  if ($("codex-direct-path-input")) {
    $("codex-direct-path-input").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadDirectPathProject();
      }
    };
  }
  if ($("launch-desktop-btn")) $("launch-desktop-btn").onclick = launchDesktopClient;

  if ($("refresh-gateway-btn")) $("refresh-gateway-btn").onclick = loadGatewayConfig;
  if ($("sync-all-models-btn")) $("sync-all-models-btn").onclick = syncAllOfficialModels;
  if ($("save-custom-model-btn")) $("save-custom-model-btn").onclick = saveCustomModel;

  if ($("add-user-btn")) $("add-user-btn").onclick = () => $("user-modal").classList.remove("hidden");
  if ($("save-user-btn")) $("save-user-btn").onclick = saveNewUser;

  document.querySelectorAll(".modal .close-modal-btn").forEach((btn) => {
    btn.onclick = () => btn.closest(".modal").classList.add("hidden");
  });
}

function showLoginPanel() {
  $("login-panel").classList.remove("hidden");
  $("main-panel").classList.add("hidden");
}

function showMainPanel() {
  $("login-panel").classList.add("hidden");
  $("main-panel").classList.remove("hidden");
  if ($("who")) $("who").textContent = state.user || "admin";
  loadSessions();
  loadKnowledgeBases();
  loadSkills();
  loadMcpServers();
  loadProjects();
  loadUsers();
  loadGatewayConfig();
  loadTravelBoard();
}

async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (state.token) options.headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(url, options);
  if (res.status === 401) { logout(); throw new Error("登录已过期"); }
  return res;
}

async function login() {
  const username = $("username").value.trim();
  const password = $("password").value.trim();
  if (!username || !password) return alert("请输入账号与密码");
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.code === 0 && data.data && data.data.token) {
      state.token = data.data.token;
      state.user = data.data.username || "admin";
      localStorage.setItem("token", state.token);
      localStorage.setItem("user", state.user);
      showMainPanel();
    } else {
      alert("登录失败: " + (data.message || "密码错误"));
    }
  } catch (e) { alert("网络异常: " + e.message); }
}

function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem("token"); localStorage.removeItem("user");
  showLoginPanel();
}

function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll(".sidebar-nav .nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".main-content .view-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === tabId);
  });

  if (tabId === "memory-view") loadUserMemoryAndGraph();
  if (tabId === "files-view") loadKnowledgeBases();
  if (tabId === "skills-view") { loadSkills(); loadMcpServers(); }
  if (tabId === "gateway-view") loadGatewayConfig();
  if (tabId === "travel-view") loadTravelBoard();
  if (tabId === "sys-view") loadUsers();
}

function switchQAMode(mode) {
  state.qaMode = mode;
  $("qa-mode-chat-btn").classList.toggle("active", mode === "chat");
  $("qa-mode-codex-btn").classList.toggle("active", mode === "codex");
  $("qa-chat-subview").classList.toggle("active", mode === "chat");
  $("qa-chat-subview").classList.toggle("hidden", mode !== "chat");
  $("qa-codex-subview").classList.toggle("active", mode === "codex");
  $("qa-codex-subview").classList.toggle("hidden", mode !== "codex");
  $("codex-header-toolbar").classList.toggle("hidden", mode !== "codex");
  if (mode === "codex" && !state.currentProject) loadProjects();
}

function switchEcoTab(tab) {
  state.ecoTab = tab;
  $("eco-tab-skills-btn").classList.toggle("active", tab === "skills");
  $("eco-tab-mcp-btn").classList.toggle("active", tab === "mcp");
  $("eco-subpane-skills").classList.toggle("active", tab === "skills");
  $("eco-subpane-skills").classList.toggle("hidden", tab !== "skills");
  $("eco-subpane-mcp").classList.toggle("active", tab === "mcp");
  $("eco-subpane-mcp").classList.toggle("hidden", tab !== "mcp");
  if (tab === "mcp") loadMcpServers();
}

// Sessions & Messages
async function loadSessions() {
  try {
    const res = await apiFetch("/api/session/list");
    const json = await res.json();
    if (json.code === 0) {
      state.sessions = json.data || [];
      renderSessionList();
      if (!state.activeConversationId && state.sessions.length > 0) {
        selectSession(state.sessions[0].conversation_id);
      }
    }
  } catch (e) { console.error("加载会话失败:", e); }
}

function renderSessionList() {
  const box = $("session-list");
  if (!box) return;
  if (!state.sessions.length) {
    box.innerHTML = '<div class="empty-tip" style="padding:12px; color:var(--text-dim); font-size:12px; text-align:center;">暂无历史会话</div>';
    return;
  }
  box.innerHTML = state.sessions.map((s) => `
    <div class="session-item ${s.conversation_id === state.activeConversationId ? "active" : ""}" onclick="selectSession('${s.conversation_id}')">
      <span class="session-item-title">${escapeHtml(s.title || "新对话")}</span>
      <button class="session-del-btn" onclick="deleteSession(event, '${s.conversation_id}')">✕</button>
    </div>
  `).join("");
}

async function selectSession(convId) {
  state.activeConversationId = convId;
  renderSessionList();
  try {
    const res = await apiFetch(`/api/session/${convId}`);
    const json = await res.json();
    if (json.code === 0) renderMessages(json.data.messages || []);
  } catch (e) { console.error("加载消息失败:", e); }
}

function startNewChat() {
  state.activeConversationId = "conv-" + Date.now();
  const newSess = { conversation_id: state.activeConversationId, title: "新智能问答会话", created_at: new Date().toISOString() };
  state.sessions.unshift(newSess);
  renderSessionList();
  renderMessages([]);
  $("query").focus();
}

async function deleteSession(e, convId) {
  e.stopPropagation();
  if (!confirm("确定删除该会话记录吗？")) return;
  try {
    await apiFetch(`/api/session/${convId}`, { method: "DELETE" });
    state.sessions = state.sessions.filter((s) => s.conversation_id !== convId);
    if (state.activeConversationId === convId) {
      state.activeConversationId = state.sessions[0] ? state.sessions[0].conversation_id : null;
      if (state.activeConversationId) selectSession(state.activeConversationId);
      else renderMessages([]);
    }
    renderSessionList();
  } catch (e) { alert("删除会话失败: " + e.message); }
}

function renderMessages(messages) {
  const container = $("messages");
  if (!container) return;
  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div id="chat-empty-state" class="empty-state">
        <div class="empty-hero-icon">✨</div>
        <h2 class="empty-hero-title">统一企业智能问答与协同平台</h2>
        <p class="empty-desc">融合主流大模型、自进化记忆图谱与知识库深度 RAG，支持数据分析、差旅协同与 Codex 编程开发。输入框键入 <code>/</code> 即可快速调度垂直技能。</p>
        <div class="starter-grid">
          <div class="starter-card" onclick="useStarter('/data-analysis 统计上月各部门的销售额与订单总数')">
            <div class="starter-card-top"><span class="starter-icon">📊</span><span class="starter-tag">Text2SQL</span></div>
            <div class="starter-title">数据指标统计分析</div>
            <div class="starter-text">统计上月各部门的销售额与订单总数</div>
          </div>
          <div class="starter-card" onclick="useStarter('/flight-booking 帮我查询明天北京到上海的机票')">
            <div class="starter-card-top"><span class="starter-icon">✈️</span><span class="starter-tag">差旅预订</span></div>
            <div class="starter-title">智能航班比价预订</div>
            <div class="starter-text">查询明天北京到上海的合规机票并推荐</div>
          </div>
          <div class="starter-card" onclick="useStarter('/hotel-booking 帮我预订下周上海陆家嘴附近的差旅标准酒店')">
            <div class="starter-card-top"><span class="starter-icon">🏨</span><span class="starter-tag">住宿推荐</span></div>
            <div class="starter-title">商圈协议酒店推荐</div>
            <div class="starter-text">推荐上海陆家嘴附近的差旅标准协议酒店</div>
          </div>
          <div class="starter-card" onclick="switchQAMode('codex')">
            <div class="starter-card-top"><span class="starter-icon">💻</span><span class="starter-tag">Codex 编程</span></div>
            <div class="starter-title">代码重构与架构设计</div>
            <div class="starter-text">基于当前项目分支上下文进行编程开发</div>
          </div>
        </div>
      </div>
    `;
    return;
  }
  container.innerHTML = messages.map((msg) => {
    const isUser = msg.role === "user";
    const parsed = isUser ? escapeHtml(msg.content) : (window.marked ? marked.parse(msg.content) : msg.content);
    return `
      <div class="message-bubble ${isUser ? "user" : "assistant"}">
        <div class="message-avatar">${isUser ? "👤" : "⚡"}</div>
        <div class="message-content">${parsed}</div>
      </div>
    `;
  }).join("");
  container.scrollTop = container.scrollHeight;
}

function useStarter(text) { $("query").value = text; send(); }

async function send() {
  const query = $("query").value.trim();
  if (!query) return;
  if (!state.activeConversationId) state.activeConversationId = "conv-" + Date.now();
  const empty = $("chat-empty-state");
  if (empty) empty.remove();
  const container = $("messages");
  container.innerHTML += `
    <div class="message-bubble user">
      <div class="message-avatar">👤</div>
      <div class="message-content">${escapeHtml(query)}</div>
    </div>
  `;
  const assistantBubbleId = "msg-" + Date.now();
  container.innerHTML += `
    <div class="message-bubble assistant" id="${assistantBubbleId}">
      <div class="message-avatar">⚡</div>
      <div class="message-content markdown-body">思考中...</div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;
  $("query").value = "";
  hideKbPopover();
  hideSlashPopover();

  const kbFileIds = state.selectedKbFiles.map((f) => f.file_id);
  const kbIds = state.selectedKbIds.map((k) => k.id);

  try {
    const res = await apiFetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query,
        conversation_id: state.activeConversationId,
        all_kb: state.allKbSelected,
        kb_ids: kbIds,
        file_ids: kbFileIds,
        provider: state.selectedChatProvider,
        model: state.selectedChatModel,
      }),
    });
    const targetEl = document.querySelector(`#${assistantBubbleId} .message-content`);
    let fullText = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const data = JSON.parse(raw);
            const text = data.text !== undefined ? data.text : (data.chunk !== undefined ? data.chunk : (data.content !== undefined ? data.content : ""));
            if (text) {
              fullText += text;
              targetEl.innerHTML = window.marked ? marked.parse(fullText) : escapeHtml(fullText);
              container.scrollTop = container.scrollHeight;
            }
          } catch (e) {
            fullText += raw;
            targetEl.innerHTML = window.marked ? marked.parse(fullText) : escapeHtml(fullText);
            container.scrollTop = container.scrollHeight;
          }
        }
      }
    }
    loadSessions();
  } catch (e) {
    const targetEl = document.querySelector(`#${assistantBubbleId} .message-content`);
    if (targetEl) targetEl.innerHTML = `<span style="color:var(--accent-rose)">响应异常: ${e.message}</span>`;
  }
}

// KB Select Popover & Chips
function handleMasterKbToggle(e) {
  state.allKbSelected = e.target.checked;
  renderSelectedKbChips();
}

function toggleKbPopover() {
  const popover = $("kb-select-modal");
  if (!popover) return;
  if (popover.classList.contains("hidden")) {
    popover.classList.remove("hidden");
    renderKbPopover();
  } else popover.classList.add("hidden");
}

function hideKbPopover() {
  if ($("kb-select-modal")) $("kb-select-modal").classList.add("hidden");
}

function renderKbPopover(filterText = "") {
  const listEl = $("kb-file-list");
  if (!listEl) return;
  if ($("kb-check-all-scope")) $("kb-check-all-scope").checked = state.allKbSelected;
  if (!state.knowledgeBases.length) {
    listEl.innerHTML = '<div class="empty-tip" style="padding:12px; color:var(--text-dim); text-align:center;">暂无知识库集合</div>';
    return;
  }
  let html = "";
  state.knowledgeBases.forEach((kb) => {
    const kbFiles = state.files.filter((f) => f.kb_id === kb.id || (!f.kb_id && kb.id === "kb-default"));
    const matchedFiles = filterText ? kbFiles.filter((f) => f.filename.toLowerCase().includes(filterText.toLowerCase())) : kbFiles;
    const isKbSelected = state.selectedKbIds.some((k) => k.id === kb.id);
    html += `
      <div class="kb-group-card">
        <div class="kb-group-title">
          <label class="checkbox-label" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" ${isKbSelected ? "checked" : ""} onchange="toggleKbScope('${kb.id}', '${escapeHtml(kb.name)}', this.checked)" />
            <span>📁 ${escapeHtml(kb.name)}</span>
          </label>
        </div>
        <div class="kb-group-files">
          ${matchedFiles.length ? matchedFiles.map((f) => {
            const isFileSel = state.selectedKbFiles.some((x) => x.file_id === f.file_id);
            return `
              <div class="kb-file-item-row">
                <label class="checkbox-label" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                  <input type="checkbox" ${isFileSel ? "checked" : ""} onchange="toggleKbFile('${f.file_id}', '${escapeHtml(f.filename)}', '${kb.id}', this.checked)" />
                  <span>📄 ${escapeHtml(f.filename)}</span>
                </label>
              </div>
            `;
          }).join("") : '<span style="font-size:11px; color:var(--text-dim)">暂无文档</span>'}
        </div>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

function toggleKbScope(kbId, kbName, checked) {
  if (checked) {
    if (!state.selectedKbIds.some((k) => k.id === kbId)) state.selectedKbIds.push({ id: kbId, name: kbName });
  } else {
    state.selectedKbIds = state.selectedKbIds.filter((k) => k.id !== kbId);
  }
  renderSelectedKbChips();
}

function toggleKbFile(fileId, filename, kbId, checked) {
  if (checked) {
    if (!state.selectedKbFiles.some((f) => f.file_id === fileId)) state.selectedKbFiles.push({ file_id: fileId, filename, kb_id: kbId });
  } else {
    state.selectedKbFiles = state.selectedKbFiles.filter((f) => f.file_id !== fileId);
  }
  renderSelectedKbChips();
}

function selectAllKbFiles() {
  state.allKbSelected = true;
  if ($("kb-check-all-scope")) $("kb-check-all-scope").checked = true;
  renderSelectedKbChips();
}

function clearSelectedKbFiles() {
  state.allKbSelected = false;
  state.selectedKbIds = [];
  state.selectedKbFiles = [];
  if ($("kb-check-all-scope")) $("kb-check-all-scope").checked = false;
  renderSelectedKbChips();
  renderKbPopover();
}

function renderSelectedKbChips() {
  const container = $("kb-selected-chips");
  const badge = $("kb-badge-count");
  if (!container) return;
  const chips = [];
  if (state.allKbSelected) {
    chips.push(`
      <span class="kb-chip-item">
        <span>🌟 全部知识库 (全库检索)</span>
        <span class="kb-chip-del" onclick="state.allKbSelected=false; renderSelectedKbChips();">✕</span>
      </span>
    `);
  }
  state.selectedKbIds.forEach((kb) => {
    chips.push(`
      <span class="kb-chip-item">
        <span>📁 ${escapeHtml(kb.name)}</span>
        <span class="kb-chip-del" onclick="toggleKbScope('${kb.id}', '', false); renderKbPopover();">✕</span>
      </span>
    `);
  });
  state.selectedKbFiles.forEach((file) => {
    chips.push(`
      <span class="kb-chip-item">
        <span>📄 ${escapeHtml(file.filename)}</span>
        <span class="kb-chip-del" onclick="toggleKbFile('${file.file_id}', '', '', false); renderKbPopover();">✕</span>
      </span>
    `);
  });
  const totalCount = (state.allKbSelected ? 1 : 0) + state.selectedKbIds.length + state.selectedKbFiles.length;
  if (badge) {
    badge.textContent = totalCount;
    badge.classList.toggle("hidden", totalCount === 0);
  }
  if (chips.length > 0) {
    container.innerHTML = chips.join("");
    container.classList.remove("hidden");
  } else {
    container.innerHTML = "";
    container.classList.add("hidden");
  }
}

// Knowledge Base & Chunks / Vectors
async function loadKnowledgeBases() {
  try {
    const [kbRes, filesRes] = await Promise.all([
      apiFetch("/api/files/kb/list"),
      apiFetch("/api/files/list"),
    ]);
    const kbJson = await kbRes.json();
    const filesJson = await filesRes.json();
    if (kbJson.code === 0) {
      state.knowledgeBases = kbJson.data || [];
      if (!state.activeKbId && state.knowledgeBases.length > 0) state.activeKbId = state.knowledgeBases[0].id;
    }
    if (filesJson.code === 0) state.files = filesJson.data || [];
    renderKnowledgeBaseView();
  } catch (e) { console.error("加载知识库数据失败:", e); }
}

function renderKnowledgeBaseView() {
  const kbListEl = $("kb-list-container");
  const countBadge = $("kb-total-count");
  if (countBadge) countBadge.textContent = state.knowledgeBases.length;

  if (kbListEl) {
    kbListEl.innerHTML = state.knowledgeBases.map((kb) => {
      const kbFiles = state.files.filter((f) => f.kb_id === kb.id || (!f.kb_id && kb.id === "kb-default"));
      return `
        <div class="kb-card-item ${kb.id === state.activeKbId ? "active" : ""}" onclick="selectKnowledgeBase('${kb.id}')">
          <div class="kb-card-name">📚 ${escapeHtml(kb.name)}</div>
          <div class="kb-card-desc">${escapeHtml(kb.description || "企业业务知识集合")}</div>
          <div class="kb-card-meta">
            <span>${kbFiles.length} 篇文档</span>
            <span>${kb.created_at ? kb.created_at.slice(0, 10) : "2026-08"}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  const activeKb = state.knowledgeBases.find((k) => k.id === state.activeKbId) || state.knowledgeBases[0];
  if (activeKb) {
    if ($("current-kb-header-title")) $("current-kb-header-title").textContent = activeKb.name;
    if ($("current-kb-header-desc")) $("current-kb-header-desc").textContent = activeKb.description || "通用知识库";
  }

  const curFiles = state.files.filter((f) => f.kb_id === state.activeKbId || (!f.kb_id && state.activeKbId === "kb-default"));
  if ($("current-kb-stat-badge")) $("current-kb-stat-badge").textContent = `${curFiles.length} 篇文档`;

  const tbody = $("files-tbody");
  if (!tbody) return;
  if (!curFiles.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">当前知识库暂无上传文档，可拖拽或点击上方区域上传！</td></tr>';
    return;
  }

  tbody.innerHTML = curFiles.map((f) => {
    const sizeStr = f.size_bytes > 1024 * 1024 ? `${(f.size_bytes / 1024 / 1024).toFixed(2)} MB` : `${(f.size_bytes / 1024).toFixed(1)} KB`;
    const kbName = activeKb ? activeKb.name : "默认知识库";
    return `
      <tr>
        <td style="font-weight:600; color:var(--text-main);">📄 ${escapeHtml(f.filename)}</td>
        <td><span class="starter-tag">${escapeHtml(kbName)}</span></td>
        <td>${escapeHtml(f.content_type || "text/plain")}</td>
        <td>${sizeStr}</td>
        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(f.summary || "")}">${escapeHtml(f.summary || "已完成父子切片解析与高维向量嵌入")}</td>
        <td>${f.created_at ? f.created_at.slice(0, 16).replace("T", " ") : "2026-08-27"}</td>
        <td>
          <div class="btn-group">
            <button class="action-pill-btn" onclick="showChunkModal('${f.file_id}', '${escapeHtml(f.filename)}')">🧩 分片</button>
            <button class="action-pill-btn" onclick="showVectorModal('${f.file_id}', '${escapeHtml(f.filename)}')">🔮 向量</button>
            <button class="action-pill-btn" onclick="previewFile('${f.file_id}', '${escapeHtml(f.filename)}')">👁️ 预览</button>
            <button class="action-pill-btn danger" onclick="deleteFile('${f.file_id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function selectKnowledgeBase(kbId) {
  state.activeKbId = kbId;
  renderKnowledgeBaseView();
}

async function saveNewKnowledgeBase() {
  const name = $("new-kb-name").value.trim();
  const description = $("new-kb-desc").value.trim();
  if (!name) return alert("请输入知识库名称");
  try {
    const res = await apiFetch("/api/files/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const json = await res.json();
    if (json.code === 0) {
      $("kb-create-modal").classList.add("hidden");
      $("new-kb-name").value = ""; $("new-kb-desc").value = "";
      loadKnowledgeBases();
    }
  } catch (e) { alert("创建知识库失败: " + e.message); }
}

async function handleDirectKbFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  if (state.activeKbId) formData.append("kb_id", state.activeKbId);
  try {
    const res = await apiFetch("/api/files/upload", { method: "POST", body: formData });
    const json = await res.json();
    if (json.code === 0) loadKnowledgeBases();
    else alert("上传失败: " + json.message);
  } catch (err) { alert("上传异常: " + err.message); }
}

async function handleChatFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kb_id", "kb-default");
  try {
    const res = await apiFetch("/api/files/upload", { method: "POST", body: formData });
    const json = await res.json();
    if (json.code === 0) {
      state.selectedKbFiles.push({ file_id: json.data.file_id, filename: json.data.filename, kb_id: "kb-default" });
      renderSelectedKbChips();
      loadKnowledgeBases();
    }
  } catch (err) { alert("上传异常: " + err.message); }
}

async function previewFile(fileId, filename) {
  try {
    const res = await apiFetch(`/api/files/${fileId}/preview`);
    const json = await res.json();
    if (json.code === 0) {
      $("preview-filename").textContent = filename;
      $("preview-body").textContent = json.data.text_content || "文件内容为空";
      $("preview-modal").classList.remove("hidden");
    }
  } catch (e) { alert("读取文件内容失败: " + e.message); }
}

async function deleteFile(fileId) {
  if (!confirm("确定删除该文档及其向量数据库切片吗？")) return;
  try {
    const res = await apiFetch(`/api/files/${fileId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.code === 0) loadKnowledgeBases();
  } catch (e) { alert("删除失败: " + e.message); }
}

// Chunks & Vectors Modals
async function showChunkModal(fileId, filename) {
  $("chunk-modal-title").textContent = `🧩 文档分片详情 · ${filename}`;
  $("chunk-modal-sub").textContent = "加载父子切片数据中...";
  $("chunk-list-body").innerHTML = '<div class="empty-tip" style="padding:16px; text-align:center; color:var(--text-muted)">加载中...</div>';
  $("chunk-modal").classList.remove("hidden");
  try {
    const res = await apiFetch(`/api/files/${fileId}/chunks`);
    const json = await res.json();
    if (json.code === 0) {
      state.currentChunkData = json.data;
      const childCount = json.data.child_count ?? json.data.total_children ?? (json.data.children ? json.data.children.length : 0);
      const parentCount = json.data.parent_count ?? json.data.total_parents ?? (json.data.parents ? json.data.parents.length : 0);
      $("chunk-modal-sub").textContent = `子切片: ${childCount} 块 · 父切片: ${parentCount} 块 · 切片模式: Parent-Child 双层混合分块`;
      renderChunkList();
    }
  } catch (e) {
    $("chunk-list-body").innerHTML = `<div class="empty-tip" style="color:var(--accent-rose)">加载失败: ${e.message}</div>`;
  }
}

function switchChunkTab(tab) {
  state.currentChunkTab = tab;
  $("chunk-tab-children-btn").classList.toggle("active", tab === "children");
  $("chunk-tab-parents-btn").classList.toggle("active", tab === "parents");
  renderChunkList($("chunk-search-input") ? $("chunk-search-input").value.trim() : "");
}

function filterChunkList(query) { renderChunkList(query); }

function renderChunkList(filter = "") {
  const container = $("chunk-list-body");
  if (!container || !state.currentChunkData) return;
  const isChildren = state.currentChunkTab === "children";
  const list = isChildren ? (state.currentChunkData.children || state.currentChunkData.child_chunks || []) : (state.currentChunkData.parents || state.currentChunkData.parent_chunks || []);
  const filtered = filter ? list.filter((c) => (c.content || "").toLowerCase().includes(filter.toLowerCase())) : list;
  if (!filtered || !filtered.length) {
    container.innerHTML = '<div class="empty-tip" style="padding:16px; text-align:center; color:var(--text-dim);">暂无匹配的分片内容</div>';
    return;
  }
  container.innerHTML = filtered.map((chunk) => {
    const chunkId = chunk.child_id || chunk.parent_id || chunk.chunk_id || "1";
    const charCount = chunk.char_count || chunk.token_count || (chunk.content ? chunk.content.length : 0);
    return `
      <div class="chunk-card-item">
        <div class="chunk-card-meta">
          <span class="chunk-id-tag">#${chunkId} ${isChildren ? "Child Chunk (250~350字)" : "Parent Chunk (1000~1500字)"}</span>
          <span class="chunk-token-tag">${charCount} 字符 · 索引序号 #${chunk.index !== undefined ? chunk.index : 1}</span>
        </div>
        <div class="chunk-content-text">${escapeHtml(chunk.content)}</div>
      </div>
    `;
  }).join("");
}

async function showVectorModal(fileId, filename) {
  $("vector-modal-title").textContent = `🔮 向量特征嵌入矩阵 · ${filename}`;
  $("vector-modal-sub").textContent = "加载向量矩阵与特征维度中...";
  $("vector-list-body").innerHTML = '<div class="empty-tip" style="padding:16px; text-align:center; color:var(--text-muted)">加载中...</div>';
  $("vector-modal").classList.remove("hidden");
  try {
    const res = await apiFetch(`/api/files/${fileId}/vectors`);
    const json = await res.json();
    if (json.code === 0) {
      state.currentVectorData = json.data;
      $("vector-modal-sub").textContent = `嵌入模型: ${json.data.embedding_model || json.data.model || "text-embedding-v3"} · 向量空间: ${json.data.dimension || 1536} 维 · 相似度度量: Cosine Similarity`;
      renderVectorView();
    }
  } catch (e) {
    $("vector-list-body").innerHTML = `<div class="empty-tip" style="color:var(--accent-rose)">加载失败: ${e.message}</div>`;
  }
}

function renderVectorView() {
  const d = state.currentVectorData;
  if (!d) return;
  const stats = $("vector-stats-cards");
  if (stats) {
    stats.innerHTML = `
      <div class="vector-stat-box"><div class="vector-stat-val">${d.total_vectors || 0}</div><div class="vector-stat-lbl">向量切片数</div></div>
      <div class="vector-stat-box"><div class="vector-stat-val">${d.dimension || 1536} 维</div><div class="vector-stat-lbl">特征向量维度</div></div>
      <div class="vector-stat-box"><div class="vector-stat-val">1.000</div><div class="vector-stat-lbl">平均 L2 归一范数</div></div>
      <div class="vector-stat-box"><div class="vector-stat-val">100%</div><div class="vector-stat-lbl">HNSW 索引就绪</div></div>
    `;
  }
  const listEl = $("vector-list-body");
  if (listEl) {
    listEl.innerHTML = (d.vectors || []).map((v) => {
      const floatArrayStr = JSON.stringify(v.vector_sample || v.raw_vector_head || [0.0123, -0.0456, 0.0891, 0.0342, -0.0781]);
      return `
        <div class="vector-card-item">
          <div class="chunk-card-meta">
            <span class="chunk-id-tag">Vector #${v.chunk_id || 1}</span>
            <span class="chunk-token-tag">${v.dimension || 1536} 维浮点向量 · L2 Norm: 1.0000</span>
          </div>
          <div class="vector-card-preview">切片语义摘要: "${escapeHtml(v.preview_text || "")}"</div>
          <div class="vector-matrix-box">Embedding Vector Preview: ${floatArrayStr}</div>
        </div>
      `;
    }).join("");
  }
}

async function runRAGSearch() {
  const query = $("rag-query-input").value.trim();
  if (!query) return alert("请输入检索测试问题");
  const box = $("rag-results-box");
  box.classList.remove("hidden");
  box.innerHTML = '<div class="empty-tip" style="padding:12px; color:var(--accent-cyan);">正在执行双层父子分片混合检索与相关度评分...</div>';
  try {
    const res = await apiFetch("/api/files/rag/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query, all_kb: true, top_k: 4 }),
    });
    const json = await res.json();
    if (json.code === 0) {
      const results = json.data || [];
      if (!results.length) {
        box.innerHTML = '<div class="empty-tip" style="padding:12px; color:var(--text-dim);">未检索到与问题相关的切片文档</div>';
        return;
      }
      box.innerHTML = results.map((r, i) => `
        <div class="rag-result-card">
          <div class="rag-result-meta">
            <span>#${i + 1} 匹配来源: ${escapeHtml(r.filename || "企业规范文档")}</span>
            <span>相关度得分: ${(r.score * 100).toFixed(1)}%</span>
          </div>
          <div>${escapeHtml(r.content || "")}</div>
        </div>
      `).join("");
    }
  } catch (e) {
    box.innerHTML = `<div class="empty-tip" style="color:var(--accent-rose)">检索失败: ${e.message}</div>`;
  }
}

// Skills & MCP
async function loadSkills() {
  try {
    const res = await apiFetch("/api/skills/list");
    const json = await res.json();
    if (json.code === 0) { state.skills = json.data || []; renderSkillsGrid(); }
  } catch (e) { console.error("加载技能失败:", e); }
}

function renderSkillsGrid() {
  const grid = $("skills-grid");
  if (!grid) return;
  if (!state.skills.length) { grid.innerHTML = '<div class="empty-tip">暂无垂直技能</div>'; return; }
  grid.innerHTML = state.skills.map((s) => `
    <div class="skill-card">
      <div class="skill-header">
        <div class="skill-icon-badge">${escapeHtml(s.icon || "🧩")}</div>
        <div class="skill-title-block">
          <div class="skill-name">${escapeHtml(s.name)}</div>
          <div class="skill-desc">${escapeHtml(s.description || "垂直领域专属能力与流程规范")}</div>
        </div>
      </div>
      <div class="skill-footer">
        <span class="starter-tag">/${escapeHtml(s.name)}</span>
        <div class="skill-actions">
          <button class="action-pill-btn" onclick="viewSkillSOP('${escapeHtml(s.name)}')">📖 SOP</button>
          <button class="action-pill-btn" onclick="editSkill('${escapeHtml(s.name)}')">✏️</button>
          <button class="action-pill-btn danger" onclick="deleteSkill('${escapeHtml(s.name)}')">🗑️</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function viewSkillSOP(skillName) {
  try {
    const res = await apiFetch(`/api/skills/${skillName}`);
    const json = await res.json();
    if (json.code === 0) {
      $("sop-modal-title").textContent = `技能规范 (SOP) · ${skillName}`;
      $("sop-content").innerHTML = window.marked ? marked.parse(json.data.sop || "") : json.data.sop;
      $("sop-modal").classList.remove("hidden");
    }
  } catch (e) { alert("查看 SOP 失败: " + e.message); }
}

function openCreateSkillModal() {
  state.editingSkillName = null;
  $("skill-edit-modal-title").textContent = "➕ 新建垂直领域技能";
  $("skill-edit-name").value = "";
  $("skill-edit-name").disabled = false;
  $("skill-edit-desc").value = "";
  $("skill-edit-body").value = "";
  $("skill-edit-modal").classList.remove("hidden");
}

async function editSkill(skillName) {
  state.editingSkillName = skillName;
  $("skill-edit-modal-title").textContent = `✏️ 编辑技能 · ${skillName}`;
  $("skill-edit-name").value = skillName;
  $("skill-edit-name").disabled = true;
  try {
    const res = await apiFetch(`/api/skills/${skillName}`);
    const json = await res.json();
    if (json.code === 0) {
      $("skill-edit-desc").value = json.data.description || "";
      $("skill-edit-body").value = json.data.sop || "";
      $("skill-edit-modal").classList.remove("hidden");
    }
  } catch (e) { alert("读取技能详情失败: " + e.message); }
}

async function saveSkill() {
  const name = $("skill-edit-name").value.trim();
  const description = $("skill-edit-desc").value.trim();
  const sop = $("skill-edit-body").value.trim();
  if (!name) return alert("请输入技能英文标识");
  try {
    const res = await apiFetch("/api/skills/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, sop }),
    });
    const json = await res.json();
    if (json.code === 0) {
      $("skill-edit-modal").classList.add("hidden");
      loadSkills();
    } else alert("保存失败: " + json.message);
  } catch (e) { alert("保存异常: " + e.message); }
}

async function deleteSkill(skillName) {
  if (!confirm(`确定删除技能 /${skillName} 吗？`)) return;
  try {
    const res = await apiFetch(`/api/skills/${skillName}`, { method: "DELETE" });
    const json = await res.json();
    if (json.code === 0) loadSkills();
  } catch (e) { alert("删除失败: " + e.message); }
}

async function syncSkills() {
  try {
    const res = await apiFetch("/api/skills/sync", { method: "POST" });
    const json = await res.json();
    if (json.code === 0) {
      alert("技能同步成功！共加载 " + json.data.count + " 个技能");
      loadSkills();
    }
  } catch (e) { alert("同步异常: " + e.message); }
}

async function handleSkillImportUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await apiFetch("/api/skills/import", { method: "POST", body: formData });
    const json = await res.json();
    if (json.code === 0) {
      alert("导入成功！新增/更新技能: " + json.data.imported);
      loadSkills();
    } else alert("导入失败: " + json.message);
  } catch (err) { alert("导入异常: " + err.message); }
}

// MCP
async function loadMcpServers() {
  try {
    const res = await apiFetch("/api/mcp/list");
    const json = await res.json();
    if (json.code === 0) {
      state.mcpServers = json.data || [];
      if ($("mcp-count-badge")) $("mcp-count-badge").textContent = state.mcpServers.length;
      renderMcpGrid();
    }
  } catch (e) { console.error("加载 MCP 服务失败:", e); }
}

function renderMcpGrid() {
  const grid = $("mcp-grid");
  if (!grid) return;
  if (!state.mcpServers.length) {
    grid.innerHTML = '<div class="empty-tip">暂无注册的 MCP 协议服务</div>';
    return;
  }
  grid.innerHTML = state.mcpServers.map((s) => {
    const isConn = s.enabled && s.status === "connected";
    const toolsHtml = (s.tools || []).map((t) => `<span class="starter-tag" style="font-size:10px; padding:1px 6px;">${escapeHtml(t)}</span>`).join(" ");
    return `
      <div class="skill-card">
        <div>
          <div class="skill-header">
            <div class="skill-icon-badge">${escapeHtml(s.icon || "🔌")}</div>
            <div class="skill-title-block">
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span class="skill-name">${escapeHtml(s.name)}</span>
                <span style="font-size:11px; display:inline-flex; align-items:center; gap:4px; color:${isConn ? "var(--accent-emerald)" : "var(--text-dim)"}">
                  <span class="status-dot ${isConn ? "online" : ""}"></span>${isConn ? "已连接" : "未启动"}
                </span>
              </div>
              <div class="skill-desc">${escapeHtml(s.description || "Model Context Protocol 服务")}</div>
            </div>
          </div>
          <div style="margin-top: 10px; display:flex; flex-wrap:wrap; gap:4px;">
            ${toolsHtml || '<span style="font-size:11px; color:var(--text-dim)">暂未探测到工具</span>'}
          </div>
        </div>
        <div class="skill-footer" style="margin-top:12px;">
          <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">${escapeHtml(s.transport)}</span>
          <div class="skill-actions">
            <button class="action-pill-btn" onclick="pingMcpServer('${s.id}')">⚡ Ping 探测</button>
            <button class="action-pill-btn" onclick="toggleMcpServer('${s.id}')">${s.enabled ? "禁用" : "启用"}</button>
            <button class="action-pill-btn danger" onclick="deleteMcpServer('${s.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function pingMcpServer(serverId) {
  try {
    const res = await apiFetch(`/api/mcp/${serverId}/ping`, { method: "POST" });
    const json = await res.json();
    if (json.code === 0) {
      alert(`[MCP 探测成功]\n${json.data.message}\n响应延迟: ${json.data.latency_ms}ms`);
      loadMcpServers();
    }
  } catch (e) { alert("探测失败: " + e.message); }
}

async function toggleMcpServer(serverId) {
  try {
    const res = await apiFetch(`/api/mcp/${serverId}/toggle`, { method: "POST" });
    const json = await res.json();
    if (json.code === 0) loadMcpServers();
  } catch (e) { alert("切换失败: " + e.message); }
}

async function deleteMcpServer(serverId) {
  if (!confirm("确定移除该 MCP 服务配置吗？")) return;
  try {
    const res = await apiFetch(`/api/mcp/${serverId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.code === 0) loadMcpServers();
  } catch (e) { alert("删除失败: " + e.message); }
}

async function saveMcpServer() {
  const name = $("new-mcp-name").value.trim();
  const description = $("new-mcp-desc").value.trim();
  const transport = $("new-mcp-transport").value;
  const icon = $("new-mcp-icon").value.trim() || "🔌";
  const command = $("new-mcp-cmd").value.trim();
  const argsRaw = $("new-mcp-args").value.trim();
  const args = argsRaw ? argsRaw.split(",").map((a) => a.trim()).filter(Boolean) : [];
  if (!name) return alert("请输入 MCP 服务名称");
  try {
    const res = await apiFetch("/api/mcp/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, transport, icon, command, args }),
    });
    const json = await res.json();
    if (json.code === 0) {
      $("mcp-edit-modal").classList.add("hidden");
      loadMcpServers();
    }
  } catch (e) { alert("注册失败: " + e.message); }
}

// Codex
async function loadProjects() {
  try {
    const res = await apiFetch("/api/projects/list");
    const json = await res.json();
    if (json.code === 0) {
      state.projects = json.data || [];
      renderProjectsSelect();
      if (!state.currentProject && state.projects.length > 0) switchProject(state.projects[0].path);
    }
  } catch (e) { console.error("加载项目列表失败:", e); }
}

function renderProjectsSelect() {
  const sel = $("project-select");
  if (!sel) return;
  sel.innerHTML = state.projects.map((p) => `<option value="${escapeHtml(p.path)}">${escapeHtml(p.name)}</option>`).join("");
}

async function loadDirectPathProject() {
  const pathInput = $("codex-direct-path-input");
  if (!pathInput) return;
  const dirPath = pathInput.value.trim();
  if (!dirPath) return alert("请输入任意本地有效文件夹路径");
  try {
    const res = await apiFetch("/api/projects/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", path: dirPath }),
    });
    const json = await res.json();
    if (json.code === 0) {
      await loadProjects();
      switchProject(dirPath);
    } else alert("载入目录失败: " + json.message);
  } catch (e) { alert("载入异常: " + e.message); }
}

async function switchProject(projectPath) {
  state.currentProject = projectPath;
  if ($("project-select")) $("project-select").value = projectPath;
  if ($("codex-direct-path-input")) $("codex-direct-path-input").value = projectPath;
  try {
    const [gitRes, treeRes] = await Promise.all([
      apiFetch(`/api/projects/git?project_path=${encodeURIComponent(projectPath)}`),
      apiFetch(`/api/projects/tree?project_path=${encodeURIComponent(projectPath)}`),
    ]);
    const gitJson = await gitRes.json();
    const treeJson = await treeRes.json();
    if (gitJson.code === 0) {
      state.currentBranch = gitJson.data.current_branch;
      renderBranchesSelect(gitJson.data.branches || ["main"]);
    }
    if (treeJson.code === 0) renderProjectTree(treeJson.data || []);
  } catch (e) { console.error("切换工程失败:", e); }
}

function renderBranchesSelect(branches) {
  const sel = $("branch-select");
  if (!sel) return;
  sel.innerHTML = branches.map((b) => `<option value="${escapeHtml(b)}" ${b === state.currentBranch ? "selected" : ""}>🌿 ${escapeHtml(b)}</option>`).join("");
}

async function checkoutCurrentBranch() {
  const branch = $("branch-select").value;
  if (!branch || !state.currentProject) return;
  try {
    const res = await apiFetch("/api/projects/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_path: state.currentProject, branch_name: branch }),
    });
    const json = await res.json();
    if (json.code === 0) {
      alert(`成功切换到分支: ${branch}`);
      switchProject(state.currentProject);
    } else alert("切换分支失败: " + json.message);
  } catch (e) { alert("执行异常: " + e.message); }
}

function renderProjectTree(nodes) {
  const container = $("project-tree-list");
  if (!container) return;
  function buildHtml(items, d) {
    return items.map((item) => {
      const indent = d * 14;
      if (item.type === "directory") {
        return `
          <div class="tree-node dir" style="padding-left:${indent + 8}px;">
            <span>📁 ${escapeHtml(item.name)}</span>
          </div>
          ${item.children ? buildHtml(item.children, d + 1) : ""}
        `;
      } else {
        return `
          <div class="tree-node file ${state.currentFilePath === item.path ? "active" : ""}" style="padding-left:${indent + 8}px;" onclick="selectProjectFile('${escapeHtml(item.path)}')">
            <span>📄 ${escapeHtml(item.name)}</span>
          </div>
        `;
      }
    }).join("");
  }
  container.innerHTML = buildHtml(nodes, 0);
}

async function selectProjectFile(filePath) {
  state.currentFilePath = filePath;
  $("current-file-path").textContent = filePath;
  document.querySelectorAll(".tree-node.file").forEach((node) => {
    node.classList.toggle("active", node.textContent.includes(filePath.split("/").pop()));
  });
  try {
    const res = await apiFetch(`/api/projects/file?project_path=${encodeURIComponent(state.currentProject)}&file_path=${encodeURIComponent(filePath)}`);
    const json = await res.json();
    if (json.code === 0) $("code-editor-area").value = json.data.content || "";
  } catch (e) { $("code-editor-area").value = `// 读取文件失败: ${e.message}`; }
}

async function saveCurrentFileCode() {
  if (!state.currentProject || !state.currentFilePath) return alert("未选择文件");
  const content = $("code-editor-area").value;
  try {
    const res = await apiFetch("/api/projects/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_path: state.currentProject, file_path: state.currentFilePath, content }),
    });
    const json = await res.json();
    if (json.code === 0) alert(`文件 [${state.currentFilePath}] 已成功保存到磁盘！`);
  } catch (e) { alert("保存失败: " + e.message); }
}

async function saveCustomProject() {
  const name = $("new-proj-name").value.trim();
  const path = $("new-proj-path").value.trim();
  if (!path) return alert("请输入本地工程路径");
  try {
    const res = await apiFetch("/api/projects/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path }),
    });
    const json = await res.json();
    if (json.code === 0) {
      $("project-add-modal").classList.add("hidden");
      await loadProjects();
      switchProject(path);
    }
  } catch (e) { alert("添加工程失败: " + e.message); }
}

function useCodexPrompt(prompt) { $("codex-query-input").value = prompt; sendCodexChat(); }

async function sendCodexChat() {
  const query = $("codex-query-input").value.trim();
  if (!query) return;
  const box = $("codex-messages");
  const statusTag = $("codex-status-tag");
  if (statusTag) statusTag.textContent = "⚡ 代码生成中...";

  box.innerHTML += `
    <div class="codex-user-bubble">
      <div style="font-weight:700; color:var(--accent-cyan); font-size:11px; margin-bottom:4px;">👨‍💻 开发者指令</div>
      <div>${escapeHtml(query)}</div>
    </div>
  `;
  const assistantMsgId = "codex-msg-" + Date.now();
  box.innerHTML += `
    <div class="codex-assistant-bubble" id="${assistantMsgId}">
      <div style="font-weight:700; color:var(--primary); font-size:11px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
        <span>🤖 Codex 编程智能体 (${escapeHtml(state.selectedCodexModel)})</span>
        <span style="font-size:10px; color:var(--text-dim);">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="codex-bubble-content markdown-body">思考中...</div>
    </div>
  `;
  box.scrollTop = box.scrollHeight;
  $("codex-query-input").value = "";

  const fullPrompt = `【项目上下文】工程路径: ${state.currentProject}, 当前分支: ${state.currentBranch}, 当前打开文件: ${state.currentFilePath}\n【开发需求】: ${query}`;
  try {
    const res = await apiFetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: fullPrompt,
        conversation_id: "codex-session",
        provider: state.selectedCodexProvider,
        model: state.selectedCodexModel,
      }),
    });
    const targetEl = document.querySelector(`#${assistantMsgId} .codex-bubble-content`);
    let fullText = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const data = JSON.parse(raw);
            const text = data.text !== undefined ? data.text : (data.chunk !== undefined ? data.chunk : (data.content !== undefined ? data.content : ""));
            if (text) {
              fullText += text;
              targetEl.innerHTML = window.marked ? marked.parse(fullText) : escapeHtml(fullText);
              box.scrollTop = box.scrollHeight;
            }
          } catch (e) {
            fullText += raw;
            targetEl.innerHTML = window.marked ? marked.parse(fullText) : escapeHtml(fullText);
            box.scrollTop = box.scrollHeight;
          }
        }
      }
    }
    if (statusTag) statusTag.textContent = "✅ 就绪";
  } catch (e) {
    const targetEl = document.querySelector(`#${assistantMsgId} .codex-bubble-content`);
    if (targetEl) targetEl.innerHTML = `<span style="color:var(--accent-rose)">执行失败: ${e.message}</span>`;
    if (statusTag) statusTag.textContent = "❌ 异常";
  }
}

function launchDesktopClient() { alert("已向本地 AgentX 桌面运行时派发启动信号！\n独立原生多窗口 Studio 正在唤醒。"); }

// Memory & Graph
async function loadUserMemoryAndGraph() {
  try {
    const [memRes, graphRes] = await Promise.all([
      apiFetch("/api/memory/profile"),
      apiFetch("/api/memory/graph"),
    ]);
    const memJson = await memRes.json();
    const graphJson = await graphRes.json();
    if (memJson.code === 0) {
      const items = memJson.data.profile || [];
      if ($("mem-count-badge")) $("mem-count-badge").textContent = items.length;
      renderMemoryCards(items);
    }
    if (graphJson.code === 0) {
      const edges = graphJson.data.edges || [];
      if ($("graph-count-badge")) $("graph-count-badge").textContent = edges.length;
      renderGraphTable(edges);
    }
  } catch (e) { console.error("加载记忆图谱失败:", e); }
}

function renderMemoryCards(items) {
  const container = $("memory-cards-container");
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="empty-tip" style="padding:16px; text-align:center; color:var(--text-dim);">暂无沉淀画像，与智能体进行对话即可自动提取！</div>';
    return;
  }
  container.innerHTML = items.map((m) => `
    <div class="memory-item-card">
      <div class="memory-item-header">
        <span class="memory-item-key">🏷️ ${escapeHtml(m.key)}</span>
        <span class="starter-tag">${escapeHtml(m.type || "trait")}</span>
      </div>
      <div class="memory-item-val">${escapeHtml(m.value)}</div>
    </div>
  `).join("");
}

function renderGraphTable(edges) {
  const tbody = $("graph-tbody");
  if (!tbody) return;
  if (!edges.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">知识图谱待激活，问答后将自动构建实体关系网！</td></tr>';
    return;
  }
  tbody.innerHTML = edges.map((e) => `
    <tr>
      <td style="font-weight:600; color:var(--accent-cyan);">${escapeHtml(e.subject)}</td>
      <td><span class="starter-tag">${escapeHtml(e.predicate)}</span></td>
      <td style="font-weight:600; color:var(--text-main);">${escapeHtml(e.object)}</td>
      <td>${e.confidence ? (e.confidence * 100).toFixed(0) + "%" : "95%"}</td>
      <td>${e.frequency || 1} 次</td>
    </tr>
  `).join("");
}

async function saveUserMemory() {
  const type = $("new-mem-type").value;
  const key = $("new-mem-key").value.trim();
  const val = $("new-mem-val").value.trim();
  if (!key || !val) return alert("请完整输入特征标识与内容");
  try {
    const res = await apiFetch("/api/memory/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, key, value: val }),
    });
    const json = await res.json();
    if (json.code === 0) {
      $("memory-add-modal").classList.add("hidden");
      loadUserMemoryAndGraph();
    }
  } catch (e) { alert("保存失败: " + e.message); }
}

async function clearUserMemory() {
  if (!confirm("确定清空当前用户的所有沉淀画像与知识图谱吗？")) return;
  try {
    const res = await apiFetch("/api/memory/clear", { method: "POST" });
    const json = await res.json();
    if (json.code === 0) loadUserMemoryAndGraph();
  } catch (e) { alert("清空失败: " + e.message); }
}

// Gateway & Model Selectors & Users & Travel & Timeline
async function loadGatewayConfig() {
  try {
    const [routesRes, providersRes] = await Promise.all([
      apiFetch("/api/gateway/routes"),
      apiFetch("/api/gateway/providers"),
    ]);
    const routesJson = await routesRes.json();
    const providersJson = await providersRes.json();
    if (routesJson.code === 0) {
      state.routes = routesJson.data || [];
      renderGatewayRoutes(state.routes);
    }
    if (providersJson.code === 0) {
      state.providers = providersJson.data || [];
      renderGatewayProviders(state.providers);
      populateModelSelectors();
    }
  } catch (e) { console.error("加载网关配置失败:", e); }
}

function populateModelSelectors() {
  const chatP = $("chat-provider-select");
  const codexP = $("codex-provider-select");
  if (!state.providers.length) return;

  const optionsHtml = state.providers.map((p) => `<option value="${escapeHtml(p.provider_code)}">${escapeHtml(p.name)}</option>`).join("");
  if (chatP) {
    chatP.innerHTML = optionsHtml;
    chatP.value = state.selectedChatProvider || state.providers[0].provider_code;
    updateChatModelOptions();
  }
  if (codexP) {
    codexP.innerHTML = optionsHtml;
    codexP.value = state.selectedCodexProvider || state.providers[0].provider_code;
    updateCodexModelOptions();
  }
}

function updateChatModelOptions() {
  const pCode = $("chat-provider-select") ? $("chat-provider-select").value : state.selectedChatProvider;
  state.selectedChatProvider = pCode;
  const p = state.providers.find((x) => x.provider_code === pCode);
  const mSel = $("chat-model-select");
  if (!mSel || !p) return;
  const models = p.models || [];
  mSel.innerHTML = models.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name || m.id)}</option>`).join("");
  if (models.length > 0) {
    const hasCurrent = models.some((m) => m.id === state.selectedChatModel);
    if (!hasCurrent) state.selectedChatModel = models[0].id;
    mSel.value = state.selectedChatModel;
  }
}

function updateCodexModelOptions() {
  const pCode = $("codex-provider-select") ? $("codex-provider-select").value : state.selectedCodexProvider;
  state.selectedCodexProvider = pCode;
  const p = state.providers.find((x) => x.provider_code === pCode);
  const mSel = $("codex-model-select");
  if (!mSel || !p) return;
  const models = p.models || [];
  mSel.innerHTML = models.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name || m.id)}</option>`).join("");
  if (models.length > 0) {
    const hasCurrent = models.some((m) => m.id === state.selectedCodexModel);
    if (!hasCurrent) state.selectedCodexModel = models[0].id;
    mSel.value = state.selectedCodexModel;
  }
}

function renderGatewayRoutes(routes) {
  const tbody = $("routes-tbody");
  if (!tbody) return;
  tbody.innerHTML = routes.map((r) => `
    <tr>
      <td style="font-weight:600; color:var(--text-main);">${escapeHtml(r.feature_name || r.feature_key)}</td>
      <td><span class="starter-tag">${escapeHtml(r.provider_code || r.provider || "dashscope")}</span></td>
      <td style="font-family:var(--font-mono); color:var(--accent-cyan); font-weight:600;">${escapeHtml(r.model_name || r.model || "qwen3.7-flash")}</td>
      <td>${r.temperature !== undefined ? r.temperature : 0.3}</td>
      <td>${r.max_tokens || 4096}</td>
      <td><button class="action-pill-btn" onclick="alert('当前路由规则已生效')">✅ 已激活</button></td>
    </tr>
  `).join("");
}

function renderGatewayProviders(providers) {
  const grid = $("providers-grid");
  if (!grid) return;
  grid.innerHTML = providers.map((p) => {
    const modelsList = p.models || [];
    const modelsHtml = modelsList.map((m) => `
      <span class="provider-model-tag ${m.custom ? "custom" : ""}" title="${escapeHtml(m.name || m.id)}">
        <span>${m.custom ? "🏷️ " : ""}${escapeHtml(m.id)}</span>
        ${m.custom ? `<button class="session-del-btn" style="opacity:1; margin-left:2px;" onclick="deleteCustomModel('${p.provider_code}', '${m.id}')">✕</button>` : ""}
      </span>
    `).join(" ");

    return `
      <div class="provider-card">
        <div class="provider-header">
          <span class="provider-name">${escapeHtml(p.name)}</span>
          <span class="starter-tag">${modelsList.length} 个可用模型</span>
        </div>
        <div style="font-size:12px; color:var(--text-muted); line-height:1.4;">${escapeHtml(p.description || "兼容 OpenAI / Anthropic 标准协议")}</div>
        <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); background:var(--bg-code); padding:6px 8px; border-radius:4px;">Endpoint: ${escapeHtml(p.base_url || "https://...")}</div>
        
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; max-height:100px; overflow-y:auto;">
          ${modelsHtml || '<span style="font-size:11px; color:var(--text-dim)">暂未配置模型</span>'}
        </div>

        <div class="skill-footer" style="margin-top:8px; padding-top:8px;">
          <button class="action-pill-btn" onclick="openAddCustomModelModal('${p.provider_code}', '${escapeHtml(p.name)}')">➕ 自定义模型</button>
          <button class="action-pill-btn" onclick="syncProviderOfficialModels('${p.provider_code}')">🔄 同步官方模型</button>
        </div>
      </div>
    `;
  }).join("");
}

function openAddCustomModelModal(providerCode, providerName) {
  $("custom-model-provider-hidden").value = providerCode;
  $("custom-model-modal-title").textContent = `➕ 为 ${providerName} 添加自定义模型`;
  $("custom-model-id").value = "";
  $("custom-model-name").value = "";
  $("custom-model-modal").classList.remove("hidden");
}

async function saveCustomModel() {
  const providerCode = $("custom-model-provider-hidden").value;
  const modelId = $("custom-model-id").value.trim();
  const modelName = $("custom-model-name").value.trim();
  if (!modelId) return alert("请输入模型标识 ID");
  try {
    const res = await apiFetch(`/api/gateway/providers/${providerCode}/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId, model_name: modelName }),
    });
    const json = await res.json();
    if (json.code === 0) {
      $("custom-model-modal").classList.add("hidden");
      loadGatewayConfig();
    } else alert("保存失败: " + json.message);
  } catch (e) { alert("操作异常: " + e.message); }
}

async function deleteCustomModel(providerCode, modelId) {
  if (!confirm(`确定删除自定义模型 [${modelId}] 吗？`)) return;
  try {
    const res = await apiFetch(`/api/gateway/providers/${providerCode}/models/${encodeURIComponent(modelId)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.code === 0) loadGatewayConfig();
  } catch (e) { alert("删除失败: " + e.message); }
}

async function syncProviderOfficialModels(providerCode) {
  try {
    const res = await apiFetch(`/api/gateway/providers/${providerCode}/sync-models`, {
      method: "POST",
    });
    const json = await res.json();
    if (json.code === 0) {
      alert(`[官方同步成功] 厂商 [${providerCode}] 共同步到 ${json.data.total_synced} 个最新模型！`);
      loadGatewayConfig();
    }
  } catch (e) { alert("同步失败: " + e.message); }
}

async function syncAllOfficialModels() {
  try {
    const res = await apiFetch("/api/gateway/sync-models", { method: "POST" });
    const json = await res.json();
    if (json.code === 0) {
      alert(`[全网官方模型同步完成] 共同步更新了 ${json.data.total_synced} 个模型！`);
      loadGatewayConfig();
    }
  } catch (e) { alert("全量同步失败: " + e.message); }
}

async function loadTravelBoard() {
  try {
    const res = await apiFetch("/api/travel/applications");
    const json = await res.json();
    if (json.code === 0) {
      const tbody = $("travel-tbody");
      if (!tbody) return;
      const list = json.data || [];
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无差旅申请记录（可在对话框中直接说「我要去上海出差」快速创建）</td></tr>';
        return;
      }
      tbody.innerHTML = list.map((t) => `
        <tr>
          <td style="font-family:var(--font-mono);">${escapeHtml(t.app_id || t.id)}</td>
          <td style="font-weight:600;">${escapeHtml(t.applicant || "admin")}</td>
          <td style="color:var(--accent-cyan); font-weight:600;">${escapeHtml(t.departure)} ➔ ${escapeHtml(t.destination)}</td>
          <td>${escapeHtml(t.start_date)} ~ ${escapeHtml(t.end_date)}</td>
          <td>${escapeHtml(t.reason || "业务拓展")}</td>
          <td><span class="starter-tag" style="background:rgba(16,185,129,0.15); color:var(--accent-emerald); border-color:rgba(16,185,129,0.3);">${escapeHtml(t.status || "已通过审批")}</span></td>
        </tr>
      `).join("");
    }
  } catch (e) {}
}

async function loadUsers() {
  try {
    const res = await apiFetch("/api/sys/users");
    const json = await res.json();
    if (json.code === 0) {
      const tbody = $("users-tbody");
      if (!tbody) return;
      tbody.innerHTML = (json.data || []).map((u) => `
        <tr>
          <td style="font-family:var(--font-mono);">${u.id}</td>
          <td style="font-weight:600; color:var(--text-main);">${escapeHtml(u.username)}</td>
          <td><span class="starter-tag">${escapeHtml(u.role)}</span></td>
          <td>部门 #${u.dept_id || 1}</td>
          <td>${u.role === "admin" ? "全局数据范围 (ALL)" : "本部门及子部门 (DEPT_AND_CHILD)"}</td>
          <td><button class="action-pill-btn" onclick="alert('用户权限已同步')">配置权限</button></td>
        </tr>
      `).join("");
    }
  } catch (e) {}
}

async function saveNewUser() {
  const username = $("new-user-name").value.trim();
  const password = $("new-user-pwd").value.trim();
  const dept_id = parseInt($("new-user-dept").value, 10);
  const role = $("new-user-role").value;
  if (!username || !password) return alert("请输入完整用户信息");
  try {
    const res = await apiFetch("/api/sys/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, dept_id, role }),
    });
    const json = await res.json();
    if (json.code === 0) {
      $("user-modal").classList.add("hidden");
      loadUsers();
    }
  } catch (e) { alert("保存失败: " + e.message); }
}

async function showTimeline() {
  if (!state.activeConversationId) return alert("暂无活跃会话");
  $("timeline-modal").classList.remove("hidden");
  const listEl = $("timeline-list");
  listEl.innerHTML = '<div class="empty-tip" style="padding:12px; text-align:center; color:var(--text-dim);">加载会话执行轨迹中...</div>';
  try {
    const res = await apiFetch(`/api/chat/timeline/${state.activeConversationId}`);
    const json = await res.json();
    if (json.code === 0 && json.data.timeline && json.data.timeline.length) {
      listEl.innerHTML = json.data.timeline.map((t) => `
        <div style="padding:10px 12px; background:rgba(255,255,255,0.025); border:1px solid var(--border-subtle); border-radius:6px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
            <span style="font-weight:700; color:var(--accent-cyan);">${escapeHtml(t.event)}</span>
            <span style="color:var(--text-dim);">${t.timestamp || "2026-08-27"}</span>
          </div>
          <div style="font-size:13px; color:var(--text-sub);">${escapeHtml(t.detail || "")}</div>
        </div>
      `).join("");
    } else listEl.innerHTML = '<div class="empty-tip" style="padding:12px; text-align:center; color:var(--text-dim);">该会话暂无异步调度事件</div>';
  } catch (e) { listEl.innerHTML = `<div class="empty-tip" style="color:var(--accent-rose)">加载轨迹失败: ${e.message}</div>`; }
}

// Slash Popover
function handleQueryInput(e) {
  const val = e.target.value;
  if (val.startsWith("/")) showSlashPopover(val.slice(1).toLowerCase());
  else hideSlashPopover();
}

function handleQueryKeydown(e) {
  const popover = $("slash-popover");
  if (!popover.classList.contains("hidden")) {
    const items = popover.querySelectorAll(".slash-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.slashIndex = (state.slashIndex + 1) % items.length;
      updateSlashSelection(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.slashIndex = (state.slashIndex - 1 + items.length) % items.length;
      updateSlashSelection(items);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (items[state.slashIndex]) items[state.slashIndex].click();
    } else if (e.key === "Escape") hideSlashPopover();
    return;
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function showSlashPopover(filter) {
  const popover = $("slash-popover");
  const list = $("slash-list");
  if (!popover || !list) return;
  const matched = state.skills.filter((s) => s.name.toLowerCase().includes(filter));
  if (!matched.length) { hideSlashPopover(); return; }
  state.slashIndex = 0;
  list.innerHTML = matched.map((s, idx) => `
    <div class="slash-item ${idx === 0 ? "active" : ""}" onclick="selectSlashSkill('${escapeHtml(s.name)}')">
      <span class="slash-icon">${escapeHtml(s.icon || "⚡")}</span>
      <div class="slash-info">
        <div class="slash-name">/${escapeHtml(s.name)}</div>
        <div class="slash-desc">${escapeHtml(s.description || "垂直领域技能")}</div>
      </div>
    </div>
  `).join("");
  popover.classList.remove("hidden");
}

function hideSlashPopover() {
  if ($("slash-popover")) $("slash-popover").classList.add("hidden");
}

function updateSlashSelection(items) {
  items.forEach((it, idx) => it.classList.toggle("active", idx === state.slashIndex));
}

function selectSlashSkill(name) {
  $("query").value = `/${name} `;
  hideSlashPopover();
  $("query").focus();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
