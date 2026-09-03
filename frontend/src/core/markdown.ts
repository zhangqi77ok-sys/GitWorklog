import { marked } from 'marked'

// 配置 marked
marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(content: string): string {
  if (!content) return ''
  try {
    return marked.parse(content) as string
  } catch (err) {
    return content
  }
}
