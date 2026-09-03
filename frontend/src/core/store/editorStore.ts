import { create } from 'zustand'

export interface FileNode {
  name: string
  path: string
  is_dir: boolean
  children?: FileNode[]
}

interface EditorState {
  fileTree: FileNode[]
  openTabs: string[]
  activeFile: string | null
  activeContent: string
  originalContent: string
  isDiffMode: boolean
  isLoading: boolean
  isTreeLoading: boolean

  fetchTree: () => Promise<void>
  openFile: (path: string, diffMode?: boolean) => Promise<void>
  closeTab: (path: string) => void
  setActiveFile: (path: string) => Promise<void>
  toggleDiffMode: () => void
  setContent: (content: string) => void
  saveActiveFile: () => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  fileTree: [],
  openTabs: [],
  activeFile: null,
  activeContent: '',
  originalContent: '',
  isDiffMode: false,
  isLoading: false,
  isTreeLoading: false,

  fetchTree: async () => {
    set({ isTreeLoading: true })
    try {
      const res = await fetch('http://127.0.0.1:8765/api/fs/tree')
      if (res.ok) {
        const tree = await res.json()
        set({ fileTree: tree || [], isTreeLoading: false })
      }
    } catch {
      set({ isTreeLoading: false })
    }
  },

  openFile: async (path: string, diffMode = false) => {
    const { openTabs } = get()
    if (!openTabs.includes(path)) {
      set({ openTabs: [...openTabs, path] })
    }

    set({ activeFile: path, isDiffMode: diffMode, isLoading: true })

    try {
      const [readRes, origRes] = await Promise.all([
        fetch(`http://127.0.0.1:8765/api/fs/read?path=${encodeURIComponent(path)}`),
        fetch(`http://127.0.0.1:8765/api/fs/original?path=${encodeURIComponent(path)}`),
      ])

      let content = ''
      let original = ''

      if (readRes.ok) {
        const readData = await readRes.json()
        content = readData.content || ''
      }
      if (origRes.ok) {
        const origData = await origRes.json()
        original = origData.original || ''
      }

      set({
        activeContent: content,
        originalContent: original,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  closeTab: (path: string) => {
    const { openTabs, activeFile } = get()
    const newTabs = openTabs.filter((t) => t !== path)
    let nextActive = activeFile

    if (activeFile === path) {
      nextActive = newTabs.length > 0 ? (newTabs[newTabs.length - 1] ?? null) : null
    }

    set({ openTabs: newTabs })
    if (nextActive && nextActive !== activeFile) {
      get().openFile(nextActive)
    } else if (!nextActive) {
      set({ activeFile: null, activeContent: '', originalContent: '', isDiffMode: false })
    }
  },

  setActiveFile: async (path: string) => {
    if (get().activeFile === path) return
    await get().openFile(path, get().isDiffMode)
  },

  toggleDiffMode: () => {
    set((state) => ({ isDiffMode: !state.isDiffMode }))
  },

  setContent: (content: string) => {
    set({ activeContent: content })
  },

  saveActiveFile: async () => {
    const { activeFile, activeContent } = get()
    if (!activeFile) return

    try {
      await fetch('http://127.0.0.1:8765/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile, content: activeContent }),
      })
    } catch (err) {
      console.error('[Editor] Save failed:', err)
    }
  },
}))
