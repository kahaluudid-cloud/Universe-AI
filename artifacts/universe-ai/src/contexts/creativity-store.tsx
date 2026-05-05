import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type CreativityType = "website" | "textbook" | "presentation";

export interface CreativityItem {
  id: string;
  type: CreativityType;
  title: string;
  timestamp: Date;
  fileCount?: number;
  fileNames?: string[];
  wordCount?: number;
  slideCount?: number;
  previewHtml?: string;
  downloadContent?: string;
  downloadFilename?: string;
}

interface CreativityStoreValue {
  items: CreativityItem[];
  addItem: (item: Omit<CreativityItem, "id" | "timestamp">) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
}

const STORAGE_KEY = "universe_ai_creativity";

function loadItems(): CreativityItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((item: CreativityItem & { timestamp: string }) => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveItems(items: CreativityItem[]) {
  try {
    const slim = items.map(item => ({
      ...item,
      previewHtml: item.previewHtml?.slice(0, 8000),
      downloadContent: item.downloadContent?.slice(0, 40000),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    // Storage full - ignore
  }
}

const CreativityStoreContext = createContext<CreativityStoreValue | null>(null);

export function CreativityStoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CreativityItem[]>(() => loadItems());

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const addItem = useCallback((item: Omit<CreativityItem, "id" | "timestamp">) => {
    const newItem: CreativityItem = {
      ...item,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date(),
    };
    setItems(prev => [newItem, ...prev].slice(0, 50));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  return (
    <CreativityStoreContext.Provider value={{ items, addItem, removeItem, clearAll }}>
      {children}
    </CreativityStoreContext.Provider>
  );
}

export function useCreativityStore() {
  const ctx = useContext(CreativityStoreContext);
  if (!ctx) throw new Error("useCreativityStore must be used inside CreativityStoreProvider");
  return ctx;
}
