/**
 * Deep Git Workflow Integration Engine
 * Generates Conventional Commit messages from changesets and provides 1-click atomic commits.
 */

export interface ConventionalCommitSuggestion {
  type: 'feat' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore';
  scope: string;
  subject: string;
  fullMessage: string;
}

/**
 * Automatically infers Conventional Commit message from modified files and task summary.
 */
export function generateConventionalCommitMessage(
  files: string[],
  taskSummary: string = '完成任务变更'
): ConventionalCommitSuggestion {
  let type: ConventionalCommitSuggestion['type'] = 'feat';
  let scope = 'core';

  const hasTests = files.some(f => f.includes('test') || f.includes('spec'));
  const hasContracts = files.some(f => f.includes('contract') || f.includes('types'));
  const hasComponents = files.some(f => f.includes('components') || f.includes('UI') || f.includes('Panel'));
  const hasServices = files.some(f => f.includes('services'));
  const hasDocs = files.some(f => f.endsWith('.md') || f.includes('doc'));

  if (/fix|bug|error|报错|自愈|修复/i.test(taskSummary)) {
    type = 'fix';
  } else if (/refactor|重构|优化|清理/i.test(taskSummary)) {
    type = 'refactor';
  } else if (hasTests && files.length === 1) {
    type = 'test';
  } else if (hasDocs && files.length === 1) {
    type = 'docs';
  }

  if (hasComponents) scope = 'ui';
  else if (hasContracts) scope = 'contracts';
  else if (hasServices) scope = 'services';
  else if (hasTests) scope = 'tests';

  const cleanSubject = taskSummary
    .replace(/^✓\s*/, '')
    .replace(/\s*\([^)]*\)$/, '')
    .replace(/^(完成|实现|支持|优化|修复)\s*/, '')
    .trim()
    .slice(0, 50) || 'update workspace changes';

  const fullMessage = `${type}(${scope}): ${cleanSubject}`;

  return {
    type,
    scope,
    subject: cleanSubject,
    fullMessage
  };
}

/**
 * Commits git changes on the desktop backend
 */
export async function commitGitChanges(
  projectPath: string,
  commitMessage: string
): Promise<{ success: boolean; commitHash?: string; error?: string }> {
  try {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, message: commitMessage })
    });
    const data = await res.json();
    return {
      success: !!data.success,
      commitHash: data.commitHash,
      error: data.error
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
