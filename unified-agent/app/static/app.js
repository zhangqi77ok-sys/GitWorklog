// 统一智能体平台前端：登录 + SSE 流式聊天。
// chat 端点是 POST + text/event-stream，浏览器原生 EventSource 只支持 GET，
// 故用 fetch + ReadableStream 手动解析 SSE 帧。

const $ = (id) => document.getElementById(id);
const state = { token: localStorage.getItem("token"), user: null };

// ---------- 登录 ----------
async function login() {
  const username = $("username").value.trim();
  const password = $("password").value;
  $("login-error").textContent = "";
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
    showChat();
  } catch (e) {
    $("login-error").textContent = "网络错误：" + e;
  }
}

function logout() {
  state.token = null;
  localStorage.removeItem("token");
  $("chat-panel").classList.add("hidden");
  $("login-panel").classList.remove("hidden");
}

function showChat() {
  $("login-panel").classList.add("hidden");
  $("chat-panel").classList.remove("hidden");
  $("who").textContent = state.user ? `已登录：${state.user}` : "已登录";
  $("query").focus();
}

// ---------- 消息渲染 ----------
function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  $("messages").appendChild(div);
  $("messages").scrollTop = $("messages").scrollHeight;
  return div;
}

function addProgress(text) {
  const div = document.createElement("div");
  div.className = "progress";
  div.textContent = text;
  $("messages").appendChild(div);
  $("messages").scrollTop = $("messages").scrollHeight;
  return div;
}

// ---------- SSE 流式聊天 ----------
// 解析 SSE 帧：以空行分隔，行内 event: / data: 字段。
function parseFrames(buffer) {
  const frames = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop(); // 最后一段可能不完整，留回缓冲
  for (const part of parts) {
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    frames.push({ event, data });
  }
  return { frames, rest };
}

async function send() {
  const query = $("query").value.trim();
  if (!query) return;
  $("query").value = "";
  addMessage("user", query);

  const agentDiv = addMessage("agent", "");
  let acc = "";

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: state.token ? `Bearer ${state.token}` : "",
      },
      body: JSON.stringify({ query }),
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
        handleEvent(f, agentDiv, (t) => (acc += t) && (agentDiv.textContent = acc));
      }
    }
  } catch (e) {
    agentDiv.textContent = acc + `\n[连接错误：${e}]`;
  }
}

function handleEvent(frame, agentDiv, appendText) {
  let payload = {};
  try {
    payload = JSON.parse(frame.data);
  } catch {
    /* 非 JSON 忽略 */
  }
  switch (frame.event) {
    case "agent_switch":
      addProgress(`↳ 路由到「${payload.domain}」（意图：${payload.intent || "?"}）`);
      break;
    case "message":
      appendText(payload.text || "");
      break;
    case "thinking":
      // 可选：思考过程，这里并入进度
      break;
    case "progress":
      addProgress(`… ${payload.phase || ""}${payload.tool ? " · " + payload.tool : ""}`);
      break;
    case "error":
      addProgress(`⚠ ${payload.message || "错误"}`);
      break;
    case "done":
      $("messages").scrollTop = $("messages").scrollHeight;
      break;
    default:
      break;
  }
}

// ---------- 事件绑定 ----------
$("login-btn").addEventListener("click", login);
$("password").addEventListener("keydown", (e) => e.key === "Enter" && login());
$("logout-btn").addEventListener("click", logout);
$("send-btn").addEventListener("click", send);
$("query").addEventListener("keydown", (e) => e.key === "Enter" && send());

// 已有 token 直接进聊天
if (state.token) showChat();

