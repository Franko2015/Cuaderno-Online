import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Compression utility for localStorage
const compressData = (data: string): string => {
  try {
    return btoa(unescape(encodeURIComponent(data)));
  } catch {
    return data; // Fallback if compression fails
  }
};

const decompressData = (compressed: string): string => {
  try {
    return decodeURIComponent(escape(atob(compressed)));
  } catch {
    return compressed; // Fallback if decompression fails
  }
};

// Storage quota management - will be initialized with platform detection
let isBrowserCache = false;

const initializePlatformDetection = (platformId: Object) => {
  isBrowserCache = isPlatformBrowser(platformId);
};

const checkStorageQuota = (): { used: number; available: number; percentage: number } => {
  if (!isBrowserCache) {
    return { used: 0, available: 0, percentage: 0 };
  }
  
  let used = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length + key.length;
    }
  }
  
  // Estimate 5MB typical localStorage limit
  const estimated = 5 * 1024 * 1024;
  const available = estimated - used;
  const percentage = (used / estimated) * 100;
  
  return { used, available, percentage };
};

// Cleanup old data
const cleanupOldData = () => {
  if (!isBrowserCache) return;
  
  const keys = Object.keys(localStorage);
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  
  keys.forEach(key => {
    if (key.startsWith('temp_') || key.startsWith('cache_')) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (parsed.timestamp && parsed.timestamp < thirtyDaysAgo) {
            localStorage.removeItem(key);
          }
        } catch {
          // Remove invalid data
          localStorage.removeItem(key);
        }
      }
    }
  });
};

export type SheetKind = 'mixed' | 'text' | 'draw';

export interface SheetAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  addedAt: string;
}

export interface NotebookData {
  id: string;
  name: string;
  sheets: SheetData[];
}

export interface SheetData {
  id: string;
  title: string;
  content: string;
  /** PNG data URL del lienzo (puede incluir transparencia) */
  drawing?: string;
  /** mixed: texto + dibujo; text: solo texto; draw: enfoque en dibujo */
  sheetKind?: SheetKind;
  tags?: string[];
  pinned?: boolean;
  attachments?: SheetAttachment[];
}

export interface TrashedSheetData extends SheetData {
  notebookId: string;
  deletedAt: string;
}

export interface TrashedNotebookData {
  id: string;
  name: string;
  sheets: SheetData[];
  deletedAt: string;
}

export interface AppDataSnapshotV1 {
  version: 1;
  exportedAt: string;
  notebooks: NotebookData[];
  trashedSheets: TrashedSheetData[];
  trashedNotebooks: TrashedNotebookData[];
}

export interface SheetUpdatePatch {
  title?: string;
  content?: string;
  drawing?: string;
  attachments?: SheetAttachment[];
  tags?: string[];
  pinned?: boolean;
  sheetKind?: SheetKind;
}

@Injectable({
  providedIn: 'root',
})
export class NotebookService {
  private notebooks: NotebookData[] = [];
  private trashedSheets: TrashedSheetData[] = [];
  private trashedNotebooks: TrashedNotebookData[] = [];
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly STORAGE_KEYS = {
    notebooks: 'nb_data',
    trashedSheets: 'nb_trashed_sheets',
    trashedNotebooks: 'nb_trashed_notebooks',
    settings: 'nb_settings',
    lastBackup: 'nb_last_backup'
  };

  constructor() {
    initializePlatformDetection(this.platformId);
    this.loadFromStorage();
    // Run cleanup periodically
    if (this.isBrowser) {
      setInterval(() => cleanupOldData(), 24 * 60 * 60 * 1000); // Daily
    }
  }

  private migrateLoadedData() {
    for (const nb of this.notebooks) {
      for (const s of nb.sheets) {
        s.sheetKind = s.sheetKind ?? 'mixed';
        s.tags = s.tags ?? [];
        s.attachments = s.attachments ?? [];
        s.pinned = s.pinned ?? false;
      }
    }
    for (const t of this.trashedSheets) {
      t.sheetKind = t.sheetKind ?? 'mixed';
      t.tags = t.tags ?? [];
      t.attachments = t.attachments ?? [];
      t.pinned = t.pinned ?? false;
    }
    for (const tn of this.trashedNotebooks) {
      for (const s of tn.sheets) {
        s.sheetKind = s.sheetKind ?? 'mixed';
        s.tags = s.tags ?? [];
        s.attachments = s.attachments ?? [];
        s.pinned = s.pinned ?? false;
      }
    }
  }

  private loadFromStorage() {
    if (!this.isBrowser) {
      return;
    }
    
    try {
      const notebooksData = localStorage.getItem(this.STORAGE_KEYS.notebooks);
      const trashedData = localStorage.getItem(this.STORAGE_KEYS.trashedSheets);
      const trashedNotebooksData = localStorage.getItem(this.STORAGE_KEYS.trashedNotebooks);

      if (notebooksData) {
        this.notebooks = JSON.parse(decompressData(notebooksData));
      }
      if (trashedData) {
        this.trashedSheets = JSON.parse(decompressData(trashedData));
      }
      if (trashedNotebooksData) {
        this.trashedNotebooks = JSON.parse(decompressData(trashedNotebooksData));
      }
      this.migrateLoadedData();
    } catch (error) {
      console.error('Error loading from storage:', error);
      // Clear corrupted data
      this.clearCorruptedData();
    }
  }

  private saveToStorage() {
    if (!this.isBrowser) {
      return;
    }

    // Debounce saves to improve performance
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      try {
        const quota = checkStorageQuota();
        
        // Warn if storage is getting full
        if (quota.percentage > 80) {
          console.warn(`Storage usage: ${quota.percentage.toFixed(1)}% (${(quota.used / 1024 / 1024).toFixed(1)}MB used)`);
        }
        
        // Check if we have enough space
        const dataToSave = {
          notebooks: JSON.stringify(this.notebooks),
          trashedSheets: JSON.stringify(this.trashedSheets),
          trashedNotebooks: JSON.stringify(this.trashedNotebooks)
        };
        
        const totalSize = Object.values(dataToSave).reduce((sum, data) => sum + data.length, 0);
        
        if (totalSize > quota.available) {
          throw new Error('Insufficient storage space');
        }
        
        // Save compressed data
        localStorage.setItem(this.STORAGE_KEYS.notebooks, compressData(dataToSave.notebooks));
        localStorage.setItem(this.STORAGE_KEYS.trashedSheets, compressData(dataToSave.trashedSheets));
        localStorage.setItem(this.STORAGE_KEYS.trashedNotebooks, compressData(dataToSave.trashedNotebooks));
        
        // Update last backup timestamp
        localStorage.setItem(this.STORAGE_KEYS.lastBackup, Date.now().toString());
        
      } catch (e) {
        console.error('Storage error:', e);
        if (e instanceof Error && e.message.includes('quota')) {
          this.handleStorageQuotaExceeded();
        } else {
          throw e;
        }
      }
    }, 500); // Debounce for 500ms
  }

  private clearCorruptedData() {
    if (!this.isBrowser) return;
    
    Object.values(this.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    this.notebooks = [];
    this.trashedSheets = [];
    this.trashedNotebooks = [];
  }

  private handleStorageQuotaExceeded() {
    // Auto-cleanup old data
    cleanupOldData();
    
    // Try to save again after cleanup
    setTimeout(() => {
      try {
        this.saveToStorage();
      } catch (e) {
        console.error('Still insufficient storage after cleanup');
        // Could show user notification here
      }
    }, 1000);
  }

  // Public methods for storage management
  getStorageInfo() {
    return checkStorageQuota();
  }

  forceCleanup() {
    cleanupOldData();
  }

  exportData(): string {
    return this.exportSnapshotJson();
  }

  importData(json: string) {
    this.importSnapshotReplace(json);
  }

  getNotebooks(): NotebookData[] {
    return this.notebooks;
  }

  getNotebook(id: string): NotebookData | undefined {
    return this.notebooks.find((nb) => nb.id === id);
  }

  createNotebook(name: string): NotebookData {
    const notebook: NotebookData = {
      id: Date.now().toString(),
      name,
      sheets: [],
    };
    this.notebooks.push(notebook);
    this.saveToStorage();
    return notebook;
  }

  updateNotebook(id: string, name: string) {
    const notebook = this.getNotebook(id);
    if (notebook) {
      notebook.name = name;
      this.saveToStorage();
    }
  }

  trashNotebook(id: string) {
    const idx = this.notebooks.findIndex((nb) => nb.id === id);
    if (idx === -1) {
      return;
    }
    const nb = this.notebooks[idx];
    this.notebooks.splice(idx, 1);
    this.trashedNotebooks.push({
      id: nb.id,
      name: nb.name,
      sheets: nb.sheets.map((s) => ({ ...s })),
      deletedAt: new Date().toISOString(),
    });
    this.saveToStorage();
  }

  getTrashedNotebooks(): TrashedNotebookData[] {
    return this.trashedNotebooks;
  }

  restoreNotebookFromTrash(trashedId: string) {
    const itemIndex = this.trashedNotebooks.findIndex((t) => t.id === trashedId);
    if (itemIndex === -1) {
      return;
    }
    const t = this.trashedNotebooks[itemIndex];
    this.trashedNotebooks.splice(itemIndex, 1);
    this.notebooks.push({
      id: t.id,
      name: t.name,
      sheets: t.sheets.map((s) => ({ ...s })),
    });
    this.saveToStorage();
  }

  deleteNotebookPermanentlyFromTrash(trashedId: string) {
    this.trashedNotebooks = this.trashedNotebooks.filter((t) => t.id !== trashedId);
    this.saveToStorage();
  }

  /** Copia una hoja (mismo contenido, dibujo, adjuntos y etiquetas; título con «(copia)»). */
  duplicateSheet(notebookId: string, sheetId: string): SheetData | null {
    const original = this.getSheet(notebookId, sheetId);
    const nb = this.getNotebook(notebookId);
    if (!original || !nb) {
      return null;
    }
    const newId = `${Date.now()}`;
    const attachments = (original.attachments || []).map((a, i) => ({
      ...a,
      id: `${newId}-att-${i}-${Math.random().toString(36).slice(2, 8)}`,
    }));
    const copy: SheetData = {
      id: newId,
      title: `${original.title} (copia)`,
      content: original.content,
      drawing: original.drawing,
      sheetKind: original.sheetKind ?? 'mixed',
      tags: [...(original.tags || [])],
      pinned: false,
      attachments,
    };
    nb.sheets.push(copy);
    this.saveToStorage();
    return copy;
  }

  createSheet(notebookId: string, title: string, opts?: { sheetKind?: SheetKind }): SheetData {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      const sheet: SheetData = {
        id: Date.now().toString(),
        title,
        content: '',
        sheetKind: opts?.sheetKind ?? 'mixed',
        tags: [],
        attachments: [],
        pinned: false,
      };
      notebook.sheets.push(sheet);
      this.saveToStorage();
      return sheet;
    }
    throw new Error('Notebook not found');
  }

  getSheet(notebookId: string, sheetId: string): SheetData | undefined {
    const notebook = this.getNotebook(notebookId);
    return notebook?.sheets.find((s) => s.id === sheetId);
  }

  updateSheet(notebookId: string, sheetId: string, patch: SheetUpdatePatch = {}) {
    const sheet = this.getSheet(notebookId, sheetId);
    if (sheet) {
      if (patch.title !== undefined) {
        sheet.title = patch.title;
      }
      if (patch.content !== undefined) {
        sheet.content = patch.content;
      }
      if (patch.drawing !== undefined) {
        if (patch.drawing === '') {
          delete sheet.drawing;
        } else {
          sheet.drawing = patch.drawing;
        }
      }
      if (patch.attachments !== undefined) {
        sheet.attachments = patch.attachments;
      }
      if (patch.tags !== undefined) {
        sheet.tags = patch.tags;
      }
      if (patch.pinned !== undefined) {
        sheet.pinned = patch.pinned;
      }
      if (patch.sheetKind !== undefined) {
        sheet.sheetKind = patch.sheetKind;
      }
      this.saveToStorage();
    }
  }

  deleteSheet(notebookId: string, sheetId: string) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      notebook.sheets = notebook.sheets.filter((s) => s.id !== sheetId);
      this.saveToStorage();
    }
  }

  trashSheet(notebookId: string, sheetId: string) {
    const notebook = this.getNotebook(notebookId);
    const sheet = notebook?.sheets.find((s) => s.id === sheetId);
    if (notebook && sheet) {
      notebook.sheets = notebook.sheets.filter((s) => s.id !== sheetId);
      const trashed: TrashedSheetData = {
        ...sheet,
        notebookId,
        deletedAt: new Date().toISOString(),
      };
      this.trashedSheets.push(trashed);
      this.saveToStorage();
    }
  }

  getTrashedSheets(): TrashedSheetData[] {
    return this.trashedSheets;
  }

  restoreSheetFromTrash(trashedId: string) {
    const itemIndex = this.trashedSheets.findIndex((t) => t.id === trashedId);
    if (itemIndex === -1) {
      return;
    }
    const trashed = this.trashedSheets[itemIndex];
    const notebook = this.getNotebook(trashed.notebookId);
    if (notebook) {
      notebook.sheets.push({
        id: trashed.id,
        title: trashed.title,
        content: trashed.content,
        drawing: trashed.drawing,
        sheetKind: trashed.sheetKind ?? 'mixed',
        tags: trashed.tags ?? [],
        pinned: trashed.pinned ?? false,
        attachments: trashed.attachments ?? [],
      });
    }
    this.trashedSheets.splice(itemIndex, 1);
    this.saveToStorage();
  }

  deletePermanentlyFromTrash(trashedId: string) {
    this.trashedSheets = this.trashedSheets.filter((t) => t.id !== trashedId);
    this.saveToStorage();
  }

  emptyTrashedSheets() {
    this.trashedSheets = [];
    this.saveToStorage();
  }

  emptyTrashedNotebooks() {
    this.trashedNotebooks = [];
    this.saveToStorage();
  }

  emptyAllTrash() {
    this.trashedSheets = [];
    this.trashedNotebooks = [];
    this.saveToStorage();
  }

  /** Copia de seguridad JSON (localStorage completo de la app). */
  exportSnapshotJson(): string {
    const snap: AppDataSnapshotV1 = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notebooks: JSON.parse(JSON.stringify(this.notebooks)),
      trashedSheets: JSON.parse(JSON.stringify(this.trashedSheets)),
      trashedNotebooks: JSON.parse(JSON.stringify(this.trashedNotebooks)),
    };
    return JSON.stringify(snap, null, 0);
  }

  /** Restaura desde exportSnapshotJson; sustituye todo el estado. */
  importSnapshotReplace(json: string) {
    const data = JSON.parse(json) as AppDataSnapshotV1;
    if (data.version !== 1 || !Array.isArray(data.notebooks)) {
      throw new Error('Formato de copia no válido');
    }
    this.notebooks = data.notebooks;
    this.trashedSheets = data.trashedSheets ?? [];
    this.trashedNotebooks = data.trashedNotebooks ?? [];
    this.migrateLoadedData();
    this.saveToStorage();
  }
}
