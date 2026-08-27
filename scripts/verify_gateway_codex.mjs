import { spawn } from "child_process";
import fs from "fs";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function run() {
  const edge = spawn(edgePath, [
    "--remote-debugging-port=9222",
    "--headless=new",
    "--disable-gpu",
    "--window-size=1400,900",
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

  // 2. 切换到「🔌 API 与模型网关」页面
  await send("Runtime.evaluate", {
    expression: `document.querySelector(".nav-tabs button[data-tab='gateway-view']").click()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const gatewayInfo = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const routes = Array.from(document.querySelectorAll('#routes-tbody tr')).length;
        const providers = Array.from(document.querySelectorAll('.provider-card')).length;
        return { routes, providers };
      })()
    `,
    returnByValue: true
  });
  console.log("Gateway Info:", JSON.stringify(gatewayInfo.result?.value, null, 2));

  const gwScreenshot = await send("Page.captureScreenshot", { format: "png" });
  if (gwScreenshot && gwScreenshot.data) {
    fs.writeFileSync("e:\\pro\\agent-learning\\data\\gateway_view_screenshot.png", Buffer.from(gwScreenshot.data, "base64"));
    console.log("Saved data/gateway_view_screenshot.png");
  }

  // 3. 切换到「💻 Codex 编程」页面
  await send("Runtime.evaluate", {
    expression: `document.querySelector(".nav-tabs button[data-tab='coding-view']").click()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const codingInfo = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const projects = Array.from(document.querySelectorAll('#project-select option')).map(o => o.text);
        const branches = Array.from(document.querySelectorAll('#branch-select option')).map(o => o.text);
        const treeNodes = Array.from(document.querySelectorAll('.tree-node')).length;
        return { projects, branches, treeNodes };
      })()
    `,
    returnByValue: true
  });
  console.log("Coding Workspace Info:", JSON.stringify(codingInfo.result?.value, null, 2));

  // 点击打开第一个代码文件
  await send("Runtime.evaluate", {
    expression: `
      const firstFile = document.querySelector('.tree-node.file');
      if (firstFile) firstFile.click();
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  const editorInfo = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const currFile = document.getElementById('current-file-path').innerText;
        const codeLength = document.getElementById('code-editor-area').value.length;
        return { currFile, codeLength };
      })()
    `,
    returnByValue: true
  });
  console.log("Editor Info:", JSON.stringify(editorInfo.result?.value, null, 2));

  const codingScreenshot = await send("Page.captureScreenshot", { format: "png" });
  if (codingScreenshot && codingScreenshot.data) {
    fs.writeFileSync("e:\\pro\\agent-learning\\data\\coding_view_screenshot.png", Buffer.from(codingScreenshot.data, "base64"));
    console.log("Saved data/coding_view_screenshot.png");
  }

  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });