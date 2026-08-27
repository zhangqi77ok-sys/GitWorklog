import { spawn } from "child_process";
import fs from "fs";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function run() {
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

  // 1. 登录
  await send("Runtime.evaluate", { expression: "document.getElementById('login-btn').click()" });
  await new Promise(r => setTimeout(r, 1500));

  // 2. 切换到技能管理 Tab
  await send("Runtime.evaluate", {
    expression: `document.querySelector('button[data-tab=\"skills-view\"]').click()`
  });
  await new Promise(r => setTimeout(r, 1500));

  // 检查技能卡片数
  const skillsCount = await send("Runtime.evaluate", {
    expression: `document.querySelectorAll('.skill-card').length`
  });
  console.log("Rendered skills count:", skillsCount.result?.value);

  // 3. 切换到文件知识库 Tab
  await send("Runtime.evaluate", {
    expression: `document.querySelector('button[data-tab=\"files-view\"]').click()`
  });
  await new Promise(r => setTimeout(r, 1500));

  // 检查 RAG 测试面板
  const ragPanelVisible = await send("Runtime.evaluate", {
    expression: `!!document.querySelector('.rag-test-panel')`
  });
  console.log("RAG Test panel present:", ragPanelVisible.result?.value);

  // 截图保存
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  if (screenshot && screenshot.data) {
    fs.writeFileSync("e:\\pro\\agent-learning\\data\\features_screenshot.png", Buffer.from(screenshot.data, "base64"));
    console.log("Saved screenshot to data/features_screenshot.png");
  }

  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });