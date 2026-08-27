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
  const wsUrl = pages[0].webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log("[Browser Console]", msg.params.type, msg.params.args.map(a => a.value || a.description).join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.error("[Browser JS Error]", msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
    }
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

  // 点击登录按钮
  const loginRes = await send("Runtime.evaluate", {
    expression: `
      document.getElementById('login-btn').click();
      'clicked login'
    `
  });
  console.log("Login evaluated:", loginRes);

  await new Promise(r => setTimeout(r, 2000));

  // 检查 DOM 元素
  const domInfo = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const chatView = document.getElementById('chat-view');
        const query = document.getElementById('query');
        const composer = document.querySelector('.composer');
        const compContainer = document.querySelector('.composer-container');
        const messages = document.getElementById('messages');
        const activePane = document.querySelector('.view-pane.active');

        function rect(el) {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility };
        }

        return {
          activePaneId: activePane ? activePane.id : null,
          chatView: rect(chatView),
          composer: rect(composer),
          compContainer: rect(compContainer),
          query: rect(query),
          messages: rect(messages)
        };
      })()
    `,
    returnByValue: true
  });

  console.log("DOM Inspection:", JSON.stringify(domInfo.result?.value, null, 2));

  // 截图
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  if (screenshot && screenshot.data) {
    fs.writeFileSync("e:\\pro\\agent-learning\\data\\chat_screenshot.png", Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot saved to data/chat_screenshot.png");
  }

  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});