export interface StorageMetadata {
  savedAt: number;
  version: string;
}

// In-memory fallback map for Node/SSR/Vitest environments where window.localStorage might be unavailable
const memoryFallbackMap = new Map<string, string>();

const isLocalStorageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export const storageEngine = {
  save<T>(key: string, data: T): boolean {
    try {
      const payload = {
        meta: { savedAt: Date.now(), version: '2.0.0' },
        data
      };
      const serialized = JSON.stringify(payload);
      if (isLocalStorageAvailable()) {
        localStorage.setItem(`codemind_${key}`, serialized);
      }
      memoryFallbackMap.set(`codemind_${key}`, serialized);
      return true;
    } catch (err) {
      console.warn('LocalStorage save failed, using memory fallback:', err);
      return false;
    }
  },

  load<T>(key: string, defaultValue: T): T {
    try {
      let item: string | null = null;
      if (isLocalStorageAvailable()) {
        item = localStorage.getItem(`codemind_${key}`);
      }
      if (!item) {
        item = memoryFallbackMap.get(`codemind_${key}`) || null;
      }
      if (!item) return defaultValue;
      const parsed = JSON.parse(item);
      return parsed.data ?? defaultValue;
    } catch (err) {
      console.warn('LocalStorage load failed:', err);
      return defaultValue;
    }
  },

  remove(key: string): void {
    try {
      if (isLocalStorageAvailable()) {
        localStorage.removeItem(`codemind_${key}`);
      }
      memoryFallbackMap.delete(`codemind_${key}`);
    } catch (err) {
      console.warn('LocalStorage remove failed:', err);
    }
  },

  clearAll(): void {
    try {
      if (isLocalStorageAvailable()) {
        Object.keys(localStorage)
          .filter(k => k.startsWith('codemind_'))
          .forEach(k => localStorage.removeItem(k));
      }
      memoryFallbackMap.clear();
    } catch (err) {
      console.warn('LocalStorage clear failed:', err);
    }
  }
};
