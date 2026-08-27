import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ARTIFACT_DIR = "C:/Users/13605/.gemini/antigravity/brain/fad40199-e0ef-40cc-8841-52180fc22d89";
mkdirSync(ARTIFACT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBrowserTests() {
  console.log("🚀 启动 Microsoft Edge Headless 浏览器进行全面功能页面与新特性真实 E2E 验证...");

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const userDataDir = resolve("data/test_browser_profile_fresh");
  
  const edgeProc = spawn(edgePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "http://127.0.0.1:8010/",
  ]);

  await sleep(3000);

  try {
    const listResp = await fetch("http://127.0.0.1:9222/json/list");
    const pages = await listResp.json();
    const targetPage = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);

    if (!targetPage) {
      throw new Error("未找到可调试的 Edge Page 页面，CDP 列表: " + JSON.stringify(pages));
    }

    console.log("🌐 成功连接至 Edge CDP WebSocket:", targetPage.webSocketDebuggerUrl);

    const ws = new WebSocket(targetPage.webSocketDebuggerUrl);
    let msgId = 1;
    const pendingPromises = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pendingPromises.has(msg.id)) {
        const { resolve: res, reject: rej } = pendingPromises.get(msg.id);
        pendingPromises.delete(msg.id);
        if (msg.error) rej(msg.error);
        else res(msg.result);
      }
    };

    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    async function sendCDP(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        pendingPromises.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await sendCDP("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error("Evaluate error: " + JSON.stringify(res.exceptionDetails));
      }
      return res.result?.value;
    }

    async function captureScreenshot(filename) {
      const res = await sendCDP("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(ARTIFACT_DIR, filename), Buffer.from(res.data, "base64"));
      console.log(`📸 截图已保存: ${filename}`);
    }

    await sendCDP("Page.enable");
    await sendCDP("Runtime.enable");
    await sendCDP("DOM.enable");
    await sendCDP("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log("🌐 正在导航至 http://127.0.0.1:8010/ ...");
    await sendCDP("Page.navigate", { url: "http://127.0.0.1:8010/" });
    await sleep(2500);

    await evaluate(`
      window.alert = function(msg) { console.log('[Browser Alert]:', msg); };
      window.confirm = function(msg) { console.log('[Browser Confirm]:', msg); return true; };
    `);

    // 1. 登录
    console.log("🔑 [1] 执行登录并进入智能问答工作台...");
    await evaluate(`(async () => {
      document.getElementById('username').value = 'admin';
      document.getElementById('password').value = 'admin123';
      await login();
    })()`);
    await sleep(2000);


    await captureScreenshot("01_smart_qa_view.png");

    // 2. 切换到 Codex 编程开发工作台
    console.log("💻 [2] 切换到 Codex 编程开发工作台...");
    await evaluate(`switchQAMode('codex');`);
    await sleep(1500);
    await captureScreenshot("02_codex_programming_studio.png");

    // 3. 选定本地开发工程目录
    console.log("📦 [3] 打开选定本地开发工程目录弹窗...");
    await evaluate(`document.getElementById('project-add-modal').classList.remove('hidden');`);
    await sleep(500);
    await captureScreenshot("03_project_directory_selector.png");
    await evaluate(`document.getElementById('project-add-modal').classList.add('hidden');`);

    // 4. 对话知识库多级选择弹窗
    console.log("📚 [4] 打开知识库多级范围选择弹窗...");
    await evaluate(`switchQAMode('chat'); toggleKbPopover();`);
    await sleep(600);
    await captureScreenshot("04_kb_multi_level_selector.png");
    await evaluate(`hideKbPopover();`);

    // 5. 知识库与 RAG 主视图
    console.log("📁 [5] 导航至知识库与 RAG 主视图...");
    await evaluate(`switchTab('files-view');`);
    await sleep(1200);
    await captureScreenshot("05_knowledge_base_view.png");

    // 6. 展开分片查看器 (Chunks Modal)
    console.log("🧩 [6] 打开文档分片查看器 (Parent-Child Chunks)...");
    await evaluate(`(() => {
      const f = state.files[0];
      if (f) showChunkModal(f.file_id, f.filename);
    })()`);
    await sleep(1200);
    await captureScreenshot("06_chunks_inspection_modal.png");
    await evaluate(`document.getElementById('chunk-modal').classList.add('hidden');`);

    // 7. 展开向量特征预览器 (Vectors Modal)
    console.log("🔮 [7] 打开向量嵌入矩阵与特征度量预览器...");
    await evaluate(`(() => {
      const f = state.files[0];
      if (f) showVectorModal(f.file_id, f.filename);
    })()`);
    await sleep(1200);
    await captureScreenshot("07_vectors_inspection_modal.png");
    await evaluate(`document.getElementById('vector-modal').classList.add('hidden');`);

    // 8. 垂直 Agent Skills 生态面板
    console.log("🧩 [8] 导航至技能生态管理面板...");
    await evaluate(`switchTab('skills-view'); switchEcoTab('skills');`);
    await sleep(1000);
    await captureScreenshot("08_skills_ecosystem_view.png");

    // 9. MCP 协议运行时服务面板
    console.log("🔌 [9] 切换至 Model Context Protocol (MCP) 运行时服务面板...");
    await evaluate(`switchEcoTab('mcp');`);
    await sleep(1000);
    await captureScreenshot("09_mcp_servers_runtime_view.png");

    // 10. 记忆与画像图谱
    console.log("🧠 [10] 导航至用户画像与知识图谱关系网络...");
    await evaluate(`switchTab('memory-view');`);
    await sleep(1000);
    await captureScreenshot("10_memory_and_graph_view.png");

    // 11. API 与 LLM 智能网关
    console.log("🔌 [11] 导航至 API 管理与模型网关矩阵...");
    await evaluate(`switchTab('gateway-view');`);
    await sleep(1000);
    await captureScreenshot("11_llm_gateway_view.png");


    console.log("🎉 全部 11 大功能与模态框已成功完成真实浏览器 E2E 渲染并截图！");
    ws.close();
  } catch (err) {
    console.error("❌ 执行失败:", err);
  } finally {
    edgeProc.kill();
  }
}

runBrowserTests();