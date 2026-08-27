import { spawn } from "child_process";
import fs from "fs";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function run() {
  // 1. 通过 API 上传一份测试知识库文档
  const loginRes = await fetch("http://127.0.0.1:8010/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });
  const token = (await loginRes.json()).data.token;

  const form = new FormData();
  const blob = new Blob(["【企业差旅及报销管理规范】\n第一条：员工出差机票需提前3天在平台预订。\n第二条：住宿费报销上限为每天500元。"], { type: "text/plain" });
  form.append("file", blob, "公司差旅制度2026.txt");

  await fetch("http://127.0.0.1:8010/api/files/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  const edge = spawn(edgePath, [
    "--remote-debugging-port=9222",
    "--headless=new",
    "--disable-gpu",
    "--window-size=1280,800",
    "--user-data-dir=e:\\pro\\agent-learning\\data\\temp_edge_profile",
    "about:blank"
  ]);

  await new Promise(r => setTimeout(r, 1500));
  const listResp = await fetch("http://127.0.0.1:9222/json/list");
  const pages = await listResp.json();
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  await new Promise(r => ws.onopen = r);
  function send(method, params = {}) {
    return new Promise(resolve => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:8010/" });
  await new Promise(r => setTimeout(r, 1500));

  // 登录
  await send("Runtime.evaluate", { expression: "document.getElementById('login-btn').click()" });
  await new Promise(r => setTimeout(r, 1500));

  // 打开知识库多选弹层
  await send("Runtime.evaluate", {
    expression: `document.getElementById('open-kb-btn').click()`
  });
  await new Promise(r => setTimeout(r, 1000));

  // 点击全选
  await send("Runtime.evaluate", {
    expression: `document.getElementById('kb-select-all-btn').click()`
  });
  await new Promise(r => setTimeout(r, 1000));

  // 检查挂载的 Chips 标签数与文本
  const chipRes = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const chips = Array.from(document.querySelectorAll('.kb-chip')).map(c => c.innerText);
        const badge = document.getElementById('kb-badge-count').innerText;
        return { count: chips.length, chips, badge };
      })()
    `,
    returnByValue: true
  });
  console.log("KB Chips verification:", JSON.stringify(chipRes.result?.value, null, 2));

  // 截图
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  if (screenshot && screenshot.data) {
    fs.writeFileSync("e:\\pro\\agent-learning\\data\\kb_selector_screenshot.png", Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot saved to data/kb_selector_screenshot.png");
  }

  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });