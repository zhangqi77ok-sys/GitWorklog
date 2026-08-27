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

  // 2. 在对话框输入包含偏好、常驻城市、航司与酒店的语句
  const prompt = "你好，我在北京常驻办公，以后出差帮我优先选中国国航早班机靠窗，住宿帮我定万豪酒店，预算不能超过1000元。";
  await send("Runtime.evaluate", {
    expression: `
      document.getElementById('query').value = ${JSON.stringify(prompt)};
      document.getElementById('send-btn').click();
    `
  });

  // 等待流式回答完成并沉淀记忆 (约 6 秒)
  await new Promise(r => setTimeout(r, 6000));

  // 3. 切换到「🧠 用户图谱与记忆」页面
  await send("Runtime.evaluate", {
    expression: `document.querySelector(".nav-tabs button[data-tab='memory-view']").click()`
  });
  await new Promise(r => setTimeout(r, 1500));

  // 4. 检查特征卡片与知识图谱
  const memoryInfo = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const memCount = document.getElementById('memory-count-label').innerText;
        const graphCount = document.getElementById('graph-count-label').innerText;
        const cardTexts = Array.from(document.querySelectorAll('.memory-card .memory-content-text')).map(c => c.innerText);
        const edgeTexts = Array.from(document.querySelectorAll('.graph-edge-card .graph-triplet')).map(c => c.innerText);
        return { memCount, graphCount, cardTexts, edgeTexts };
      })()
    `,
    returnByValue: true
  });
  console.log("Learned Memory & Graph:", JSON.stringify(memoryInfo.result?.value, null, 2));

  // 截图
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  if (screenshot && screenshot.data) {
    fs.writeFileSync("e:\\pro\\agent-learning\\data\\memory_graph_learned_screenshot.png", Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot saved to data/memory_graph_learned_screenshot.png");
  }

  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });