import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgIf } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NotebookService, NotebookData, SheetData, SheetKind, SheetAttachment } from '../services/notebook';
import { ChatbotComponent } from '../components/chatbot/chatbot.component';
import { ThemeService } from '../services/theme';
import { UserService } from '../services/user';
import { MarkdownPipe } from '../pipes/markdown.pipe';

const DRAW_PRESET_COLORS = [
  '#000000',
  '#1f2937',
  '#6b7280',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#ffffff',
  '#78716c',
  '#0f766e',
];

/** Máx. por archivo (localStorage tiene límite bajo; vídeos grandes pueden fallar al guardar). */
const MAX_ATTACHMENT_BYTES = 200 * 1024 * 1024;

export type InteractionMode = 'text' | 'draw' | 'view';

@Component({
  selector: 'app-notebook',
  imports: [FormsModule, CommonModule, ChatbotComponent, MarkdownPipe],
  templateUrl: './notebook.html',
  styleUrl: './notebook.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Notebook implements OnInit, OnDestroy {
  route = inject(ActivatedRoute);
  router = inject(Router);
  notebookService = inject(NotebookService);
  cdr = inject(ChangeDetectorRef);
  notebook = signal<NotebookData | null>(null);
  selectedSheet = signal<SheetData | null>(null);
  selectedSheetRegular: SheetData | null = null;
  safePreviewUrl = signal<SafeResourceUrl | null>(null);
  sanitizer = inject(DomSanitizer);
  lastSavedAt = signal<string | null>(null);

  // Propiedad computada para asegurar reactividad
  get hasSelectedSheet() {
    return !!this.selectedSheet() || !!this.selectedSheetRegular;
  }
  selectedSheetContent = signal<string>('');
  sheetSearch = signal('');
  contextMenuSheet = signal<SheetData | null>(null);
  contextMenuPos = signal<{ x: number; y: number } | null>(null);
  saveTimeout: ReturnType<typeof setTimeout> | null = null;
  drawSaveTimer: ReturnType<typeof setTimeout> | null = null;

  drawTool = signal<'pencil' | 'eraser'>('pencil');
  brushSize = signal(6);
  drawColor = signal('#000000');
  drawingPointerInside = signal(false);
  presetColors = DRAW_PRESET_COLORS;

  /** Texto: edición; Dibujar: lienzo encima del texto (tipo Paint); Ver: solo lectura. */
  interactionMode = signal<InteractionMode>('text');

  showCreateSheetModal = signal(false);
  showSheetOptionsModal = signal(false);
  showNotebookOptionsModal = signal(false);
  newSheetTitle = signal('');
  newSheetKind = signal<SheetKind>('mixed');
  sheetRenameDraft = signal('');
  notebookRenameDraft = signal('');

  shortcutKey = signal('');
  shortcutValue = signal('');
  keywordKey = signal('');
  keywordValue = signal('');
  editingKeyword = signal<string | null>(null);

  printMode = signal<'sheet' | 'notebook' | null>(null);
  tagDraft = signal('');
  /** Oculta la lista de hojas para ganar anchura. */
  sidebarCollapsed = signal(false);
  /** Oculta cabecera lateral y compacta; máximo espacio para la hoja. */
  focusMode = signal(false);
  showShortcutsModal = signal(false);
  keywordKeys = computed(() => Object.keys(this.userService.currentUser()?.keywords ?? {}));
  hasKeywords = computed(() => this.keywordKeys().length > 0);

  /** Modo de pantalla completa para dibujo */
  fullscreenDrawMode = signal(false);

  /** Track current rich text formatting state */
  boldActive = signal(false);
  italicActive = signal(false);
  underlineActive = signal(false);

  /** Track font settings */
  selectedFontFamily = signal('Arial, sans-serif');
  selectedFontSize = signal('12px');

  // Signal for attachments list visibility
  showAttachmentsList = signal(false);
  showAttachmentPreview = signal(false);
  attachmentPreview = signal<SheetAttachment | null>(null);

  @ViewChild('editor') editor!: ElementRef<HTMLElement>;
  @ViewChild('drawCanvas') drawCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('attachInput') attachInput?: ElementRef<HTMLInputElement>;

  private isDrawingStroke = false;
  private lastDrawX = 0;
  private lastDrawY = 0;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const ownerId = this.userService.currentUser()?.id;
    if (id) {
      const nb = this.notebookService.getNotebook(id, ownerId);
      this.notebook.set(nb || null);
      const routeSheetId =
        this.route.snapshot.paramMap.get('sheetId') ||
        this.route.snapshot.firstChild?.paramMap.get('sheetId');

      const notebook = this.notebook();
      if (notebook && notebook.sheets.length > 0) {
        let selectedSheet = routeSheetId
          ? notebook.sheets.find((s) => s.id === routeSheetId)
          : undefined;

        if (!selectedSheet) {
          selectedSheet = notebook.sheets[0];
        }

        if (selectedSheet) {
          this.selectSheet(selectedSheet, false);
          if (!routeSheetId || selectedSheet.id !== routeSheetId) {
            this.router.navigate([
              '/notebook',
              id,
              'sheet',
              selectedSheet.id,
            ], { replaceUrl: true });
          }
        }
      }
    }
  }

  ngOnDestroy() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    if (this.drawSaveTimer) {
      clearTimeout(this.drawSaveTimer);
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.selectedSheet() && this.sheetShowsCanvas()) {
      this.initDrawingCanvas();
    }
  }

  themeService = inject(ThemeService);
  userService = inject(UserService);

    toggleTheme() {
      this.themeService.toggleTheme();
    }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (
      this.drawingPointerInside() &&
      this.selectedSheet() &&
      this.interactionMode() === 'draw' &&
      this.sheetShowsCanvas() &&
      event.ctrlKey
    ) {
      const increase =
        event.key === '+' ||
        event.key === '=' ||
        event.code === 'NumpadAdd';
      const decrease =
        event.key === '-' ||
        event.code === 'Minus' ||
        event.code === 'NumpadSubtract';
      if (increase) {
        event.preventDefault();
        this.brushSize.update((s) => Math.min(80, s + 2));
        return;
      }
      if (decrease) {
        event.preventDefault();
        this.brushSize.update((s) => Math.max(1, s - 2));
        return;
      }
    }

    if (event.key === 'Escape') {
      if (this.showShortcutsModal()) {
        this.showShortcutsModal.set(false);
        return;
      }
      if (this.showCreateSheetModal()) {
        this.closeCreateSheetModal();
        return;
      }
      if (this.focusMode()) {
        this.focusMode.set(false);
        this.sidebarCollapsed.set(false);
        return;
      }
    }

    const el = event.target as HTMLElement | null;
    const tag = el?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA';
    const inEditor =
      !!el?.isContentEditable && el.classList.contains('sheet-editor');

    if (event.ctrlKey && event.key === '/' && !event.shiftKey) {
      event.preventDefault();
      this.showShortcutsModal.update((v) => !v);
      return;
    }

    if (event.altKey && !event.ctrlKey && !inInput) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.goAdjacentSheet(-1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.goAdjacentSheet(1);
        return;
      }
    }

    if (!inInput && !inEditor) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        this.sidebarCollapsed.update((c) => !c);
        return;
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        this.focusMode.update((c) => !c);
        return;
      }
    }
  }

  sheetKind(sheet: SheetData): SheetKind {
    return sheet.sheetKind ?? 'mixed';
  }

  sheetShowsCanvas(): boolean {
    // Siempre mostrar canvas en modo dibujo, independientemente del tipo de hoja
    return this.interactionMode() === 'draw';
  }

  filteredSheets(): SheetData[] {
    const nb = this.notebook();
    if (!nb) {
      return [];
    }
    const q = this.sheetSearch().trim().toLowerCase();
    let list = !q
      ? [...nb.sheets]
      : nb.sheets.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            (s.tags || []).some((t) => t.toLowerCase().includes(q)),
        );
    list.sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      if (pa !== pb) {
        return pb - pa;
      }
      return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    });
    return list;
  }

  plainTextLength(html: string): number {
    if (!html) {
      return 0;
    }
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').trim().length;
  }

  wordCount(): number {
    const d = document.createElement('div');
    d.innerHTML = this.selectedSheetContent() || '';
    const t = (d.textContent || '').trim();
    if (!t) {
      return 0;
    }
    return t.split(/\s+/).filter(Boolean).length;
  }

  navigableSheets(): SheetData[] {
    return this.filteredSheets();
  }

  currentSheetNavIndex(): number {
    const id = this.selectedSheet()?.id;
    if (!id) {
      return -1;
    }
    return this.navigableSheets().findIndex((s) => s.id === id);
  }

  sheetNavLabel(): string {
    const list = this.navigableSheets();
    const i = this.currentSheetNavIndex();
    if (i < 0 || list.length === 0) {
      return '';
    }
    return `${i + 1} / ${list.length}`;
  }

  goAdjacentSheet(delta: number) {
    const list = this.navigableSheets();
    const i = this.currentSheetNavIndex();
    if (i < 0 || list.length === 0) {
      return;
    }
    const ni = i + delta;
    if (ni >= 0 && ni < list.length) {
      this.selectSheet(list[ni]);
    }
  }

  toggleSidebarCollapsed() {
    this.sidebarCollapsed.update((c) => !c);
  }

  toggleFocusMode() {
    this.focusMode.update((c) => {
      const next = !c;
      if (next) {
        this.sidebarCollapsed.set(true);
      } else {
        this.sidebarCollapsed.set(false);
      }
      return next;
    });
  }

  toggleFullscreenDrawMode() {
    this.fullscreenDrawMode.update(c => !c);
    if (this.fullscreenDrawMode()) {
      // Enter fullscreen mode
      this.enterFullscreen();
    } else {
      // Exit fullscreen mode
      this.exitFullscreen();
    }
  }

  private enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }
  }

  private exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  }

  duplicateSheet(sheet: SheetData) {
    if (!this.notebook()) {
      return;
    }
    const copy = this.notebookService.duplicateSheet(this.notebook()!.id, sheet.id);
    if (copy) {
      this.notebook.set(this.notebookService.getNotebook(this.notebook()!.id) || null);
      this.selectSheet(copy);
    }
    this.closeContextMenu();
  }

  duplicateCurrentSheet() {
    const sh = this.selectedSheet();
    if (sh) {
      this.duplicateSheet(sh);
    }
  }

  clearDrawing() {
    if (!this.sheetShowsCanvas() || !this.selectedSheet() || !this.notebook()) {
      return;
    }
    if (!confirm('¿Borrar todo el dibujo de esta hoja? El texto no se modifica.')) {
      return;
    }
    const nb = this.notebook()!;
    const sh = this.selectedSheet()!;
    this.notebookService.updateSheet(nb.id, sh.id, { drawing: '' });
    this.notebook.set(this.notebookService.getNotebook(nb.id) || null);
    const upd = this.notebook()?.sheets.find((s) => s.id === sh.id);
    if (upd) {
      this.selectedSheet.set({ ...upd });
    }
    setTimeout(() => this.initDrawingCanvas(), 0);
  }

  printCurrentSheet() {
    this.preparePrint('sheet');
  }

  printNotebook() {
    this.preparePrint('notebook');
  }

  exportCurrentSheetToPdf() {
    this.preparePrint('sheet');
  }

  exportNotebookToPdf() {
    this.preparePrint('notebook');
  }

  private preparePrint(kind: 'sheet' | 'notebook') {
    if (kind === 'sheet' && !this.selectedSheet()) {
      return;
    }
    if (kind === 'notebook' && !this.notebook()) {
      return;
    }

    this.printMode.set(kind);
    this.cdr.detectChanges();
    setTimeout(() => {
      window.print();
      setTimeout(() => this.printMode.set(null), 0);
    }, 0);
  }

  private normalizeShortcutKey(key: string) {
    return key.trim().toLowerCase().replace(/[^a-z0-9_-]/gi, '');
  }

  currentShortcuts(): Record<string, string> {
    const notebookShortcuts = this.notebook()?.shortcuts ?? {};
    const profileShortcuts = this.userService.currentUser()?.keywords ?? {};
    return {
      ...profileShortcuts,
      ...notebookShortcuts,
    };
  }

  shortcutKeys(): string[] {
    return Object.keys(this.currentShortcuts());
  }

  hasShortcuts(): boolean {
    return this.shortcutKeys().length > 0;
  }

  addShortcut() {
    const key = this.normalizeShortcutKey(this.shortcutKey());
    const value = this.shortcutValue().trim();
    const notebook = this.notebook();
    if (!notebook || !key || !value) {
      return;
    }
    const shortcuts = { ...this.currentShortcuts(), [key]: value };
    notebook.shortcuts = shortcuts;
    this.notebookService.updateNotebookShortcuts(notebook.id, shortcuts);
    this.notebook.set(this.notebookService.getNotebook(notebook.id) || null);
    this.shortcutKey.set('');
    this.shortcutValue.set('');
  }

  removeShortcut(key: string) {
    const notebook = this.notebook();
    if (!notebook) {
      return;
    }
    const shortcuts = { ...this.currentShortcuts() };
    delete shortcuts[key];
    notebook.shortcuts = shortcuts;
    this.notebookService.updateNotebookShortcuts(notebook.id, shortcuts);
    this.notebook.set(this.notebookService.getNotebook(notebook.id) || null);
  }

  startKeywordEdit(key: string) {
    const current = this.userService.currentUser();
    if (!current?.keywords) {
      return;
    }
    this.editingKeyword.set(key);
    this.keywordKey.set(key);
    this.keywordValue.set(current.keywords[key] ?? '');
  }

  cancelKeywordEdit() {
    this.editingKeyword.set(null);
    this.keywordKey.set('');
    this.keywordValue.set('');
  }

  saveKeyword() {
    const key = this.keywordKey().trim().toLowerCase();
    const value = this.keywordValue().trim();
    if (!key || !value) {
      return;
    }

    const currentKey = this.editingKeyword();
    if (currentKey && currentKey !== key) {
      this.userService.removeKeyword(currentKey);
    }

    this.userService.addKeyword(key, value);
    this.cancelKeywordEdit();
  }

  removeKeyword(key: string) {
    this.userService.removeKeyword(key);
    if (this.editingKeyword() === key) {
      this.cancelKeywordEdit();
    }
  }

  renderWithShortcuts(content: string): string {
    if (!content) {
      return '';
    }
    const shortcuts = this.currentShortcuts();
    if (!shortcuts || Object.keys(shortcuts).length === 0) {
      return content;
    }
    return content.replace(/\{([^}]+)\}/g, (match, key) => {
      const normalized = this.normalizeShortcutKey(key);
      return shortcuts[normalized] ?? match;
    });
  }

  renderedSheetContent(): string {
    return this.renderWithShortcuts(this.selectedSheetContent() || this.selectedSheet()?.content || '');
  }

  renderedSheetContentForSheet(sheet: SheetData): string {
    return this.renderWithShortcuts(sheet.content || '');
  }

  navigateToAccount() {
    this.router.navigate(['/account']);
  }

  applyRichFormat(command: 'bold' | 'italic' | 'underline') {
    document.execCommand(command, false);
    this.updateFormattingState();
  }

  private hasTextSelection() {
    const selection = window.getSelection();
    return !!selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed;
  }

  private setStyleWithCSS() {
    document.execCommand('styleWithCSS', false, 'true');
  }

  applyFontFamily(fontFamily: string) {
    if (!fontFamily) return;
    this.selectedFontFamily.set(fontFamily);
    if (this.hasTextSelection()) {
      this.setStyleWithCSS();
      document.execCommand('fontName', false, fontFamily);
    } else if (this.editor?.nativeElement) {
      this.editor.nativeElement.style.fontFamily = fontFamily;
    }
    this.updateFormattingState();
  }

  applyFontSize(fontSize: string) {
    if (!fontSize) return;
    this.selectedFontSize.set(fontSize);
    if (this.hasTextSelection()) {
      this.setStyleWithCSS();
      document.execCommand('fontSize', false, '7');
      const fontElements = document.getElementsByTagName('font');
      for (let i = 0; i < fontElements.length; i++) {
        if (fontElements[i].size === '7') {
          fontElements[i].removeAttribute('size');
          fontElements[i].style.fontSize = fontSize;
        }
      }
    } else if (this.editor?.nativeElement) {
      this.editor.nativeElement.style.fontSize = fontSize;
    }
    this.updateFormattingState();
  }

  applyTextColor(color: string) {
    this.setStyleWithCSS();
    document.execCommand('foreColor', false, color);
    this.updateFormattingState();
  }

  applyBackgroundColor(color: string) {
    document.execCommand('hiliteColor', false, color);
    this.updateFormattingState();
  }

  applyAlignment(alignment: 'left' | 'center' | 'right' | 'justify') {
    document.execCommand(alignment, false);
    this.updateFormattingState();
  }

  applyList(type: 'ordered' | 'unordered') {
    const command = type === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(command, false);
    this.updateFormattingState();
  }

  clearFormatting() {
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    this.saveSelectedSheet();
    this.updateFormattingState();
  }

  private ensureCurrentFormatting() {
    if (!this.editor?.nativeElement) return;

    // Simplemente asegurar que el editor mantenga la fuente y tamaño seleccionados
    this.editor.nativeElement.style.fontFamily = this.selectedFontFamily();
    this.editor.nativeElement.style.fontSize = this.selectedFontSize();
  }

  setInteractionMode(mode: InteractionMode) {
    this.interactionMode.set(mode);

    // Inicializar canvas si cambiamos a modo dibujo
    if (mode === 'draw') {
      // Múltiples intentos para asegurar que el canvas esté listo
      setTimeout(() => this.initDrawingCanvas(), 100);
      setTimeout(() => this.initDrawingCanvas(), 300);
      setTimeout(() => this.initDrawingCanvas(), 500);
    }

    // Cargar contenido si cambiamos a modo texto
    if (mode === 'text' && this.selectedSheet()) {
      // Asegurarse de que el contenido esté cargado en el editor
      setTimeout(() => {
        if (this.editor?.nativeElement && this.selectedSheetContent()) {
          this.editor.nativeElement.innerHTML = this.selectedSheetContent();
          this.ensureCurrentFormatting();
        }
      }, 10);
    }

    // Multiple attempts to focus the editor in text mode
    const focusEditor = () => {
      if (mode === 'text' && this.editor?.nativeElement) {
        this.editor.nativeElement.focus();
      }
    };

    queueMicrotask(focusEditor);
    setTimeout(focusEditor, 10);
    setTimeout(focusEditor, 50);
  }

  openCreateSheetModal() {
    this.newSheetTitle.set('');
    this.newSheetKind.set('mixed');
    this.showCreateSheetModal.set(true);
  }

  closeCreateSheetModal() {
    this.showCreateSheetModal.set(false);
  }

  openSheetOptionsModal() {
    this.sheetRenameDraft.set(this.selectedSheet()?.title || '');
    this.showSheetOptionsModal.set(true);
  }

  closeSheetOptionsModal() {
    this.showSheetOptionsModal.set(false);
  }

  openNotebookOptionsModal() {
    this.notebookRenameDraft.set(this.notebook()?.name || '');
    this.showNotebookOptionsModal.set(true);
  }

  closeNotebookOptionsModal() {
    this.showNotebookOptionsModal.set(false);
  }

  saveSheetTitle() {
    const newTitle = this.sheetRenameDraft().trim();
    const sheet = this.selectedSheet();
    const notebook = this.notebook();
    if (!newTitle || !sheet || !notebook) {
      return;
    }
    this.notebookService.updateSheet(notebook.id, sheet.id, { title: newTitle });
    this.notebook.set(this.notebookService.getNotebook(notebook.id) || null);
    const updated = this.notebook()?.sheets.find((s) => s.id === sheet.id);
    if (updated) {
      this.selectedSheet.set({ ...updated });
      this.selectedSheetRegular = { ...updated };
    }
    this.closeSheetOptionsModal();
  }

  saveNotebookTitle() {
    const newTitle = this.notebookRenameDraft().trim();
    const notebook = this.notebook();
    if (!newTitle || !notebook) {
      return;
    }
    this.notebookService.updateNotebook(notebook.id, newTitle);
    this.notebook.set(this.notebookService.getNotebook(notebook.id) || null);
    this.closeNotebookOptionsModal();
  }

  confirmCreateSheet() {
    const title = this.newSheetTitle().trim();
    if (!title || !this.notebook()) {
      return;
    }
    const kind = this.newSheetKind();
    const sheet = this.notebookService.createSheet(this.notebook()!.id, title, {
      sheetKind: kind,
    });
    this.notebook.set(this.notebookService.getNotebook(this.notebook()!.id) || null);
    this.closeCreateSheetModal();
    this.selectSheet(sheet);
    if (kind === 'draw') {
      this.setInteractionMode('draw');
    } else {
      this.setInteractionMode('text');
    }
  }

  createSheet() {
    this.openCreateSheetModal();
  }

  editSheet(sheet: SheetData) {
    const newTitle = prompt('Nuevo título:', sheet.title);
    if (newTitle && this.notebook()) {
      this.notebookService.updateSheet(this.notebook()!.id, sheet.id, {
        title: newTitle,
      });
      this.notebook.set(this.notebookService.getNotebook(this.notebook()!.id) || null);
      if (this.selectedSheet()?.id === sheet.id) {
        this.selectedSheet.set({ ...this.selectedSheet()!, title: newTitle });
      }
    }
    this.closeContextMenu();
  }

  togglePinSheet(sheet: SheetData) {
    if (!this.notebook()) {
      return;
    }
    const next = !sheet.pinned;
    this.notebookService.updateSheet(this.notebook()!.id, sheet.id, { pinned: next });
    this.notebook.set(this.notebookService.getNotebook(this.notebook()!.id) || null);
    if (this.selectedSheet()?.id === sheet.id) {
      this.selectedSheet.set({ ...this.selectedSheet()!, pinned: next });
    }
    this.closeContextMenu();
  }

  deleteSheet(sheet: SheetData) {
    if (!this.notebook()) {
      return;
    }
    this.notebookService.trashSheet(this.notebook()!.id, sheet.id);
    this.notebook.set(this.notebookService.getNotebook(this.notebook()!.id) || null);
    if (this.selectedSheet()?.id === sheet.id) {
      this.selectedSheet.set(null);
      this.selectedSheetContent.set('');
    }
    this.closeContextMenu();
  }

  selectSheet(sheet: SheetData, updateUrl = false) {
    const kind = this.sheetKind(sheet);
    this.setInteractionMode(kind === 'draw' ? 'draw' : 'text');

    this.selectedSheetRegular = sheet;
    this.selectedSheet.set(sheet);
    this.selectedSheetContent.set(sheet.content || '');
    this.closeContextMenu();

    if (updateUrl && this.notebook()) {
      this.router.navigate([
        '/notebook',
        this.notebook()!.id,
        'sheet',
        sheet.id,
      ]);
    }

    this.cdr.detectChanges();

    setTimeout(() => {
      this.cdr.detectChanges();
      if (this.editor?.nativeElement) {
        const inner = sheet.content?.trim()
          ? sheet.content
          : '<p class="sheet-empty-line"><br></p>';
        this.editor.nativeElement.innerHTML = inner;
        this.editor.nativeElement.style.fontFamily = this.selectedFontFamily();
        this.editor.nativeElement.style.fontSize = this.selectedFontSize();

        if (this.interactionMode() === 'text') {
          const focusEditor = () => {
            if (this.editor?.nativeElement) {
              this.editor.nativeElement.focus();
            }
          };

          focusEditor();
          setTimeout(focusEditor, 10);
          setTimeout(focusEditor, 100);
        }

        this.updateFormattingState();
      }
      if (this.sheetShowsCanvas()) {
        this.initDrawingCanvas();
      }
    });
  }

  saveSelectedSheet() {
    if (!this.selectedSheet() || !this.notebook()) {
      return;
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveSelectedSheetImmediate();
    }, 1000);
  }

  saveSelectedSheetImmediate() {
    if (!this.selectedSheet() || !this.notebook()) {
      return;
    }
    const notebookId = this.notebook()!.id;
    this.notebookService.updateSheet(notebookId, this.selectedSheet()!.id, {
      content: this.selectedSheetContent(),
    });
    this.notebook.set(this.notebookService.getNotebook(notebookId) || null);
    const upd = this.notebook()?.sheets.find((s) => s.id === this.selectedSheet()!.id);
    if (upd) {
      this.selectedSheet.set({ ...upd });
    }
    this.lastSavedAt.set(new Date().toLocaleTimeString());
  }

  onSheetClick(sheet: SheetData) {
    this.selectSheet(sheet, true);
  }

  clearCurrentSheet() {
    if (!this.selectedSheet() || !this.notebook()) {
      return;
    }
    if (!confirm('¿Borrar todo el contenido de esta hoja? Esta acción no se puede deshacer.')) {
      return;
    }
    const nb = this.notebook()!;
    const sh = this.selectedSheet()!;
    this.notebookService.updateSheet(nb.id, sh.id, { content: '' });
    this.notebook.set(this.notebookService.getNotebook(nb.id) || null);
    const upd = this.notebook()?.sheets.find((s) => s.id === sh.id);
    if (upd) {
      this.selectedSheet.set({ ...upd });
      this.selectedSheetContent.set('');
      if (this.editor?.nativeElement) {
        this.editor.nativeElement.innerHTML = '<p class="sheet-empty-line"><br></p>';
      }
    }
  }

  exportCurrentSheetAsMarkdown() {
    const sheet = this.selectedSheet();
    if (!sheet) {
      return;
    }
    const raw = sheet.content || '';
    const text = this.stripHtml(raw);
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheet.title.replace(/[^\w\s-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  insertDateTime() {
    if (!this.editor?.nativeElement || this.interactionMode() !== 'text') {
      return;
    }
    const text = new Date().toLocaleString();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.editor.nativeElement.focus();
      return;
    }
    const range = selection.getRangeAt(0);
    if (!this.editor.nativeElement.contains(range.startContainer)) {
      this.editor.nativeElement.focus();
      return;
    }
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    this.onEditorInput(new Event('input'));
  }

  private stripHtml(html: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }

  onSheetContextMenu(sheet: SheetData, event: MouseEvent) {
    event.preventDefault();
    this.contextMenuSheet.set(sheet);
    this.contextMenuPos.set({ x: event.clientX, y: event.clientY });
  }

  closeContextMenu() {
    this.contextMenuSheet.set(null);
    this.contextMenuPos.set(null);
  }

  goBackToNotebooks() {
    this.router.navigate(['/']);
  }

  onEditorInput(event: Event) {
    if (this.interactionMode() !== 'text') {
      return;
    }
    const editor = event.target as HTMLElement;
    this.selectedSheetContent.set(editor.innerHTML);

    // Mantener fuente y tamaño al escribir
    this.ensureCurrentFormatting();

    // Guardado inmediato sin retraso
    this.saveSelectedSheetImmediate();
    this.updateFormattingState();
  }

  onEditorSelectionChange() {
    if (this.interactionMode() === 'text') {
      this.updateFormattingState();
    }
  }

  onEditorDelegatedChange(event: Event) {
    const t = event.target;
    if (
      t instanceof HTMLInputElement &&
      t.type === 'checkbox' &&
      t.classList.contains('markdown-checkbox') &&
      this.editor?.nativeElement
    ) {
      this.selectedSheetContent.set(this.editor.nativeElement.innerHTML);
      this.saveSelectedSheet();
    }
  }

  onEditorKeyDown(event: KeyboardEvent) {
    if (this.interactionMode() !== 'text') {
      return;
    }
    const editor = event.target as HTMLElement;

    if (event.ctrlKey || event.metaKey) {
      const k = event.key.toLowerCase();
      if (k === 'b' || k === 'i' || k === 'u') {
        event.preventDefault();
        const cmd = k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline';
        document.execCommand(cmd, false);
        this.selectedSheetContent.set(editor.innerHTML);
        this.saveSelectedSheet();
        return;
      }
    }

    if (event.key !== ' ') {
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const block = this.findBlockAncestor(range.startContainer, editor) || editor;

    const pre = document.createRange();
    pre.selectNodeContents(block);
    pre.setEnd(range.endContainer, range.endOffset);
    const fullBefore = pre.toString();
    const lineStart = fullBefore.lastIndexOf('\n') + 1;
    const lineText = fullBefore.slice(lineStart);

    let listType: 'bullet' | 'ordered' | 'checkbox' | null = null;
    if (/^\s*\*$/.test(lineText)) {
      listType = 'bullet';
    } else if (/^\s*\d+\.$/.test(lineText)) {
      listType = 'ordered';
    } else if (/^\s*\[\]$/.test(lineText)) {
      listType = 'checkbox';
    }
    if (!listType) {
      return;
    }
    event.preventDefault();
    this.convertLineToList(editor, selection, range, block, lineText.length, listType);
  }

  setDrawTool(tool: 'pencil' | 'eraser') {
    this.drawTool.set(tool);
  }

  increaseBrushSize() {
    this.brushSize.update(s => Math.min(80, s + 2));
  }

  decreaseBrushSize() {
    this.brushSize.update(s => Math.max(1, s - 2));
  }

  pickPresetColor(hex: string) {
    this.drawColor.set(hex);
  }

  triggerAttachmentPicker() {
    this.attachInput?.nativeElement?.click();
  }

  onAttachmentFilesSelected(event: Event) {
    void this.ingestAttachments(event);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('read'));
      reader.readAsDataURL(file);
    });
  }

  private async ingestAttachments(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length || !this.selectedSheet() || !this.notebook()) {
      input.value = '';
      return;
    }
    const nb = this.notebook()!;
    const sh = this.selectedSheet()!;
    const list = [...(sh.attachments || [])];
    const limitMb = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        alert(
          `"${file.name}" supera el límite de ${limitMb} MB. Comprime el archivo o usa un enlace externo.`,
        );
        continue;
      }
      try {
        const dataUrl = await this.readFileAsDataUrl(file);
        list.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataUrl,
          size: file.size,
          addedAt: new Date().toISOString(),
        });
      } catch {
        alert(`No se pudo leer "${file.name}".`);
      }
    }

    this.notebookService.updateSheet(nb.id, sh.id, { attachments: list });
    this.notebook.set(this.notebookService.getNotebook(nb.id) || null);
    const upd = this.notebook()?.sheets.find((s) => s.id === sh.id);
    if (upd) {
      this.selectedSheet.set({ ...upd });
    }
    input.value = '';
  }

  removeAttachment(att: SheetAttachment) {
    if (!confirm(`¿Estás seguro de que deseas eliminar el archivo "${att.name}"?`)) {
      return;
    }
    const nb = this.notebook();
    const sh = this.selectedSheet();
    if (!nb || !sh) {
      return;
    }
    const next = (sh.attachments || []).filter((a) => a.id !== att.id);
    this.notebookService.updateSheet(nb.id, sh.id, { attachments: next });
    this.notebook.set(this.notebookService.getNotebook(nb.id) || null);
    const upd = this.notebook()?.sheets.find((s) => s.id === sh.id);
    if (upd) {
      this.selectedSheet.set({ ...upd });
    }
    if (this.attachmentPreview() && this.attachmentPreview()!.id === att.id) {
      this.closeAttachmentPreview();
    }
  }

  deleteAttachmentFromPreview() {
    const att = this.attachmentPreview();
    if (!att) {
      return;
    }
    if (!confirm(`¿Eliminar el archivo "${att.name}" desde la vista previa?`)) {
      return;
    }
    this.removeAttachment(att);
  }

  downloadAttachment(att: SheetAttachment) {
    const a = document.createElement('a');
    a.href
      = att.dataUrl;
    a.download = att.name;
    a.click();
  }

  toggleAttachmentsList() {
    this.showAttachmentsList.set(!this.showAttachmentsList());
  }

  copySheetContent() {
    const text = this.selectedSheetContent();
    if (!text) {
      alert('No hay contenido para copiar.');
      return;
    }
    void navigator.clipboard.writeText(text);
    alert('Contenido copiado al portapapeles.');
  }

  downloadCurrentSheet() {
    const sheet = this.selectedSheet();
    if (!sheet) {
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${sheet.title}</title></head><body>${sheet.content || ''}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheet.title.replace(/[^\\w\s-]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  openAttachmentPreview(att: SheetAttachment) {
    this.attachmentPreview.set(att);
    this.safePreviewUrl.set(this.isPdfAttachment(att) ? this.sanitizer.bypassSecurityTrustResourceUrl(att.dataUrl) : null);
    this.showAttachmentPreview.set(true);
  }

  closeAttachmentPreview() {
    this.showAttachmentPreview.set(false);
    this.attachmentPreview.set(null);
    this.safePreviewUrl.set(null);
  }

  private getAttachmentExtension(att: SheetAttachment | null) {
    if (!att) {
      return '';
    }
    const parts = att.name.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop()! : '';
  }

  isPdfAttachment(att: SheetAttachment | null) {
    const ext = this.getAttachmentExtension(att);
    return !!att && (att.mimeType === 'application/pdf' || ext === 'pdf');
  }

  isWordAttachment(att: SheetAttachment | null) {
    const ext = this.getAttachmentExtension(att);
    return !!att && (
      att.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      att.mimeType === 'application/msword' ||
      ext === 'docx' ||
      ext === 'doc'
    );
  }

  isImageAttachment(att: SheetAttachment | null) {
    const ext = this.getAttachmentExtension(att);
    return !!att && (
      att.mimeType.startsWith('image/') ||
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)
    );
  }

  isVideoAttachment(att: SheetAttachment | null) {
    const ext = this.getAttachmentExtension(att);
    return !!att && (
      att.mimeType.startsWith('video/') ||
      ['mp4', 'webm', 'ogg', 'mov', 'avi', 'm4v'].includes(ext)
    );
  }

  isPreviewableAttachment(att: SheetAttachment | null) {
    return !!att && (this.isImageAttachment(att) || this.isVideoAttachment(att) || this.isPdfAttachment(att));
  }

  get attachmentActionLabel() {
    return this.showAttachmentsList() ? 'Ocultar archivos' : 'Mostrar archivos';
  }

  addTagFromDraft() {
    const raw = this.tagDraft().trim();
    if (!raw || !this.selectedSheet() || !this.notebook()) {
      return;
    }
    const sh = this.selectedSheet()!;
    const tags = [...(sh.tags || [])];
    if (tags.includes(raw)) {
      this.tagDraft.set('');
      return;
    }
    tags.push(raw);
    this.notebookService.updateSheet(this.notebook()!.id, sh.id, { tags });
    this.notebook.set(this.notebookService.getNotebook(this.notebook()!.id) || null);
    const upd = this.notebook()?.sheets.find((s) => s.id === sh.id);
    if (upd) {
      this.selectedSheet.set({ ...upd });
    }
    this.tagDraft.set('');
  }

  removeTag(tag: string) {
    const nb = this.notebook();
    const sh = this.selectedSheet();
    if (!nb || !sh) {
      return;
    }
    const tags = (sh.tags || []).filter((t) => t !== tag);
    this.notebookService.updateSheet(nb.id, sh.id, { tags });
    this.notebook.set(this.notebookService.getNotebook(nb.id) || null);
    const upd = this.notebook()?.sheets.find((s) => s.id === sh.id);
    if (upd) {
      this.selectedSheet.set({ ...upd });
    }
  }

  isImageMime(m: string): boolean {
    return m.startsWith('image/');
  }

  isVideoMime(m: string): boolean {
    return m.startsWith('video/');
  }

  exportCurrentSheetHtml() {
    const sh = this.selectedSheet();
    if (!sh) {
      return;
    }
    const blob = new Blob(
      [
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.escapeHtml(sh.title)}</title></head><body><h1>${this.escapeHtml(sh.title)}</h1>${sh.content || ''}</body></html>`,
      ],
      { type: 'text/html;charset=utf-8' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sh.title.replace(/[^\w\-]+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  initDrawingCanvas() {
    const canvas = this.drawCanvas?.nativeElement;
    if (!canvas || !this.selectedSheet()) {
      return;
    }

    // Esperar a que el canvas tenga dimensiones
    const checkAndInit = () => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW < 2 || cssH < 2) {
        requestAnimationFrame(checkAndInit);
        return;
      }

      // Configurar el canvas con mejor calidad
      const dpr = window.devicePixelRatio || 1;
      const scale = Math.max(dpr, 2); // Forzar al menos 2x para mejor calidad
      canvas.width = Math.max(1, Math.floor(cssW * scale));
      canvas.height = Math.max(1, Math.floor(cssH * scale));

      const ctx = canvas.getContext('2d', {
        alpha: true,
        willReadFrequently: false,
        desynchronized: true // Mejor rendimiento para dibujo
      });
      if (!ctx) {
        console.error('No se pudo obtener el contexto 2D del canvas');
        return;
      }

      // Configurar suavizado y calidad
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Escalar para pantallas de alta densidad
      ctx.scale(scale, scale);

      // Limpiar el canvas con fondo blanco/transparente
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      // Agregar fondo blanco para mejor visibilidad
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cssW, cssH);

      // Cargar dibujo existente si hay
      const dataUrl = this.selectedSheet()!.drawing;
      if (dataUrl && dataUrl.startsWith('data:image/png')) {
        const img = new Image();
        img.onload = () => {
          const ctx2 = canvas.getContext('2d', {
            alpha: true,
            willReadFrequently: false,
            desynchronized: true
          });
          if (ctx2) {
            ctx2.imageSmoothingEnabled = true;
            ctx2.imageSmoothingQuality = 'high';
            ctx2.setTransform(scale, 0, 0, scale, 0, 0);
            // Limpiar y poner fondo blanco
            ctx2.clearRect(0, 0, cssW, cssH);
            ctx2.fillStyle = '#ffffff';
            ctx2.fillRect(0, 0, cssW, cssH);
            // Dibujar la imagen existente con alta calidad
            ctx2.drawImage(img, 0, 0, cssW, cssH);
          }
        };
        img.onerror = () => {
          console.warn('No se pudo cargar el dibujo existente');
        };
        img.src = dataUrl;
      }

      console.log('Canvas inicializado con alta calidad:', { width: cssW, height: cssH, scale, dpr });

      // Forzar repintado
      canvas.style.display = 'block';
      canvas.style.visibility = 'visible';
      canvas.style.backgroundColor = '#ffffff';
      canvas.style.imageRendering = 'crisp-edges'; // Mejor para líneas
    };

    checkAndInit();
  }

  private canvasCssCoords(event: PointerEvent): { x: number; y: number } {
    const canvas = this.drawCanvas?.nativeElement;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const r = canvas.getBoundingClientRect();
    return {
      x: event.clientX - r.left,
      y: event.clientY - r.top,
    };
  }

  onDrawPointerDown(event: PointerEvent) {
    if (
      !this.selectedSheet() ||
      !this.drawCanvas?.nativeElement ||
      this.interactionMode() !== 'draw'
    ) {
      return;
    }

    event.preventDefault();
    const canvas = this.drawCanvas!.nativeElement;

    // Capturar el puntero para eventos fuera del canvas
    canvas.setPointerCapture(event.pointerId);

    const { x, y } = this.canvasCssCoords(event);
    this.isDrawingStroke = true;
    this.lastDrawX = x;
    this.lastDrawY = y;

    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false,
      desynchronized: true
    });
    if (!ctx) {
      console.error('No se pudo obtener el contexto del canvas');
      return;
    }

    const scale = Math.max(window.devicePixelRatio || 1, 2);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Configurar calidad de línea
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (this.drawTool() === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.arc(x, y, this.brushSize() / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = this.drawColor();
      ctx.beginPath();
      ctx.arc(x, y, this.brushSize() / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  onDrawPointerMove(event: PointerEvent) {
    if (!this.isDrawingStroke || !this.drawCanvas?.nativeElement) {
      return;
    }

    event.preventDefault();
    const { x, y } = this.canvasCssCoords(event);
    const canvas = this.drawCanvas.nativeElement;

    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false,
      desynchronized: true
    });
    if (!ctx) {
      console.error('No se pudo obtener el contexto del canvas');
      return;
    }

    const scale = Math.max(window.devicePixelRatio || 1, 2);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Configurar alta calidad para líneas
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (this.drawTool() === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = this.brushSize();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.lastDrawX, this.lastDrawY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.drawColor();
      ctx.lineWidth = this.brushSize();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.lastDrawX, this.lastDrawY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    }

    this.lastDrawX = x;
    this.lastDrawY = y;
  }

  onDrawPointerUp(event: PointerEvent) {
    const c = this.drawCanvas?.nativeElement;
    if (!c) {
      return;
    }
    if (c.hasPointerCapture(event.pointerId)) {
      c.releasePointerCapture(event.pointerId);
    }
    this.isDrawingStroke = false;
    // Guardado inmediato al terminar de dibujar
    this.saveDrawingImmediate();
  }

  private findBlockAncestor(node: Node, root: HTMLElement): HTMLElement | null {
    let n: Node | null = node;
    while (n && n !== root) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as HTMLElement;
        const tag = el.tagName;
        if (
          tag === 'P' ||
          tag === 'DIV' ||
          tag === 'LI' ||
          /^H[1-6]$/.test(tag) ||
          tag === 'BLOCKQUOTE'
        ) {
          return el;
        }
      }
      n = n.parentNode;
    }
    return null;
  }

  private updateFormattingState() {
    if (!this.editor?.nativeElement) return;

    // Use a small delay to ensure the DOM is updated
    setTimeout(() => {
      this.boldActive.set(document.queryCommandState('bold'));
      this.italicActive.set(document.queryCommandState('italic'));
      this.underlineActive.set(document.queryCommandState('underline'));
    }, 10);
  }

  private caretTextOffsetIn(block: Node, range: Range): number {
    const pre = document.createRange();
    pre.selectNodeContents(block);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  }

  private rangeFromOffsetsInBlock(
    block: Node,
    start: number,
    end: number,
  ): Range | null {
    if (start > end || start < 0) {
      return null;
    }
    const r = document.createRange();
    let pos = 0;
    const tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let started = false;
    let node: Node | null;
    while ((node = tw.nextNode())) {
      const len = (node.textContent || '').length;
      const nodeEnd = pos + len;
      if (!started && nodeEnd > start) {
        r.setStart(node, Math.max(0, start - pos));
        started = true;
      }
      if (started && nodeEnd >= end) {
        r.setEnd(node, Math.min(len, end - pos));
        return r;
      }
      pos = nodeEnd;
    }
    return started ? r : null;
  }

  private convertLineToList(
    editor: HTMLElement,
    selection: Selection,
    range: Range,
    block: Node,
    lineLength: number,
    type: 'bullet' | 'ordered' | 'checkbox',
  ) {
    const caretOffset = this.caretTextOffsetIn(block, range);
    const deleteStart = caretOffset - lineLength;
    const delRange = this.rangeFromOffsetsInBlock(block, deleteStart, caretOffset);
    if (!delRange) {
      return;
    }
    delRange.deleteContents();
    delRange.collapse(true);

    let el: HTMLElement;
    if (type === 'bullet') {
      const ul = document.createElement('ul');
      ul.className = 'sheet-ul';
      const li = document.createElement('li');
      li.className = 'sheet-li';
      li.innerHTML = '<br>';
      ul.appendChild(li);
      el = ul;
    } else if (type === 'ordered') {
      const ol = document.createElement('ol');
      ol.className = 'sheet-ol';
      const li = document.createElement('li');
      li.className = 'sheet-li';
      li.innerHTML = '<br>';
      ol.appendChild(li);
      el = ol;
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'sheet-check-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'markdown-checkbox';
      const span = document.createElement('span');
      span.appendChild(document.createTextNode('\u00a0'));
      wrap.appendChild(cb);
      wrap.appendChild(span);
      el = wrap;
    }

    delRange.insertNode(el);

    if (type === 'bullet' || type === 'ordered') {
      const li = el.querySelector('li');
      if (li) {
        const nr = document.createRange();
        nr.selectNodeContents(li);
        nr.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nr);
      }
    } else {
      const span = el.querySelector('span');
      if (span) {
        const nr = document.createRange();
        nr.selectNodeContents(span);
        nr.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nr);
      }
    }

    this.selectedSheetContent.set(editor.innerHTML);
    this.saveSelectedSheet();
  }

  private scheduleSaveDrawing() {
    const nb = this.notebook();
    const sh = this.selectedSheet();
    if (!nb || !sh || !this.drawCanvas?.nativeElement) {
      return;
    }
    if (this.drawSaveTimer) {
      clearTimeout(this.drawSaveTimer);
    }
    // Guardado inmediato del dibujo
    this.saveDrawingImmediate();
  }

  private saveDrawingImmediate() {
    const nb = this.notebook();
    const sh = this.selectedSheet();
    if (!nb || !sh || !this.drawCanvas?.nativeElement) {
      return;
    }
    const dataUrl = this.drawCanvas!.nativeElement.toDataURL('image/png');
    this.notebookService.updateSheet(nb.id, sh.id, { drawing: dataUrl });
    this.notebook.set(this.notebookService.getNotebook(nb.id) || null);
    const updated = this.notebook()?.sheets.find((s) => s.id === sh.id);
    if (updated) {
      this.selectedSheet.set({ ...updated });
    }
  }
}
