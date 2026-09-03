const fs = require('fs');
const path = require('path');

/**
 * 扫描指定工程目录下的 docs/knowledge/ 知识库沉淀
 */
function scanKnowledgeVault(workspaceRoot) {
  const knowledgeDir = path.join(workspaceRoot, 'docs', 'knowledge');
  if (!fs.existsSync(knowledgeDir)) {
    return [];
  }

  const files = fs.readdirSync(knowledgeDir).filter(
    (f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md'
  );

  return files.map((filename) => {
    const filePath = path.join(knowledgeDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');

    // 提取主标题
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filename;

    // 提取四段论章节
    const bgMatch = content.match(/##\s+①[^\n]*\n([\s\S]*?)(?=##\s+②|$)/);
    const coreMatch = content.match(/##\s+②[^\n]*\n([\s\S]*?)(?=##\s+③|$)/);
    const solMatch = content.match(/##\s+③[^\n]*\n([\s\S]*?)(?=##\s+④|$)/);
    const avoidMatch = content.match(/##\s+④[^\n]*\n([\s\S]*?)$/);

    // 自动判断分类标签
    let category = '综合工程规范';
    if (filename.includes('tauri') || filename.includes('installer') || filename.includes('packaging')) {
      category = '桌面与安装包构建';
    } else if (filename.includes('waf') || filename.includes('gateway') || filename.includes('protocol')) {
      category = '网关与网络穿透';
    } else if (filename.includes('sandbox') || filename.includes('terminal') || filename.includes('daemon')) {
      category = '安全沙箱与 Shell';
    } else if (filename.includes('loop') || filename.includes('react') || filename.includes('agent')) {
      category = '认知流与自愈循环';
    } else if (filename.includes('memory') || filename.includes('session') || filename.includes('state')) {
      category = '状态机与持久化';
    }

    return {
      filename,
      title,
      category,
      charCount: content.length,
      background: bgMatch ? bgMatch[1].trim() : '',
      corePrinciple: coreMatch ? coreMatch[1].trim() : '',
      solution: solMatch ? solMatch[1].trim() : '',
      avoidTip: avoidMatch ? avoidMatch[1].trim() : '',
      rawContent: content,
    };
  });
}

/**
 * 本地知识库多权重 RAG 检索
 */
function searchKnowledge(workspaceRoot, query, topK = 4) {
  const docs = scanKnowledgeVault(workspaceRoot);
  if (!query || !query.trim()) {
    return docs.slice(0, topK);
  }

  const terms = query
    .toLowerCase()
    .split(/[\s,，、/\\._\-+]+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) return docs.slice(0, topK);

  const scored = docs.map((doc) => {
    let score = 0;
    const lowerTitle = doc.title.toLowerCase();
    const lowerAvoid = doc.avoidTip.toLowerCase();
    const lowerSol = doc.solution.toLowerCase();
    const lowerRaw = doc.rawContent.toLowerCase();

    for (const term of terms) {
      // 标题命中: 10 分
      if (lowerTitle.includes(term)) score += 10;
      // 避坑与解决方案命中: 5 分
      if (lowerAvoid.includes(term)) score += 5;
      if (lowerSol.includes(term)) score += 4;
      // 全文匹配: 1 分
      if (lowerRaw.includes(term)) score += 1;
    }

    return { ...doc, score };
  });

  return scored
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = {
  scanKnowledgeVault,
  searchKnowledge,
};
