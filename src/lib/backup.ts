import {
  isRecord,
  normalizeSnippetArray,
  type Snippet,
} from './snippets';

export function downloadBackup(snippets: Snippet[]): void {
  const payload = {
    app: 'tcode',
    version: 1,
    exportedAt: new Date().toISOString(),
    snippets,
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `tcode-snippets-backup-${date}.json`;

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function parseBackupFile(file: File): Promise<Snippet[]> {
  const text = await file.text();

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('备份文件不是有效 JSON');
  }

  const rawList = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.snippets)
      ? parsed.snippets
      : null;

  if (rawList === null) {
    throw new Error('备份文件缺少 snippets 数组');
  }

  const snippets = normalizeSnippetArray(parsed);

  if (snippets.length === 0 && rawList.length > 0) {
    throw new Error('备份文件中没有可识别的片段');
  }

  return snippets;
}
