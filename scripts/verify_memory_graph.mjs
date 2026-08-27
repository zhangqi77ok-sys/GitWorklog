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

  // 2. 切换到「🧠 用户图谱与记忆」页面
  await send("Runtime.evaluate", {
    expression: `document.querySelector(".nav-tabs button[data-tab='memory-view']").click()`
  });
  await new Promise(r => setTimeout(r, 1500));

  // 3. 检查页面元素
  const memoryInfo = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const memCount = document.getElementById('memory-count-label').innerText;
        const graphCount = document.getElementById('graph-count-label').innerText;
        const cards = Array.from(document.querySelectorAll('.memory-card')).length;
        const edges = Array.from(document.querySelectorAll('.graph-edge-card')).length;
        return { memCount, graphCount, cards, edges };
      })()
    `,
    returnByValue: true
  });
  console.log("Memory & Graph View Info:", JSON.stringify(memoryInfo.result?.value, null, 2));

  // 截图
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  if (screenshot && screenshot.data) {
    fs.writeFileSync("e:\\pro\\agent-learning\\data\\memory_graph_screenshot.png", Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot saved to data/memory_graph_screenshot.png");
  }

  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });