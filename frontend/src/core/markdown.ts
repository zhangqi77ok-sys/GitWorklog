import { marked } from 'marked'

// 配置 marked
marked.setOptions({
  gfm: true,
  breaks: true,
})

const markdownCache = new Map<string, string>()
const MAX_CACHE_SIZE = 500

export function renderMarkdown(content: string): string {
  if (!content) return ''
  const cached = markdownCache.get(content)
  if (cached !== undefined) {
    return cached
  }
  try {
    const rendered = marked.parse(content) as string
    if (markdownCache.size >= MAX_CACHE_SIZE) {
      const firstKey = markdownCache.keys().next().value
      if (firstKey) markdownCache.delete(firstKey)
    }
    markdownCache.set(content, rendered)
    return rendered
  } catch (err) {
    return content
  }
}
