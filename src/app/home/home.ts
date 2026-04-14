import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  NotebookService,
  NotebookData,
  TrashedNotebookData,
  TrashedSheetData,
} from '../services/notebook';
import { ThemeService } from '../services/theme';
import { UserService } from '../services/user';
import { MobileNavComponent } from '../components/mobile-nav/mobile-nav';
import { TrashModalComponent } from '../components/trash-modal/trash-modal';

@Component({
  selector: 'app-home',
  imports: [FormsModule, TrashModalComponent, MobileNavComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  notebookService = inject(NotebookService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  themeService = inject(ThemeService);
  userService = inject(UserService);
  notebooks = signal<NotebookData[]>([]);
  trashedSheets = signal<TrashedSheetData[]>([]);
  trashedNotebooks = signal<TrashedNotebookData[]>([]);
  showTrash = signal(false);
  notebookContextMenu = signal<NotebookData | null>(null);
  notebookContextMenuPos = signal<{ x: number; y: number } | null>(null);
  currentRoute = signal('');

  trashSearch = signal('');
  trashSort = signal<'newest' | 'oldest'>('newest');
  trashPageNotebooks = signal(0);
  trashPageSheets = signal(0);
  readonly trashPageSize = 10;

  // Modal states
  showCreateNotebookModal = signal(false);
  showEditNotebookModal = signal(false);
  showDeleteNotebookModal = signal(false);
  showTrashModal = signal(false);
  showProfileDropdown = signal(false);
  showProfileModal = signal(false);
  showLogoModal = signal(false);
  showPasswordModal = signal(false);
  profileModalMessage = signal('');
  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  selectedProfileToLogin = signal('');
  showProfileSelection = signal(false);
  profileAvatar = signal('');
  profileSelectionError = signal('');
  sharedProfileMessage = signal('');
  profileNombre = signal('');
  profileApellidoPaterno = signal('');
  profileApellidoMaterno = signal('');
  profileGmail = signal('');
  profileLinkedin = signal('');

  newNotebookName = signal('');
  editNotebookName = signal('');
  notebookToEdit = signal<NotebookData | null>(null);
  notebookToDelete = signal<NotebookData | null>(null);

  private readonly profileSelectionEffect = effect(() => {
    const current = this.userService.currentUser();
    this.loadNotebooks();
    this.loadTrash();
    this.profileAvatar.set(current?.avatarUrl ?? '');
    const profiles = this.userService.getAllProfiles();
    this.showProfileSelection.set(!current && profiles.length > 1);
  });

  ngOnInit() {
    this.updateStorageInfo();
    this.detectCurrentRoute();
    // Update storage info every 5 seconds
    setInterval(() => this.updateStorageInfo(), 5000);
  }

  private detectCurrentRoute() {
    this.router.events.subscribe(() => {
      this.currentRoute.set(this.router.url.split('?')[0]);
    });
    // Set initial route
    this.currentRoute.set(this.router.url.split('?')[0]);
  }

  storageInfo = signal<{
    usedMB: string;
    availableMB: string;
    availableMBNumber: number;
    percentage: number;
  }>({ usedMB: '0', availableMB: '5.0', availableMBNumber: 5.0, percentage: 0 });

  private updateStorageInfo() {
    const info = this.notebookService.getStorageInfo();
    const availableMBNumber = info.available / 1024 / 1024;
    this.storageInfo.set({
      usedMB: (info.used / 1024 / 1024).toFixed(1),
      availableMB: availableMBNumber.toFixed(1),
      availableMBNumber: availableMBNumber,
      percentage: Math.round(info.percentage)
    });
  }

  forceCleanup() {
    this.notebookService.forceCleanup();
    this.updateStorageInfo();
    alert('Caché limpiado correctamente.');
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleProfileDropdown() {
    this.showProfileDropdown.update((value) => !value);
  }

  openProfileModal() {
    const current = this.userService.currentUser();
    if (current) {
      this.profileNombre.set(current.nombre ?? '');
      this.profileApellidoPaterno.set(current.apellidoPaterno ?? '');
      this.profileApellidoMaterno.set(current.apellidoMaterno ?? '');
      this.profileGmail.set(current.gmail ?? '');
      this.profileLinkedin.set(current.linkedin ?? '');
      this.profileAvatar.set(current.avatarUrl ?? '');
    }
    this.profileModalMessage.set('');
    this.showProfileModal.set(true);
    this.showProfileDropdown.set(false);
  }

  closeProfileModal() {
    this.showProfileModal.set(false);
    this.profileModalMessage.set('');
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
  }

  openLogoModal() {
    this.profileModalMessage.set('');
    this.showLogoModal.set(true);
    this.showProfileDropdown.set(false);
  }

  closeLogoModal() {
    this.showLogoModal.set(false);
    this.profileModalMessage.set('');
  }

  openPasswordModal() {
    this.profileModalMessage.set('');
    this.showPasswordModal.set(true);
    this.showProfileDropdown.set(false);
  }

  closePasswordModal() {
    this.showPasswordModal.set(false);
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.profileModalMessage.set('');
  }

  selectProfile(profileId: string) {
    if (this.userService.selectProfile(profileId)) {
      this.profileSelectionError.set('');
      this.showProfileSelection.set(false);
      this.showProfileDropdown.set(false);
      this.router.navigate(['/']);
      return;
    }
    this.profileSelectionError.set('No se pudo seleccionar ese perfil.');
  }

  saveProfile() {
    const current = this.userService.currentUser();
    if (!current) {
      this.profileModalMessage.set('No hay perfil activo.');
      return;
    }

    this.userService.updateProfile({
      ...current,
      nombre: this.profileNombre().trim() || undefined,
      apellidoPaterno: this.profileApellidoPaterno().trim() || undefined,
      apellidoMaterno: this.profileApellidoMaterno().trim() || undefined,
      gmail: this.profileGmail().trim() || undefined,
      linkedin: this.profileLinkedin().trim() || undefined,
      avatarUrl: this.profileAvatar() || current.avatarUrl,
    });
    this.profileModalMessage.set('Perfil guardado correctamente.');
  }

  onProfileLogoSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.userService.setAvatarUrl(dataUrl);
      this.profileAvatar.set(dataUrl);
      this.profileModalMessage.set('Logo actualizado.');
      this.showLogoModal.set(false);
    };
    reader.readAsDataURL(file);
  }

  changePassword() {
    if (this.newPassword().trim() !== this.confirmPassword().trim()) {
      this.profileModalMessage.set('Las contraseñas no coinciden.');
      return;
    }
    try {
      this.userService.changePassword(this.currentPassword().trim() || undefined, this.newPassword().trim());
      this.profileModalMessage.set('Contraseña actualizada.');
      this.closePasswordModal();
    } catch (error) {
      this.profileModalMessage.set(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    }
  }

  shareProfile() {
    const current = this.userService.currentUser();
    if (!current) {
      return;
    }
    const sharePayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'profile-share',
      profile: current,
      notebooks: this.notebookService.getNotebooks(current.id),
      trashedSheets: this.notebookService.getTrashedSheets(current.id),
      trashedNotebooks: this.notebookService.getTrashedNotebooks(current.id),
    };
    const data = JSON.stringify(sharePayload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `perfil-${current.username}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.profileModalMessage.set('Se descargó tu perfil para compartir.');
    this.showProfileDropdown.set(false);
  }

  openProfileSwitcher() {
    this.router.navigate(['/login']);
    this.showProfileDropdown.set(false);
  }

  // Modal methods
  openCreateNotebookModal() {
    this.newNotebookName.set('');
    this.showCreateNotebookModal.set(true);
  }

  closeCreateNotebookModal() {
    this.showCreateNotebookModal.set(false);
    this.newNotebookName.set('');
  }

  confirmCreateNotebook() {
    const name = this.newNotebookName().trim();
    if (!name) return;

    this.createNotebook();
    this.closeCreateNotebookModal();
  }

  openEditNotebookModal(notebook: NotebookData) {
    this.notebookToEdit.set(notebook);
    this.editNotebookName.set(notebook.name);
    this.showEditNotebookModal.set(true);
  }

  closeEditNotebookModal() {
    this.showEditNotebookModal.set(false);
    this.editNotebookName.set('');
    this.notebookToEdit.set(null);
  }

  confirmEditNotebook() {
    const notebook = this.notebookToEdit();
    const newName = this.editNotebookName().trim();

    if (!notebook || !newName) return;

    this.notebookService.updateNotebook(notebook.id, newName);
    this.loadNotebooks();
    this.closeEditNotebookModal();
  }

  openDeleteNotebookModal(notebook: NotebookData) {
    this.notebookToDelete.set(notebook);
    this.showDeleteNotebookModal.set(true);
  }

  closeDeleteNotebookModal() {
    this.showDeleteNotebookModal.set(false);
    this.notebookToDelete.set(null);
  }

  confirmDeleteNotebook() {
    const notebook = this.notebookToDelete();
    if (!notebook) return;

    this.moveNotebookToTrash(notebook);
    this.closeDeleteNotebookModal();
  }

  // Trash modal methods
  openTrashModal() {
    this.showTrashModal.set(true);
  }

  closeTrashModal() {
    this.showTrashModal.set(false);
    this.loadTrash(); // Refresh data when closing
  }

  loadNotebooks() {
    const ownerId = this.userService.currentUser()?.id;
    if (!ownerId) {
      this.notebooks.set([]);
      return;
    }
    this.notebooks.set(this.notebookService.getNotebooks(ownerId));
  }

  loadTrash() {
    const ownerId = this.userService.currentUser()?.id;
    if (!ownerId) {
      this.trashedSheets.set([]);
      this.trashedNotebooks.set([]);
      return;
    }
    this.trashedSheets.set(this.notebookService.getTrashedSheets(ownerId));
    this.trashedNotebooks.set(this.notebookService.getTrashedNotebooks(ownerId));
  }

  createNotebook() {
    const ownerId = this.userService.currentUser()?.id;
    if (!ownerId) {
      alert('Inicia sesión para crear y guardar cuadernos en tu perfil.');
      this.router.navigate(['/login']);
      return;
    }
    const name = this.newNotebookName().trim() || 'Nuevo cuaderno';
    this.notebookService.createNotebook(name, ownerId);
    this.loadNotebooks();
  }

  editNotebook(notebook: NotebookData) {
    const newName = prompt('Nuevo nombre:', notebook.name);
    if (newName) {
      this.notebookService.updateNotebook(notebook.id, newName);
      this.loadNotebooks();
    }
    this.closeNotebookContextMenu();
  }

  moveNotebookToTrash(notebook: NotebookData) {
    if (confirm(`¿Mover "${notebook.name}" a la papelera? Podrás restaurarlo después.`)) {
      this.notebookService.trashNotebook(notebook.id);
      this.loadNotebooks();
      this.loadTrash();
    }
    this.closeNotebookContextMenu();
  }

  openNotebook(notebook: NotebookData) {
    this.router.navigate(['/notebook', notebook.id]);
  }

  onNotebookContextMenu(notebook: NotebookData, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.notebookContextMenu.set(notebook);
    this.notebookContextMenuPos.set({ x: event.clientX, y: event.clientY });
  }

  closeNotebookContextMenu() {
    this.notebookContextMenu.set(null);
    this.notebookContextMenuPos.set(null);
  }

  restoreTrashedSheet(trashed: TrashedSheetData) {
    this.notebookService.restoreSheetFromTrash(trashed.id);
    this.loadNotebooks();
    this.loadTrash();
  }

  restoreTrashedNotebook(trashed: TrashedNotebookData) {
    this.notebookService.restoreNotebookFromTrash(trashed.id);
    this.loadNotebooks();
    this.loadTrash();
  }

  deleteSheetPermanently(trashed: TrashedSheetData) {
    if (confirm(`Eliminar definitivamente la hoja "${trashed.title}"?`)) {
      this.notebookService.deletePermanentlyFromTrash(trashed.id);
      this.loadTrash();
    }
  }

  deleteNotebookPermanently(trashed: TrashedNotebookData) {
    if (confirm(`Eliminar definitivamente el cuaderno "${trashed.name}"? Esta acción no se puede deshacer.`)) {
      this.notebookService.deleteNotebookPermanentlyFromTrash(trashed.id);
      this.loadTrash();
    }
  }

  toggleTrash() {
    this.showTrash.set(!this.showTrash());
  }

  setTrashSearch(value: string) {
    this.trashSearch.set(value);
    this.trashPageNotebooks.set(0);
    this.trashPageSheets.set(0);
  }

  setTrashSort(value: 'newest' | 'oldest') {
    this.trashSort.set(value);
    this.trashPageNotebooks.set(0);
    this.trashPageSheets.set(0);
  }

  filteredTrashedNotebooks(): TrashedNotebookData[] {
    let list = [...this.trashedNotebooks()];
    const q = this.trashSearch().trim().toLowerCase();
    if (q) {
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const da = new Date(a.deletedAt).getTime();
      const db = new Date(b.deletedAt).getTime();
      return this.trashSort() === 'newest' ? db - da : da - db;
    });
    return list;
  }

  filteredTrashedSheets(): TrashedSheetData[] {
    let list = [...this.trashedSheets()];
    const q = this.trashSearch().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          this.sheetNotebookLabel(t).toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const da = new Date(a.deletedAt).getTime();
      const db = new Date(b.deletedAt).getTime();
      return this.trashSort() === 'newest' ? db - da : da - db;
    });
    return list;
  }

  pagedTrashedNotebooks(): TrashedNotebookData[] {
    const all = this.filteredTrashedNotebooks();
    const p = this.trashPageNotebooks();
    return all.slice(p * this.trashPageSize, (p + 1) * this.trashPageSize);
  }

  pagedTrashedSheets(): TrashedSheetData[] {
    const all = this.filteredTrashedSheets();
    const p = this.trashPageSheets();
    return all.slice(p * this.trashPageSize, (p + 1) * this.trashPageSize);
  }

  trashNotebooksPageCount(): number {
    const n = this.filteredTrashedNotebooks().length;
    return n === 0 ? 0 : Math.ceil(n / this.trashPageSize);
  }

  trashSheetsPageCount(): number {
    const n = this.filteredTrashedSheets().length;
    return n === 0 ? 0 : Math.ceil(n / this.trashPageSize);
  }

  prevNotebookTrashPage() {
    this.trashPageNotebooks.update((p) => Math.max(0, p - 1));
  }

  nextNotebookTrashPage() {
    const max = this.trashNotebooksPageCount();
    if (max <= 0) {
      return;
    }
    this.trashPageNotebooks.update((p) => Math.min(max - 1, p + 1));
  }

  prevSheetTrashPage() {
    this.trashPageSheets.update((p) => Math.max(0, p - 1));
  }

  nextSheetTrashPage() {
    const max = this.trashSheetsPageCount();
    if (max <= 0) {
      return;
    }
    this.trashPageSheets.update((p) => Math.min(max - 1, p + 1));
  }

  trashTotalCount(): number {
    return this.trashedNotebooks().length + this.trashedSheets().length;
  }

  sheetNotebookLabel(s: TrashedSheetData): string {
    const nb = this.notebookService.getNotebook(s.notebookId);
    return nb?.name ?? 'Cuaderno eliminado o ausente';
  }

  emptyEntireTrash() {
    if (!this.trashedNotebooks().length && !this.trashedSheets().length) {
      return;
    }
    if (
      confirm(
        '¿Vaciar toda la papelera? Se borrarán todos los cuadernos y hojas en ella. No se puede deshacer.',
      )
    ) {
      this.notebookService.emptyAllTrash();
      this.loadTrash();
      this.trashPageNotebooks.set(0);
      this.trashPageSheets.set(0);
    }
  }

  /** Copia de seguridad local (JSON con cuadernos, papelera y adjuntos en base64). */
  exportBackup() {
    const json = this.notebookService.exportSnapshotJson();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-notion-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  onImportBackupSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (
          !confirm(
            '¿Reemplazar todos los datos de esta app por el contenido del archivo? Los datos actuales se perderán salvo que hayas exportado una copia.',
          )
        ) {
          return;
        }
        this.notebookService.importSnapshotReplace(reader.result as string);
        this.loadNotebooks();
        this.loadTrash();
        alert('Copia restaurada correctamente.');
      } catch {
        alert('No se pudo importar: el archivo no es válido o está corrupto.');
      }
    };
    reader.onerror = () => alert('No se pudo leer el archivo.');
    reader.readAsText(file);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
