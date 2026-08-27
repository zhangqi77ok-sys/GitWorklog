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

  // 2. 输入问题并发送
  await send("Runtime.evaluate", {
    expression: `
      document.getElementById('query').value = '帮我查一下杭州明天的天气和出行攻略';
      document.getElementById('send-btn').click();
    `
  });

  console.log("Chat sent, waiting for streaming response...");
  await new Promise(r => setTimeout(r, 6000));

  // 3. 检查消息渲染
  const msgRes = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const wrappers = document.querySelectorAll('.message-wrapper');
        const list = Array.from(wrappers).map(w => ({
          role: w.className,
          text: w.querySelector('.msg-content')?.innerText || ''
        }));
        return { count: wrappers.length, messages: list };
      })()
    `,
    returnByValue: true
  });

  console.log("Rendered messages in browser:", JSON.stringify(msgRes.result?.value, null, 2));

  // 截图
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  if (screenshot && screenshot.data) {
    fs.writeFileSync("e:\\pro\\agent-learning\\data\\chat_active_screenshot.png", Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot saved to data/chat_active_screenshot.png");
  }

  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });