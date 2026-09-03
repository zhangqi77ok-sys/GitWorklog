const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.venv',
  'coverage',
  '__tests__',
  'release',
]);

/**
 * 递归扫描工程，提取 TypeScript/JavaScript 文件的真实模块拓扑网络
 */
function scanAstTopology(workspaceRoot) {
  const nodes = [];
  const edges = [];
  const scannedPaths = new Set();

  function traverse(currentDir, baseDir, category) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const ent of entries) {
      if (IGNORED_DIRS.has(ent.name)) continue;
      const fullPath = path.join(currentDir, ent.name);

      if (ent.isDirectory()) {
        traverse(fullPath, baseDir, category);
      } else if (
        ent.name.endsWith('.ts') ||
        ent.name.endsWith('.tsx') ||
        ent.name.endsWith('.js')
      ) {
        const relPath = path.relative(workspaceRoot, fullPath).replace(/\\/g, '/');
        if (scannedPaths.has(relPath)) continue;
        scannedPaths.add(relPath);

        let content = '';
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          continue;
        }

        // 提取主要 Export
        const exportSymbols = [];
        const expRegex = /export\s+(?:const|function|class|interface|type)\s+([a-zA-Z0-9_]+)/g;
        let match;
        while ((match = expRegex.exec(content)) !== null) {
          exportSymbols.push(match[1]);
          if (exportSymbols.length >= 6) break;
        }

        let nodeType = 'module';
        if (ent.name.endsWith('.tsx')) {
          nodeType = 'component';
        } else if (relPath.includes('store')) {
          nodeType = 'store';
        } else if (relPath.includes('backend')) {
          nodeType = 'service';
        }

        nodes.push({
          id: relPath,
          name: ent.name,
          path: relPath,
          type: nodeType,
          category: category,
          exports: exportSymbols,
          size: content.length,
        });

        // 提取相对引用 import
        const impRegex = /from\s+['"](\.[^'"]+)['"]/g;
        let impMatch;
        while ((impMatch = impRegex.exec(content)) !== null) {
          const importRelPath = impMatch[1];
          // 解析目标文件大致路径
          const resolvedDir = path.dirname(fullPath);
          const candidateBase = path.resolve(resolvedDir, importRelPath);

          let targetRel = '';
          const exts = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx'];
          for (const ext of exts) {
            const cand = candidateBase + ext;
            if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
              targetRel = path.relative(workspaceRoot, cand).replace(/\\/g, '/');
              break;
            }
          }

          if (targetRel) {
            edges.push({
              source: relPath,
              target: targetRel,
              relationship: 'imports',
            });
          }
        }
      }
    }
  }

  // 重点扫描前端与后端源码
  traverse(path.join(workspaceRoot, 'frontend', 'src'), workspaceRoot, 'frontend');
  traverse(path.join(workspaceRoot, 'backend'), workspaceRoot, 'backend');

  return {
    nodes,
    edges,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };
}

module.exports = {
  scanAstTopology,
};
