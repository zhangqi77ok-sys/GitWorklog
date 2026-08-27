// 统一智能体平台前端核心：会话侧边栏 + Slash 技能菜单 + Markdown 渲染 + 技能生态 + 知识库 + 系统管理

const $ = (id) => document.getElementById(id);
const state = {
  token: localStorage.getItem("token"),
  user: localStorage.getItem("user") || "admin",
  currentTab: "chat-view",
  activeConversationId: null,
  sessions: [],
  skills: [],
  files: [],
  knowledgeBases: [],
  activeKbId: null,
  selectedKbIds: [], // [ { id, name } ]
  selectedKbFiles: [], // [ { file_id, filename, kb_id } ]
  attachedFile: null, // { file_id, filename }
  slashIndex: -1,
  editingSkillName: null,
};

// ==============================
// 1. 初始化与导航
// ==============================
window.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  if (state.token) {
    showMainPanel();
  } else {
    showLoginPanel();
  }
});

function initEventListeners() {
  // 登录与退出
  $("login-btn").onclick = login;
  $("logout-btn").onclick = logout;
  $("password").onkeydown = (e) => e.key === "Enter" && login();

  // 侧边栏与 Tab 菜单切换
  document.querySelectorAll(".sidebar-nav .nav-item, .nav-tabs .tab-btn").forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });


  // 对话发送与 Slash 快捷键监听
  const queryEl = $("query");
  queryEl.oninput = handleQueryInput;
  queryEl.onkeydown = handleQueryKeydown;
  $("send-btn").onclick = send;
  $("timeline-btn").onclick = showTimeline;
  $("new-chat-btn").onclick = startNewChat;

  // 知识库弹窗选择器与附件
  $("open-kb-btn").onclick = toggleKbPopover;
  $("kb-close-btn").onclick = hideKbPopover;
  $("kb-select-all-btn").onclick = selectAllKbFiles;
  $("kb-clear-all-btn").onclick = clearSelectedKbFiles;
  $("kb-search-input").oninput = (e) => renderKbPopover(e.target.value.trim());
  $("attach-file-btn").onclick = () => $("chat-file-input").click();
  $("chat-file-input").onchange = handleChatFileUpload;

  // 知识库管理与 RAG 测试
  $("create-kb-btn").onclick = () => $("kb-create-modal").classList.remove("hidden");
  $("save-kb-btn").onclick = saveNewKnowledgeBase;
  $("upload-knowledge-btn").onclick = () => $("knowledge-file-input").click();
  $("knowledge-file-input").onchange = handleKnowledgeFileUpload;
  $("rag-search-btn").onclick = runRAGSearch;
  $("rag-query-input").onkeydown = (e) => e.key === "Enter" && runRAGSearch();


  // 记忆与知识图谱
  $("add-memory-btn").onclick = () => $("memory-add-modal").classList.remove("hidden");
  $("save-memory-btn").onclick = saveUserMemory;
  $("refresh-memory-btn").onclick = loadUserMemoryAndGraph;
  $("clear-memory-btn").onclick = clearUserMemory;

  // Codex 编程工作台
  $("project-select").onchange = (e) => switchProject(e.target.value);
  $("checkout-branch-btn").onclick = checkoutCurrentBranch;
  $("save-code-btn").onclick = saveCurrentFileCode;
  $("codex-send-btn").onclick = sendCodexChat;
  $("codex-query-input").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCodexChat();
    }
  };
  $("launch-desktop-btn").onclick = launchDesktopClient;

  // API 与模型网关
  $("refresh-gateway-btn").onclick = loadGatewayConfig;

  // 技能管理
  $("add-skill-btn").onclick = openCreateSkillModal;
  $("save-skill-btn").onclick = saveSkill;
  $("sync-skills-btn").onclick = syncSkills;
  $("import-skill-btn").onclick = () => $("skill-import-input").click();
  $("skill-import-input").onchange = handleSkillImportUpload;


  // 用户管理
  $("add-user-btn").onclick = () => $("user-modal").classList.remove("hidden");
  $("save-user-btn").onclick = saveNewUser;

  // 拖拽上传
  const dropZone = $("drop-zone");
  if (dropZone) {
    dropZone.onclick = () => $("knowledge-file-input").click();
    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    };
    dropZone.ondragleave = () => dropZone.classList.remove("dragover");
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length) {
        uploadFileDirectly(e.dataTransfer.files[0]);
      }
    };
  }


  // 全局弹窗关闭
  document.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.onclick = closeAllModals;
  });
  window.onclick = (e) => {
    if (e.target.classList.contains("modal")) {
      closeAllModals();
    }
  };

  // 点击外部隐藏 Slash Popover
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".composer-container")) {
      hideSlashPopover();
    }
  });
}

async function login() {
  const username = $("username").value.trim();
  const password = $("password").value;
  $("login-error").textContent = "";

  if (!username || !password) {
    $("login-error").textContent = "请输入用户名和密码";
    return;
  }

  try {
    const resp = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await resp.json();
    if (body.code !== 0) {
      $("login-error").textContent = body.message || "登录失败";
      return;
    }
    state.token = body.data.token;
    state.user = body.data.username;
    localStorage.setItem("token", state.token);
    localStorage.setItem("user", state.user);
    showMainPanel();
  } catch (e) {
    $("login-error").textContent = "网络错误：" + e;
  }
}

function logout() {
  state.token = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  showLoginPanel();
}

function showLoginPanel() {
  $("main-panel").classList.add("hidden");
  $("login-panel").classList.remove("hidden");
}

function showMainPanel() {
  $("login-panel").classList.add("hidden");
  $("main-panel").classList.remove("hidden");
  const whoEl = $("who");
  if (whoEl) whoEl.textContent = state.user || "admin";
  switchTab("chat-view");
  loadSkills();
  loadFiles();
  loadSessions();
  loadUserMemoryAndGraph();
}

function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll(".sidebar-nav .nav-item, .nav-tabs .tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".main-content .view-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === tabId);
  });

  if (tabId === "chat-view") loadSessions();
  if (tabId === "coding-view") loadProjectsAndGit();
  if (tabId === "skills-view") loadSkills();
  if (tabId === "files-view") loadFiles();
  if (tabId === "memory-view") loadUserMemoryAndGraph();
  if (tabId === "gateway-view") loadGatewayConfig();
  if (tabId === "travel-view") loadTravelOrders();
  if (tabId === "sys-view") loadUsers();
}



function closeAllModals() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
}

// ==============================
// 2. 会话管理 (Chat Sessions)
// ==============================
async function loadSessions() {
  const container = $("session-list");
  try {
    const resp = await fetch("/session/list", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      state.sessions = body.data || [];
      renderSessionsList();
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-tip">加载会话失败</div>';
  }
}

function renderSessionsList() {
  const container = $("session-list");
  if (!state.sessions.length) {
    container.innerHTML = '<div class="empty-tip">暂无历史会话</div>';
    return;
  }

  container.innerHTML = state.sessions
    .map(
      (s) => `
    <div class="session-item ${s.conversation_id === state.activeConversationId ? "active" : ""}" 
         onclick="switchSession('${s.conversation_id}')">
      <span class="session-item-title">💬 ${escapeHtml(s.title || "新对话")}</span>
      <button class="session-del-btn" onclick="event.stopPropagation(); deleteSession('${s.conversation_id}')" title="删除会话">🗑</button>
    </div>
  `
    )
    .join("");
}

function startNewChat() {
  state.activeConversationId = null;
  renderSessionsList();
  $("messages").innerHTML = `
    <div id="chat-empty-state" class="empty-state">
      <div class="empty-hero-icon">✨</div>
      <h2>欢迎使用统一企业智能体平台</h2>
      <p class="empty-desc">由百炼 Qwen3.7-Flash 驱动，支持差旅全流程协同、数据分析与知识库问答。输入 <code>/</code> 可直接调用垂直技能。</p>
      
      <div class="starter-grid">
        <div class="starter-card" onclick="useStarter('/data-analysis 统计上月各部门的销售额与订单总数')">
          <div class="starter-icon">📊</div>
          <div class="starter-title">数据指标统计</div>
          <div class="starter-text">统计上月各部门的销售额与订单总数</div>
        </div>

        <div class="starter-card" onclick="useStarter('/flight-booking 帮我查询明天北京到上海的机票')">
          <div class="starter-icon">✈️</div>
          <div class="starter-title">航班比价预订</div>
          <div class="starter-text">帮我查询明天北京到上海的机票</div>
        </div>

        <div class="starter-card" onclick="useStarter('/hotel-booking 推荐上海陆家嘴附近的差旅协议酒店')">
          <div class="starter-icon">🏨</div>
          <div class="starter-title">酒店住宿推荐</div>
          <div class="starter-text">推荐上海陆家嘴附近的差旅协议酒店</div>
        </div>

        <div class="starter-card" onclick="useStarter('/tuniu-travel-guide 查一下杭州未来三天的天气和出行攻略')">
          <div class="starter-icon">🌤️</div>
          <div class="starter-title">出游攻略与天气</div>
          <div class="starter-text">查一下杭州未来三天的天气和出行攻略</div>
        </div>
      </div>
    </div>
  `;
}

async function switchSession(convId) {
  state.activeConversationId = convId;
  renderSessionsList();
  $("messages").innerHTML = '<div class="empty-tip">加载历史消息中...</div>';

  try {
    const resp = await fetch(`/session/${convId}/messages`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      $("messages").innerHTML = "";
      const msgs = body.data || [];
      if (!msgs.length) {
        startNewChat();
        return;
      }
      msgs.forEach((m) => {
        const msgEl = createMessageElements(m.role === "user" ? "user" : "agent");
        msgEl.content.innerHTML = renderMd(m.content);
      });
      scrollMessagesToBottom();
    }
  } catch (e) {
    $("messages").innerHTML = `<div class="empty-tip">加载会话消息失败：${e}</div>`;
  }
}

async function deleteSession(convId) {
  if (!confirm("确定删除此会话记录吗？")) return;
  try {
    const resp = await fetch(`/session/${convId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      if (state.activeConversationId === convId) {
        startNewChat();
      }
      loadSessions();
    }
  } catch (e) {
    alert("删除失败：" + e);
  }
}

// ==============================
// 3. Slash Command 快捷菜单
// ==============================
const SKILL_ICONS = {
  "data-analysis": "📊",
  "flight-booking": "✈️",
  "hotel-booking": "🏨",
  "tuniu-travel-guide": "🌤️",
  "itinerary-planner": "🗓️",
  "travel-reimbursement": "🧾",
  "codex": "💻",
  "agent-transcript": "📜",
  "ui-ux-pro-max": "🎨",
  "shadcn-ui-master": "🧱",
  "tailwind-mastery": "🌊",
  "react-nextjs-architect": "⚛️",
  "a11y-wcag-accessibility": "♿",
  "framer-motion-effects": "✨",
  "vue3-vite-expert": "💚",
  "web-performance-cwv": "⚡",
};


function handleQueryInput(e) {
  const val = e.target.value;
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";

  if (val.startsWith("/")) {
    const filter = val.slice(1).toLowerCase().trim();
    renderSlashPopover(filter);
  } else {
    hideSlashPopover();
  }
}

function handleQueryKeydown(e) {
  const popover = $("slash-popover");
  const isPopoverOpen = !popover.classList.contains("hidden");

  if (isPopoverOpen) {
    const items = popover.querySelectorAll(".slash-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.slashIndex = (state.slashIndex + 1) % items.length;
      updateSlashSelection(items);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      state.slashIndex = (state.slashIndex - 1 + items.length) % items.length;
      updateSlashSelection(items);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      if (state.slashIndex >= 0 && state.slashIndex < items.length) {
        e.preventDefault();
        items[state.slashIndex].click();
        return;
      }
    }
    if (e.key === "Escape") {
      hideSlashPopover();
      return;
    }
  }

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function renderSlashPopover(filter = "") {
  const list = $("slash-list");
  const popover = $("slash-popover");
  const filtered = state.skills.filter((s) => s.name.toLowerCase().includes(filter) || s.description.toLowerCase().includes(filter));

  if (!filtered.length) {
    hideSlashPopover();
    return;
  }

  state.slashIndex = 0;
  list.innerHTML = filtered
    .map(
      (s, idx) => `
    <div class="slash-item ${idx === 0 ? "selected" : ""}" onclick="selectSlashSkill('${s.name}')">
      <span class="slash-item-icon">${SKILL_ICONS[s.name] || "🧩"}</span>
      <span class="slash-item-name">/${escapeHtml(s.name)}</span>
      <span class="slash-item-desc">${escapeHtml(s.description || "")}</span>
    </div>
  `
    )
    .join("");

  popover.classList.remove("hidden");
}

function updateSlashSelection(items) {
  items.forEach((it, idx) => {
    it.classList.toggle("selected", idx === state.slashIndex);
    if (idx === state.slashIndex) it.scrollIntoView({ block: "nearest" });
  });
}

function hideSlashPopover() {
  $("slash-popover").classList.add("hidden");
  state.slashIndex = -1;
}

window.selectSlashSkill = function (skillName) {
  const queryEl = $("query");
  queryEl.value = `/${skillName} `;
  hideSlashPopover();
  queryEl.focus();
};

window.useStarter = function (promptText) {
  $("query").value = promptText;
  send();
};

// ==============================
// 4. 技能管理 (Skills Ecosystem)
// ==============================
async function loadSkills() {
  try {
    const resp = await fetch("/api/skills/list", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      state.skills = body.data || [];
      renderSkillsGrid();
      renderActiveSkillsBar();
    }
  } catch (e) {
    console.error("加载技能失败:", e);
  }
}

function renderSkillsGrid() {
  const container = $("skills-grid");
  if (!state.skills.length) {
    container.innerHTML = '<div class="empty-tip">暂无可用技能，请点击右上角「➕ 新建技能」或「从磁盘同步」</div>';
    return;
  }

  container.innerHTML = state.skills
    .map(
      (s) => `
    <div class="skill-card">
      <div class="skill-header">
        <span class="skill-name">${SKILL_ICONS[s.name] || "🧩"} /${escapeHtml(s.name)}</span>
        <label class="switch">
          <input type="checkbox" ${s.enabled ? "checked" : ""} onchange="toggleSkill('${s.name}', this.checked)" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="skill-desc">${escapeHtml(s.description || "暂无描述")}</div>
      <div class="skill-footer">
        <span style="font-size: 12px; color: ${s.enabled ? "#34d399" : "#94a3b8"}">
          ${s.enabled ? "🟢 已就绪" : "⚪ 已停用"}
        </span>
        <div class="action-btns">
          <button class="action-btn" onclick="openEditSkillModal('${s.name}')">✏️ 编辑</button>
          <button class="action-btn" onclick="viewSkillGuide('${s.name}')">SOP</button>
          <button class="action-btn danger" onclick="deleteSkill('${s.name}')">🗑</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function renderActiveSkillsBar() {
  const container = $("active-skills-tags");
  if (!container) return;
  const enabled = state.skills.filter((s) => s.enabled);
  if (!enabled.length) {
    container.innerHTML = '<span class="skill-pill" style="color:#94a3b8">暂无就绪技能</span>';
    return;
  }

  container.innerHTML = enabled
    .map(
      (s) => `
    <span class="skill-pill" style="cursor:pointer" onclick="selectSlashSkill('${s.name}')" title="点击在输入框填入 /${s.name}">
      ${SKILL_ICONS[s.name] || "⚡"} /${escapeHtml(s.name)}
    </span>
  `
    )
    .join("");
}

function openCreateSkillModal() {
  state.editingSkillName = null;
  $("skill-edit-modal-title").textContent = "➕ 新建领域技能";
  $("skill-edit-name").value = "";
  $("skill-edit-name").disabled = false;
  $("skill-edit-desc").value = "";
  $("skill-edit-body").value = "";
  $("skill-edit-modal").classList.remove("hidden");
}

function openEditSkillModal(name) {
  const skill = state.skills.find((s) => s.name === name);
  if (!skill) return;
  state.editingSkillName = name;
  $("skill-edit-modal-title").textContent = `✏️ 编辑技能：/${name}`;
  $("skill-edit-name").value = skill.name;
  $("skill-edit-name").disabled = true;
  $("skill-edit-desc").value = skill.description;
  $("skill-edit-body").value = skill.body || "";
  $("skill-edit-modal").classList.remove("hidden");
}

async function saveSkill() {
  const name = $("skill-edit-name").value.trim();
  const description = $("skill-edit-desc").value.trim();
  const body = $("skill-edit-body").value.trim();

  if (!name || !description) {
    alert("请填写技能英文标识和描述");
    return;
  }

  try {
    let url = "/api/skills";
    let method = "POST";
    let payload = { name, description, body, enabled: true };

    if (state.editingSkillName) {
      url = `/api/skills/${encodeURIComponent(state.editingSkillName)}`;
      method = "PUT";
      payload = { description, body };
    }

    const resp = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify(payload),
    });
    const resBody = await resp.json();
    if (resBody.code === 0) {
      closeAllModals();
      loadSkills();
    } else {
      alert("保存失败：" + resBody.message);
    }
  } catch (e) {
    alert("请求异常：" + e);
  }
}

async function deleteSkill(name) {
  if (!confirm(`确定彻底删除技能「/${name}」吗？对应的本地文件和数据库将被同步清理。`)) return;
  try {
    const resp = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      loadSkills();
    } else {
      alert("删除失败：" + body.message);
    }
  } catch (e) {
    alert("删除异常：" + e);
  }
}

async function toggleSkill(name, enabled) {
  try {
    const resp = await fetch(`/api/skills/${encodeURIComponent(name)}/toggle`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ enabled }),
    });
    const body = await resp.json();
    if (body.code === 0) {
      loadSkills();
    } else {
      alert("操作失败：" + body.message);
    }
  } catch (e) {
    alert("网络错误：" + e);
  }
}

async function syncSkills() {
  try {
    const resp = await fetch("/api/skills/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      alert(`已成功同步 ${body.data.length} 个垂直领域技能！`);
      loadSkills();
    }
  } catch (e) {
    alert("同步技能失败：" + e);
  }
}

async function handleSkillImportUpload(e) {
  if (!e.target.files.length) return;
  const file = e.target.files[0];
  e.target.value = "";

  const formData = new FormData();
  formData.append("file", file);

  try {
    const resp = await fetch("/api/skills/import", {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData,
    });
    const body = await resp.json().catch(() => ({}));
    if (body.code === 0) {
      const skills = body.data || [];
      alert(`🎉 成功导入 ${skills.length} 个技能包：\n${skills.map((s) => "• /" + s.name).join("\n")}`);
      loadSkills();
    } else {
      const errorMsg = body.message || body.detail || (resp.ok ? "未知错误" : `HTTP ${resp.status} ${resp.statusText}`);
      alert("导入技能失败：" + errorMsg);
    }
  } catch (e) {
    alert("导入异常：" + e);
  }
}




function viewSkillGuide(name) {
  const skill = state.skills.find((s) => s.name === name);
  if (!skill) return;
  $("skill-modal-title").textContent = `🧩 /${skill.name} 指南规范`;
  $("skill-modal-desc").textContent = skill.description;
  $("skill-modal-body").textContent = skill.body || "（该技能由描述与工具规则直接驱动）";
  $("skill-modal").classList.remove("hidden");
}

// ==============================
// 5. 企业知识库集合与文档 RAG (Knowledge Bases & Files)
// ==============================
async function loadFiles() {
  await loadKnowledgeBasesAndFiles();
}

async function loadKnowledgeBasesAndFiles() {
  try {
    const resp = await fetch("/api/files/kb/list", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0 && body.data) {
      state.knowledgeBases = body.data || [];
      if (!state.activeKbId && state.knowledgeBases.length) {
        state.activeKbId = state.knowledgeBases[0].id;
      }
      // 聚合所有文档到 state.files
      state.files = [];
      state.knowledgeBases.forEach((kb) => {
        (kb.files || []).forEach((f) => state.files.push(f));
      });

      renderKnowledgeBasesList();
      renderCurrentKbDocuments();
    }
  } catch (e) {
    console.error("加载知识库集合失败:", e);
  }
}

function renderKnowledgeBasesList() {
  const countEl = $("kb-count-label");
  if (countEl) countEl.textContent = state.knowledgeBases.length;

  const container = $("kb-list-container");
  if (!container) return;

  if (!state.knowledgeBases.length) {
    container.innerHTML = '<div class="empty-tip">暂无知识库，请点击上方「➕ 新建知识库」</div>';
    return;
  }

  container.innerHTML = state.knowledgeBases
    .map(
      (kb) => `
    <div class="kb-card-item ${kb.id === state.activeKbId ? "active" : ""}" onclick="selectKnowledgeBase(${kb.id})">
      <div style="flex:1;">
        <div class="kb-card-title">📚 ${escapeHtml(kb.name)}</div>
        <div class="kb-card-desc">${escapeHtml(kb.description || "暂无描述")}</div>
        <div class="kb-card-stats">📄 ${kb.doc_count} 篇文档 · ${formatBytes(kb.total_size_bytes)}</div>
      </div>
      ${
        state.knowledgeBases.length > 1
          ? `<button class="kb-card-del-btn" onclick="event.stopPropagation(); deleteKnowledgeBase(${kb.id}, '${escapeHtml(kb.name)}')" title="删除知识库">🗑</button>`
          : ""
      }
    </div>
  `
    )
    .join("");
}

window.selectKnowledgeBase = function (kbId) {
  state.activeKbId = kbId;
  renderKnowledgeBasesList();
  renderCurrentKbDocuments();
};

function renderCurrentKbDocuments() {
  const currKb = state.knowledgeBases.find((kb) => kb.id === state.activeKbId) || state.knowledgeBases[0];
  if (!currKb) return;

  const titleEl = $("current-kb-header-title");
  const descEl = $("current-kb-header-desc");
  const statsEl = $("current-kb-doc-stats");

  if (titleEl) titleEl.textContent = `📚 ${currKb.name}`;
  if (descEl) descEl.textContent = currKb.description || "暂无描述";
  if (statsEl) statsEl.textContent = `${currKb.doc_count} 篇文档 · ${formatBytes(currKb.total_size_bytes)}`;

  const tbody = $("files-tbody");
  if (!tbody) return;

  const docs = currKb.files || [];
  if (!docs.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">当前知识库暂无文档，请点击上方按钮或拖拽上传</td></tr>';
    return;
  }

  tbody.innerHTML = docs
    .map(
      (f) => `
    <tr>
      <td><strong>📄 ${escapeHtml(f.filename)}</strong></td>
      <td><span class="skill-pill">📚 ${escapeHtml(currKb.name)}</span></td>
      <td><span class="skill-pill">${escapeHtml(f.kind)}</span></td>
      <td>${formatBytes(f.size_bytes)}</td>
      <td style="max-width: 240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${escapeHtml(f.summary || "-")}
      </td>
      <td>${f.created_at || "-"}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn primary" onclick="attachFileAndChat('${f.file_id}', '${escapeHtml(f.filename)}')">💬 关联对话</button>
          <button class="action-btn" onclick="previewFile('${f.file_id}')">🔍 预览</button>
          <button class="action-btn danger" onclick="deleteFile('${f.file_id}')">🗑 删除</button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

async function saveNewKnowledgeBase() {
  const name = $("new-kb-name").value.trim();
  const desc = $("new-kb-desc").value.trim();
  if (!name) {
    alert("请输入知识库名称");
    return;
  }

  try {
    const resp = await fetch("/api/files/kb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ name: name, description: desc }),
    });
    const body = await resp.json();
    if (body.code === 0) {
      closeAllModals();
      $("new-kb-name").value = "";
      $("new-kb-desc").value = "";
      state.activeKbId = body.data.id;
      loadKnowledgeBasesAndFiles();
    } else {
      alert("创建知识库失败: " + body.message);
    }
  } catch (e) {
    alert("创建知识库网络异常: " + e);
  }
}

window.deleteKnowledgeBase = async function (kbId, name) {
  if (!confirm(`确定删除知识库《${name}》及其下所有文档与向量索引吗？删除后不可恢复。`)) return;
  try {
    const resp = await fetch(`/api/files/kb/${kbId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      state.activeKbId = null;
      loadKnowledgeBasesAndFiles();
    } else {
      alert("删除失败：" + body.message);
    }
  } catch (e) {
    alert("删除网络异常：" + e);
  }
};

async function handleKnowledgeFileUpload(e) {
  if (e.target.files.length) {
    await uploadFileDirectly(e.target.files[0], state.activeKbId || 0);
    e.target.value = "";
  }
}

async function handleChatFileUpload(e) {
  if (e.target.files.length) {
    const res = await uploadFileDirectly(e.target.files[0], state.activeKbId || 0);
    e.target.value = "";
    if (res) {
      attachFile(res.file_id, res.filename);
    }
  }
}

async function uploadFileDirectly(file, kbId = 0) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const resp = await fetch(`/api/files/upload?kb_id=${kbId || 0}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData,
    });
    const body = await resp.json();
    if (body.code === 0) {
      loadKnowledgeBasesAndFiles();
      return body.data;
    } else {
      alert("上传失败：" + body.message);
    }
  } catch (e) {
    alert("上传异常：" + e);
  }
  return null;
}

function toggleKbPopover() {
  const popover = $("kb-popover");
  if (popover.classList.contains("hidden")) {
    renderKbPopover();
    popover.classList.remove("hidden");
  } else {
    popover.classList.add("hidden");
  }
}

function hideKbPopover() {
  $("kb-popover").classList.add("hidden");
}

function renderKbPopover(filter = "") {
  const list = $("kb-file-list");
  if (!list) return;

  if (!state.knowledgeBases.length) {
    list.innerHTML = '<div class="empty-tip">暂无知识库集合，请在「文件与知识库」页面创建</div>';
    return;
  }

  list.innerHTML = state.knowledgeBases
    .map((kb) => {
      const docs = (kb.files || []).filter((f) =>
        f.filename.toLowerCase().includes(filter.toLowerCase()) || kb.name.toLowerCase().includes(filter.toLowerCase())
      );
      if (filter && !docs.length && !kb.name.toLowerCase().includes(filter.toLowerCase())) {
        return "";
      }

      const isKbSelected = state.selectedKbIds.some((k) => k.id === kb.id);

      return `
      <div class="kb-group-card">
        <div class="kb-group-header">
          <label class="kb-group-title">
            <input type="checkbox" ${isKbSelected ? "checked" : ""} onchange="toggleKbCollection(${kb.id}, '${escapeHtml(kb.name)}', this.checked)" />
            <span>📚 ${escapeHtml(kb.name)} (${docs.length} 篇)</span>
          </label>
        </div>
        <div class="kb-group-docs">
          ${
            docs.length
              ? docs
                  .map((f) => {
                    const isFileSelected = state.selectedKbFiles.some((item) => item.file_id === f.file_id);
                    return `
                <label class="kb-doc-item">
                  <input type="checkbox" ${isFileSelected ? "checked" : ""} onchange="toggleKbFile('${f.file_id}', '${escapeHtml(f.filename)}', ${kb.id}, this.checked)" />
                  <span>📄 ${escapeHtml(f.filename)} <small style="color:var(--text-muted)">(${formatBytes(f.size_bytes)})</small></span>
                </label>
              `;
                  })
                  .join("")
              : '<div style="font-size:11px;color:var(--text-muted);padding:4px;">该知识库暂无文档</div>'
          }
        </div>
      </div>
    `;
    })
    .join("");
}

window.toggleKbCollection = function (kbId, kbName, isChecked) {
  if (isChecked) {
    if (!state.selectedKbIds.some((k) => k.id === kbId)) {
      state.selectedKbIds.push({ id: kbId, name: kbName });
    }
  } else {
    state.selectedKbIds = state.selectedKbIds.filter((k) => k.id !== kbId);
  }
  renderKbPopover();
  renderSelectedKbChips();
};

window.toggleKbFile = function (fileId, filename, kbId, isChecked) {
  if (isChecked) {
    if (!state.selectedKbFiles.some((f) => f.file_id === fileId)) {
      state.selectedKbFiles.push({ file_id: fileId, filename: filename, kb_id: kbId });
    }
  } else {
    state.selectedKbFiles = state.selectedKbFiles.filter((f) => f.file_id !== fileId);
  }
  renderKbPopover();
  renderSelectedKbChips();
};

function selectAllKbFiles() {
  state.selectedKbIds = state.knowledgeBases.map((kb) => ({ id: kb.id, name: kb.name }));
  state.selectedKbFiles = state.files.map((f) => ({ file_id: f.file_id, filename: f.filename, kb_id: f.kb_id }));
  renderKbPopover();
  renderSelectedKbChips();
}

function clearSelectedKbFiles() {
  state.selectedKbIds = [];
  state.selectedKbFiles = [];
  renderKbPopover();
  renderSelectedKbChips();
}

window.removeSelectedKb = function (kbId) {
  state.selectedKbIds = state.selectedKbIds.filter((k) => k.id !== kbId);
  renderKbPopover();
  renderSelectedKbChips();
};

window.removeKbFile = function (fileId) {
  state.selectedKbFiles = state.selectedKbFiles.filter((f) => f.file_id !== fileId);
  renderKbPopover();
  renderSelectedKbChips();
};

function renderSelectedKbChips() {
  const container = $("kb-selected-chips");
  const badgeCount = $("kb-badge-count");
  const totalCount = state.selectedKbIds.length + state.selectedKbFiles.length;

  if (totalCount > 0) {
    badgeCount.textContent = totalCount;
    badgeCount.classList.remove("hidden");
    container.classList.remove("hidden");

    const kbChips = state.selectedKbIds.map(
      (kb) => `
      <span class="kb-chip" style="background:rgba(99,102,241,0.2);color:#818cf8;border-color:rgba(99,102,241,0.4);">
        <span>📚 [知识库] ${escapeHtml(kb.name)}</span>
        <span class="chip-del" onclick="removeSelectedKb(${kb.id})" title="取消关联知识库">✕</span>
      </span>
    `
    );

    const fileChips = state.selectedKbFiles.map(
      (f) => `
      <span class="kb-chip">
        <span>📄 [文档] ${escapeHtml(f.filename)}</span>
        <span class="chip-del" onclick="removeKbFile('${f.file_id}')" title="取消关联文档">✕</span>
      </span>
    `
    );

    container.innerHTML = [...kbChips, ...fileChips].join("");
  } else {
    badgeCount.classList.add("hidden");
    container.classList.add("hidden");
    container.innerHTML = "";
  }
}

function attachFileAndChat(fileId, filename) {
  if (!state.selectedKbFiles.some((f) => f.file_id === fileId)) {
    state.selectedKbFiles.push({ file_id: fileId, filename: filename, kb_id: state.activeKbId || 0 });
  }
  renderSelectedKbChips();
  switchTab("chat-view");
  $("query").focus();
}

function attachFile(fileId, filename) {
  if (!state.selectedKbFiles.some((f) => f.file_id === fileId)) {
    state.selectedKbFiles.push({ file_id: fileId, filename: filename, kb_id: state.activeKbId || 0 });
  }
  renderSelectedKbChips();
}

function detachFile() {
  state.selectedKbIds = [];
  state.selectedKbFiles = [];
  renderSelectedKbChips();
}

async function previewFile(fileId) {
  try {
    const resp = await fetch(`/api/files/${fileId}/preview`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      $("file-modal-title").textContent = `📄 文件内容预览：${body.data.filename}`;
      $("file-modal-text").textContent = body.data.text_content || "（未提取到纯文本）";
      $("file-modal").classList.remove("hidden");
    }
  } catch (e) {
    alert("预览失败：" + e);
  }
}

async function deleteFile(fileId) {
  if (!confirm("确定删除此文件吗？")) return;
  try {
    const resp = await fetch(`/api/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      loadKnowledgeBasesAndFiles();
    }
  } catch (e) {
    alert("删除失败：" + e);
  }
}


// 知识库 RAG 检索测试台执行
async function runRAGSearch() {
  const query = $("rag-query-input").value.trim();
  if (!query) return;

  const box = $("rag-results-box");
  box.classList.remove("hidden");
  box.innerHTML = '<div class="empty-tip">正在执行 RAG 混合分块检索...</div>';

  try {
    const resp = await fetch("/api/files/rag/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ query, top_k: 4 }),
    });
    const body = await resp.json();
    const chunks = body.data || [];
    if (!chunks.length) {
      box.innerHTML = '<div class="empty-tip">未检索到匹配的文档切片（请先上传相关业务文档）</div>';
      return;
    }

    box.innerHTML = chunks
      .map(
        (c) => `
      <div class="rag-chunk-card">
        <div class="rag-chunk-header">
          <span>📄 来自《${escapeHtml(c.filename)}》 · 切片 #${c.chunk_index + 1}</span>
          <span class="rag-score-badge">相关度: ${(c.score * 100).toFixed(1)}%</span>
        </div>
        <div class="rag-chunk-content">${escapeHtml(c.content)}</div>
      </div>
    `
      )
      .join("");
  } catch (e) {
    box.innerHTML = `<div class="empty-tip">检索失败：${e}</div>`;
  }
}

// ==============================
// 6. 差旅看板 (Travel Requests)
// ==============================
async function loadTravelOrders() {
  const tbody = $("travel-tbody");
  try {
    const resp = await fetch("/api/travel/requests/list", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0 && body.data && body.data.length) {
      tbody.innerHTML = body.data
        .map(
          (t) => `
        <tr>
          <td><strong>#${t.id}</strong></td>
          <td>${escapeHtml(t.applicant_name || state.user)}</td>
          <td>${escapeHtml(t.departure_city || "-")} ➔ ${escapeHtml(t.destination_city || "-")}</td>
          <td>${t.start_date || "-"} 至 ${t.end_date || "-"}</td>
          <td>${escapeHtml(t.reason || "-")}</td>
          <td><span class="skill-pill">${t.status || "已提交"}</span></td>
        </tr>
      `
        )
        .join("");
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无差旅单，可直接在对话框中说「我要去上海出差」快速创建</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无差旅记录</td></tr>';
  }
}

// ==============================
// 7. 系统管理 (System & Users)
// ==============================
async function loadUsers() {
  const tbody = $("users-tbody");
  try {
    const resp = await fetch("/sys/user/list", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0 && body.data && body.data.length) {
      tbody.innerHTML = body.data
        .map(
          (u) => `
        <tr>
          <td>#${u.id}</td>
          <td><strong>${escapeHtml(u.username)}</strong></td>
          <td>${escapeHtml(u.nickname || "-")}</td>
          <td><span class="skill-pill">${(u.roles || []).join(", ") || "user"}</span></td>
          <td>${u.dept_id ? `部门 #${u.dept_id}` : "总经办 / 全公司"}</td>
          <td><span style="color:#34d399">正常</span></td>
          <td>${u.created_at || "-"}</td>
        </tr>
      `
        )
        .join("");
    } else {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">暂无用户数据</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">仅管理员可查看系统用户</td></tr>`;
  }
}

async function saveNewUser() {
  const username = $("new-user-name").value.trim();
  const nickname = $("new-user-nick").value.trim();
  const password = $("new-user-pwd").value;
  const role = $("new-user-role").value;

  if (!username) {
    alert("请输入用户名");
    return;
  }

  try {
    const resp = await fetch("/sys/user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        username,
        nickname: nickname || username,
        password,
        role_codes: [role],
      }),
    });
    const body = await resp.json();
    if (body.code === 0) {
      alert("创建用户成功！");
      closeAllModals();
      loadUsers();
    } else {
      alert("创建失败：" + body.message);
    }
  } catch (e) {
    alert("请求异常：" + e);
  }
}

// ==============================
// 8. 对话流式渲染与 Markdown 打字机
// ==============================
function createMessageElements(role) {
  const emptyState = $("chat-empty-state");
  if (emptyState) emptyState.remove();

  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar-box";
  avatar.textContent = role === "user" ? "👤" : "🤖";

  const body = document.createElement("div");
  body.className = "message-body";

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = role === "user" ? state.user : "智能助手 · Qwen3.7-Flash";

  const stepContainer = document.createElement("div");
  stepContainer.className = "step-events-container";

  const content = document.createElement("div");
  content.className = "msg-content";
  if (role === "agent") content.classList.add("typing-cursor");

  const actions = document.createElement("div");
  actions.className = "msg-actions";
  actions.innerHTML = `
    <button class="msg-action-btn" onclick="copyMessageText(this)" title="复制回复">📋 复制</button>
  `;

  body.appendChild(meta);
  if (role === "agent") body.appendChild(stepContainer);
  body.appendChild(content);
  if (role === "agent") body.appendChild(actions);

  wrapper.appendChild(avatar);
  wrapper.appendChild(body);

  $("messages").appendChild(wrapper);
  scrollMessagesToBottom();

  return { wrapper, stepContainer, content };
}

function parseFrames(buffer) {
  const frames = [];
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("event:")) {
        event = trimmed.slice(6).trim();
      } else if (trimmed.startsWith("data:")) {
        data += trimmed.slice(5).trim();
      }
    }
    frames.push({ event, data });
  }
  return { frames, rest };
}

window.copyMessageText = function (btn) {
  const wrapper = btn.closest(".message-wrapper");
  const content = wrapper.querySelector(".msg-content")?.innerText || "";
  navigator.clipboard.writeText(content).then(() => {
    const orig = btn.textContent;
    btn.textContent = "✓ 已复制";
    setTimeout(() => (btn.textContent = orig), 2000);
  });
};

async function send() {
  const query = $("query").value.trim();
  if (!query) return;
  $("query").value = "";
  $("query").style.height = "auto";
  hideSlashPopover();
  hideKbPopover();

  // 整理关联的知识库集合 ID 与单独文档 ID
  const targetKbIds = state.selectedKbIds.map((k) => k.id);
  const targetFileIds = state.selectedKbFiles.map((f) => f.file_id);
  if (state.attachedFile && !targetFileIds.includes(state.attachedFile.file_id)) {
    targetFileIds.push(state.attachedFile.file_id);
  }

  // 渲染用户消息
  let promptDisplay = query;
  const tagList = [];
  if (state.selectedKbIds.length) {
    tagList.push(`📚 知识库: ${state.selectedKbIds.map((k) => k.name).join(", ")}`);
  }
  if (state.selectedKbFiles.length) {
    tagList.push(`📄 文档: ${state.selectedKbFiles.map((f) => f.filename).join(", ")}`);
  }
  if (tagList.length) {
    promptDisplay = `[${tagList.join(" | ")}]\n\n${query}`;
  } else if (state.attachedFile) {
    promptDisplay = `📎 [关联参考文档: ${state.attachedFile.filename}]\n\n${query}`;
  }
  const userMsg = createMessageElements("user");
  userMsg.content.innerHTML = renderMd(promptDisplay);

  // 创建助手消息结构
  const agentMsg = createMessageElements("agent");
  let acc = "";

  $("interrupt-btn").classList.remove("hidden");
  $("send-btn").classList.add("hidden");

  const payload = {
    query: query,
    conversation_id: state.activeConversationId,
    kb_ids: targetKbIds,
    file_ids: targetFileIds,
  };



  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: state.token ? `Bearer ${state.token}` : "",
      },
      body: JSON.stringify(payload),
    });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = parseFrames(buffer);
      buffer = rest;
      for (const f of frames) {
        handleSseFrame(f, agentMsg.content, agentMsg.stepContainer, (chunk) => {
          acc += chunk;
          agentMsg.content.innerHTML = renderMd(acc);
          scrollMessagesToBottom();
        });
      }
    }
    // 刷新会话列表
    loadSessions();
  } catch (e) {
    acc += `\n\n> ⚠ **连接异常**：${e}`;
    agentMsg.content.innerHTML = renderMd(acc);
  } finally {
    agentMsg.content.classList.remove("typing-cursor");
    $("interrupt-btn").classList.add("hidden");
    $("send-btn").classList.remove("hidden");
    scrollMessagesToBottom();
  }
}

function handleSseFrame(frame, contentEl, stepContainer, appendText) {
  let payload = {};
  try {
    payload = JSON.parse(frame.data);
  } catch {
    /* 非 JSON 忽略 */
  }

  switch (frame.event) {
    case "agent_switch":
      addStepBadge(stepContainer, `🎯 路由到「${payload.domain}」领域 · 置信度 ${(payload.confidence || 1).toFixed(2)}`, "route");
      break;
    case "message":
      if (payload.text) appendText(payload.text);
      break;
    case "progress":
      if (payload.phase === "skill_match" || payload.phase === "skill_explicit") {
        const icon = SKILL_ICONS[payload.skill] || "⚡";
        addStepBadge(stepContainer, `${icon} 激活技能「/${payload.skill}」：${payload.description || ""}`, "skill");
      } else if (payload.phase === "doc_attach") {
        addStepBadge(stepContainer, `📄 已提取并注入关联文档上下文 (${payload.length || 0} 字符)`, "doc");
      } else if (payload.phase === "tool_call") {
        addStepBadge(stepContainer, `🔧 正在调用工具「${payload.tool || ""}」...`, "tool");
      } else if (payload.phase === "tool_result") {
        addStepBadge(stepContainer, `✅ 工具「${payload.tool || ""}」执行完成`, "tool");
      }
      break;
    case "error":
      addStepBadge(stepContainer, `⚠ ${payload.message || "异常"}`, "danger");
      break;
    case "done":
      scrollMessagesToBottom();
      break;
    default:
      break;
  }
}

function addStepBadge(container, text, type = "route") {
  const badge = document.createElement("div");
  badge.className = `step-badge ${type}`;
  badge.textContent = text;
  container.appendChild(badge);
  scrollMessagesToBottom();
}

function renderMd(text) {
  if (window.marked && typeof window.marked.parse === "function") {
    return window.marked.parse(text);
  }
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

function scrollMessagesToBottom() {
  const el = $("messages");
  if (el) el.scrollTop = el.scrollHeight;
}

// ==============================
// 9. Timeline 轨迹查看
// ==============================
async function showTimeline() {
  $("timeline-modal").classList.remove("hidden");
  const list = $("timeline-list");
  list.innerHTML = '<div class="empty-tip">加载执行轨迹中...</div>';

  try {
    const listResp = await fetch("/session/list", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const listData = await listResp.json();
    if (!listData.data || !listData.data.length) {
      list.innerHTML = '<div class="empty-tip">暂无活跃会话轨迹</div>';
      return;
    }
    const convId = state.activeConversationId || listData.data[0].conversation_id;
    const tResp = await fetch(`/session/${convId}/timeline`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const tData = await tResp.json();
    const items = tData.data || [];
    if (!items.length) {
      list.innerHTML = '<div class="empty-tip">本会话暂无节点事件</div>';
      return;
    }
    list.innerHTML = items
      .map(
        (it) => `
      <div class="timeline-card">
        <div class="time">${it.created_at || ""} · <strong>${it.role}</strong></div>
        <div>${escapeHtml(it.content || "")}</div>
      </div>
    `
      )
      .join("");
  } catch (e) {
    list.innerHTML = `<div class="empty-tip">加载失败: ${e}</div>`;
  }
}

// 辅助工具
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  if (i <= 0) return bytes + " B";
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ==============================
// 9. 用户知识图谱与长期记忆
// ==============================
async function loadUserMemoryAndGraph() {
  if (!state.token) return;
  try {
    const resp = await fetch("/api/user/memory", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0 && body.data) {
      const { memories, graph_edges } = body.data;
      const memCountEl = $("memory-count-label");
      const graphCountEl = $("graph-count-label");
      if (memCountEl) memCountEl.textContent = memories.length;
      if (graphCountEl) graphCountEl.textContent = graph_edges.length;

      // 渲染左侧特征记忆卡片
      const memContainer = $("memory-cards-container");
      if (memContainer) {
        if (!memories.length) {
          memContainer.innerHTML = '<div class="empty-tip">暂无沉淀画像，与智能体进行对话即可自动提取！</div>';
        } else {
          memContainer.innerHTML = memories
            .map(
              (m) => `
            <div class="memory-card">
              <div>
                <span class="memory-tag ${escapeHtml(m.memory_type)}">${escapeHtml(m.memory_type)}</span>
                <div class="memory-content-text">${escapeHtml(m.value)}</div>
              </div>
              <button class="memory-del-btn" onclick="deleteUserMemory(${m.id})" title="删除特征">✕</button>
            </div>
          `
            )
            .join("");
        }
      }

      // 渲染右侧知识图谱三元组关系
      const graphContainer = $("graph-network-container");
      if (graphContainer) {
        if (!graph_edges.length) {
          graphContainer.innerHTML = '<div class="empty-tip">知识图谱待激活，问答后将自动构建实体关系网！</div>';
        } else {
          graphContainer.innerHTML = graph_edges
            .map(
              (e) => `
            <div class="graph-edge-card">
              <div class="graph-triplet">
                <span class="graph-node">👤 ${escapeHtml(e.source)}</span>
                <span class="graph-relation">──[ ${escapeHtml(e.relation)} ]──▶</span>
                <span class="graph-target">🏷️ ${escapeHtml(e.target)}</span>
              </div>
              <span class="graph-weight-badge">频次: ×${e.weight}</span>
            </div>
          `
            )
            .join("");
        }
      }
    }
  } catch (e) {
    console.error("加载用户画像图谱失败:", e);
  }
}

async function saveUserMemory() {
  const memType = $("new-mem-type").value;
  const key = $("new-mem-key").value.trim();
  const val = $("new-mem-val").value.trim();

  if (!key || !val) {
    alert("请填写特征标识与具体内容");
    return;
  }

  try {
    const resp = await fetch("/api/user/memory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ memory_type: memType, key: key, value: val }),
    });
    const body = await resp.json();
    if (body.code === 0) {
      closeAllModals();
      $("new-mem-key").value = "";
      $("new-mem-val").value = "";
      loadUserMemoryAndGraph();
    } else {
      alert("保存失败：" + body.message);
    }
  } catch (e) {
    alert("保存异常：" + e);
  }
}

window.deleteUserMemory = async function (id) {
  try {
    const resp = await fetch(`/api/user/memory/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      loadUserMemoryAndGraph();
    }
  } catch (e) {
    alert("删除失败：" + e);
  }
};

async function clearUserMemory() {
  if (!confirm("确定要清空该用户的全部长期记忆与知识图谱吗？清空后智能体将重置为无偏好状态。")) return;
  try {
    const resp = await fetch("/api/user/memory", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0) {
      alert("画像与知识图谱已清空！");
      loadUserMemoryAndGraph();
    }
  } catch (e) {
    alert("清空失败：" + e);
  }
}
// ==============================
// 10. API 管理与 LLM 智能网关
// ==============================
let gatewayProvidersCache = [];
let gatewayRoutesCache = [];

async function loadGatewayConfig() {
  if (!state.token) return;
  try {
    const [pResp, rResp] = await Promise.all([
      fetch("/api/gateway/providers", { headers: { Authorization: `Bearer ${state.token}` } }),
      fetch("/api/gateway/routes", { headers: { Authorization: `Bearer ${state.token}` } }),
    ]);
    const pData = await pResp.json();
    const rData = await rResp.json();

    if (pData.code === 0) gatewayProvidersCache = pData.data || [];
    if (rData.code === 0) gatewayRoutesCache = rData.data || [];

    renderGatewayRoutes();
    renderGatewayProviders();
  } catch (e) {
    console.error("加载网关配置失败:", e);
  }
}

function renderGatewayRoutes() {
  const tbody = $("routes-tbody");
  if (!tbody) return;

  if (!gatewayRoutesCache.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无模型路由配置</td></tr>';
    return;
  }

  tbody.innerHTML = gatewayRoutesCache
    .map((r, idx) => {
      const providerOptions = gatewayProvidersCache
        .map((p) => `<option value="${p.provider_code}" ${p.provider_code === r.provider_code ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
        .join("");

      const currProv = gatewayProvidersCache.find((p) => p.provider_code === r.provider_code) || gatewayProvidersCache[0];
      const modelOptions = (currProv?.models || [])
        .map((m) => `<option value="${m.id}" ${m.id === r.model_name ? "selected" : ""}>${escapeHtml(m.name)}</option>`)
        .join("") + `<option value="${r.model_name}" ${!(currProv?.models || []).some(m => m.id === r.model_name) ? "selected" : ""}>${escapeHtml(r.model_name)} (自定义)</option>`;

      return `
      <tr>
        <td><strong>${escapeHtml(r.feature_name)}</strong><div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(r.feature_key)}</div></td>
        <td>
          <select class="dropdown-select" id="route-prov-${idx}" onchange="handleRouteProviderChange(${idx})">
            ${providerOptions}
          </select>
        </td>
        <td>
          <select class="dropdown-select" id="route-model-${idx}">
            ${modelOptions}
          </select>
        </td>
        <td>
          <input type="number" step="0.1" min="0" max="2" id="route-temp-${idx}" value="${r.temperature}" style="width:70px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-main);padding:4px;border-radius:4px;" />
        </td>
        <td>
          <input type="number" step="128" min="256" max="32768" id="route-tokens-${idx}" value="${r.max_tokens}" style="width:80px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-main);padding:4px;border-radius:4px;" />
        </td>
        <td>
          <button class="primary-btn" style="padding:4px 10px;font-size:12px;" onclick="saveRouteConfigByIndex(${idx})">💾 保存路由</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

window.handleRouteProviderChange = function (idx) {
  const provSelect = $(`route-prov-${idx}`);
  const modelSelect = $(`route-model-${idx}`);
  if (!provSelect || !modelSelect) return;

  const selectedCode = provSelect.value;
  const prov = gatewayProvidersCache.find((p) => p.provider_code === selectedCode);
  if (prov && prov.models) {
    modelSelect.innerHTML = prov.models
      .map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)
      .join("");
  }
};

window.saveRouteConfigByIndex = async function (idx) {
  const r = gatewayRoutesCache[idx];
  if (!r) return;
  const provCode = $(`route-prov-${idx}`).value;
  const modelName = $(`route-model-${idx}`).value;
  const temp = parseFloat($(`route-temp-${idx}`).value) || 0.7;
  const tokens = parseInt($(`route-tokens-${idx}`).value) || 2048;

  try {
    const resp = await fetch(`/api/gateway/routes/${r.feature_key}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        provider_code: provCode,
        model_name: modelName,
        temperature: temp,
        max_tokens: tokens,
      }),
    });
    const body = await resp.json();
    if (body.code === 0) {
      alert(`已成功更新【${r.feature_name}】模型路由 -> ${provCode} / ${modelName}`);
      loadGatewayConfig();
    } else {
      alert("保存路由失败: " + body.message);
    }
  } catch (e) {
    alert("请求异常: " + e);
  }
};

function renderGatewayProviders() {
  const grid = $("providers-grid");
  if (!grid) return;

  grid.innerHTML = gatewayProvidersCache
    .map(
      (p) => `
    <div class="provider-card">
      <div class="provider-header">
        <div class="provider-name">${escapeHtml(p.name)}</div>
        <span class="badge" style="font-size:10px;">${p.has_key ? "🟢 Key已就绪" : "⚪ 未填Key"}</span>
      </div>

      <div class="provider-model-badges">
        ${(p.models || []).map((m) => `<span class="model-pill">${escapeHtml(m.id)}</span>`).join("")}
      </div>

      <div class="provider-input-group">
        <label>API 基础地址 (Base URL):</label>
        <input type="text" id="prov-url-${p.provider_code}" value="${escapeHtml(p.base_url)}" />
      </div>

      <div class="provider-input-group">
        <label>API Key 密钥 (已遮蔽):</label>
        <input type="password" id="prov-key-${p.provider_code}" placeholder="${p.has_key ? p.api_key_masked : '输入 API Key'}" />
      </div>

      <div class="provider-actions">
        <button class="ghost-btn" style="font-size:12px;" onclick="testProviderConnectivity('${p.provider_code}')">⚡ 连通性测试</button>
        <button class="primary-btn" style="font-size:12px;padding:5px 12px;" onclick="saveProviderSettings('${p.provider_code}')">💾 保存配置</button>
      </div>
    </div>
  `
    )
    .join("");
}

window.saveProviderSettings = async function (code) {
  const url = $(`prov-url-${code}`).value.trim();
  const key = $(`prov-key-${code}`).value.trim();

  const payload = { base_url: url };
  if (key) payload.api_key = key;

  try {
    const resp = await fetch(`/api/gateway/providers/${code}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await resp.json();
    if (body.code === 0) {
      alert(`已成功更新厂商【${code}】配置！`);
      loadGatewayConfig();
    } else {
      alert("更新失败: " + body.message);
    }
  } catch (e) {
    alert("保存异常: " + e);
  }
};

window.testProviderConnectivity = async function (code) {
  try {
    const resp = await fetch("/api/gateway/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ provider_code: code }),
    });
    const body = await resp.json();
    if (body.code === 0 && body.data) {
      const { success, message } = body.data;
      alert(message);
    } else {
      alert("测试异常: " + (body.message || "未知错误"));
    }
  } catch (e) {
    alert("测试网络请求异常: " + e);
  }
};

// ==============================
// 11. Codex 编程工作台与项目分支管理
// ==============================
let activeProjectPath = "e:\\pro\\agent-learning";
let activeRelativeFile = "";

async function loadProjectsAndGit() {
  if (!state.token) return;
  try {
    const resp = await fetch("/api/projects/list", {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0 && body.data) {
      const projects = body.data;
      const projSelect = $("project-select");
      projSelect.innerHTML = projects
        .map((p) => `<option value="${escapeHtml(p.path)}" ${p.path === activeProjectPath ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
        .join("");

      activeProjectPath = projSelect.value || "e:\\pro\\agent-learning";
      await refreshGitBranches();
      await loadProjectTree();
    }
  } catch (e) {
    console.error("加载项目列表失败:", e);
  }
}

async function switchProject(path) {
  activeProjectPath = path;
  activeRelativeFile = "";
  $("current-file-path").textContent = "未选择文件";
  $("code-editor-area").value = "";
  await refreshGitBranches();
  await loadProjectTree();
}

async function refreshGitBranches() {
  if (!activeProjectPath) return;
  try {
    const resp = await fetch(`/api/projects/git?project_path=${encodeURIComponent(activeProjectPath)}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0 && body.data) {
      const git = body.data;
      const branchSelect = $("branch-select");
      if (git.branches && git.branches.length) {
        branchSelect.innerHTML = git.branches
          .map((b) => `<option value="${escapeHtml(b)}" ${b === git.current_branch ? "selected" : ""}>${escapeHtml(b)}</option>`)
          .join("");
      } else {
        branchSelect.innerHTML = '<option value="main">main</option>';
      }
    }
  } catch (e) {
    console.error("刷新分支失败:", e);
  }
}

async function checkoutCurrentBranch() {
  const branch = $("branch-select").value;
  if (!branch || !activeProjectPath) return;

  try {
    const resp = await fetch("/api/projects/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ project_path: activeProjectPath, branch_name: branch }),
    });
    const body = await resp.json();
    if (body.code === 0) {
      alert(`已成功切换到分支: ${branch}`);
      await refreshGitBranches();
      await loadProjectTree();
    } else {
      alert("切换分支失败: " + body.message);
    }
  } catch (e) {
    alert("切换分支网络错误: " + e);
  }
}

async function loadProjectTree() {
  const container = $("project-tree-list");
  if (!container || !activeProjectPath) return;
  container.innerHTML = '<div class="empty-tip">读取工程目录结构中...</div>';

  try {
    const resp = await fetch(`/api/projects/tree?project_path=${encodeURIComponent(activeProjectPath)}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const body = await resp.json();
    if (body.code === 0 && body.data) {
      container.innerHTML = renderTreeNodes(body.data);
    }
  } catch (e) {
    container.innerHTML = `<div class="empty-tip">加载树失败: ${e}</div>`;
  }
}

function renderTreeNodes(nodes, indent = 0) {
  if (!nodes || !nodes.length) return "";
  return nodes
    .map((node) => {
      const pad = indent * 14;
      if (node.type === "directory") {
        return `
          <div class="tree-node folder" style="padding-left: ${pad + 6}px;">
            📁 <strong>${escapeHtml(node.name)}</strong>
          </div>
          ${renderTreeNodes(node.children, indent + 1)}
        `;
      } else {
        const isActive = node.path === activeRelativeFile;
        return `
          <div class="tree-node file ${isActive ? "active-file" : ""}" style="padding-left: ${pad + 6}px;" onclick="openProjectFile('${escapeHtml(node.path)}')">
            📄 ${escapeHtml(node.name)}
          </div>
        `;
      }
    })
    .join("");
}

window.openProjectFile = async function (relPath) {
  activeRelativeFile = relPath;
  $("current-file-path").textContent = relPath;

  // 高亮当前选中节点
  document.querySelectorAll(".tree-node.file").forEach((el) => {
    el.classList.toggle("active-file", el.textContent.includes(relPath.split("/").pop()));
  });

  try {
    const resp = await fetch(
      `/api/projects/file?project_path=${encodeURIComponent(activeProjectPath)}&file_path=${encodeURIComponent(relPath)}`,
      { headers: { Authorization: `Bearer ${state.token}` } }
    );
    const body = await resp.json();
    if (body.code === 0 && body.data) {
      $("code-editor-area").value = body.data.content || "";
    } else {
      $("code-editor-area").value = "读取文件失败: " + body.message;
    }
  } catch (e) {
    $("code-editor-area").value = "请求异常: " + e;
  }
};

async function saveCurrentFileCode() {
  if (!activeRelativeFile || !activeProjectPath) {
    alert("请先从左侧文件树选择要保存的代码文件！");
    return;
  }
  const content = $("code-editor-area").value;
  try {
    const resp = await fetch("/api/projects/file", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        project_path: activeProjectPath,
        file_path: activeRelativeFile,
        content: content,
      }),
    });
    const body = await resp.json();
    if (body.code === 0) {
      alert(`文件已成功保存: ${activeRelativeFile}`);
    } else {
      alert("保存失败: " + body.message);
    }
  } catch (e) {
    alert("保存网络异常: " + e);
  }
}

window.useCodexPrompt = function (promptText) {
  const input = $("codex-query-input");
  if (input) {
    input.value = promptText;
    input.focus();
  }
};

async function sendCodexChat() {
  const input = $("codex-query-input");
  const query = input.value.trim();
  if (!query) return;

  const msgContainer = $("codex-messages");
  // 插入用户消息
  const userDiv = document.createElement("div");
  userDiv.className = "codex-msg user";
  userDiv.textContent = query;
  msgContainer.appendChild(userDiv);
  input.value = "";

  // 插入助手占位
  const aiDiv = document.createElement("div");
  aiDiv.className = "codex-msg assistant";
  aiDiv.textContent = "Codex 正在分析工程上下文并编写代码...";
  msgContainer.appendChild(aiDiv);
  msgContainer.scrollTop = msgContainer.scrollHeight;

  // 附加当前文件上下文
  const fullPrompt = `/codex [当前工程: ${activeProjectPath}] [当前文件: ${activeRelativeFile || "未指定"}]\n${query}`;

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ query: fullPrompt }),
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              accumulated += parsed.content;
              aiDiv.innerHTML = renderMarkdown(accumulated);
              msgContainer.scrollTop = msgContainer.scrollHeight;
            }
          } catch (_) {
            if (line.slice(6).trim() && !line.includes("[DONE]")) {
              accumulated += line.slice(6);
              aiDiv.innerHTML = renderMarkdown(accumulated);
            }
          }
        }
      }
    }
  } catch (e) {
    aiDiv.textContent = "Codex 响应异常: " + e;
  }
}

function launchDesktopClient() {
  alert(
    "🖥️ 桌面客户端支持：\n\n已为您准备了独立桌面端启动器！\n在本地终端运行：python desktop_launcher.py\n即可立即唤起统一智能体平台的原生独立桌面窗口应用程序！"
  );
}