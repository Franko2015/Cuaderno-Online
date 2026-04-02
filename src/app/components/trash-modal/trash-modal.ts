import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotebookService, TrashedSheetData, TrashedNotebookData } from '../../services/notebook';

@Component({
  selector: 'app-trash-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trash-modal.html',
  styleUrls: ['./trash-modal.css']
})
export class TrashModalComponent {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  
  trashedSheets: TrashedSheetData[] = [];
  trashedNotebooks: TrashedNotebookData[] = [];
  
  activeTab: 'sheets' | 'notebooks' = 'sheets';
  
  constructor(public notebookService: NotebookService) {}
  
  ngOnChanges() {
    if (this.isOpen) {
      this.loadTrashData();
    }
  }
  
  loadTrashData() {
    this.trashedSheets = this.notebookService.getTrashedSheets();
    this.trashedNotebooks = this.notebookService.getTrashedNotebooks();
  }
  
  restoreSheet(sheetId: string) {
    this.notebookService.restoreSheetFromTrash(sheetId);
    this.loadTrashData();
  }
  
  restoreNotebook(notebookId: string) {
    this.notebookService.restoreNotebookFromTrash(notebookId);
    this.loadTrashData();
  }
  
  deleteSheetPermanently(sheetId: string) {
    if (confirm('¿Estás seguro de que quieres eliminar esta hoja permanentemente?')) {
      this.notebookService.deletePermanentlyFromTrash(sheetId);
      this.loadTrashData();
    }
  }
  
  deleteNotebookPermanently(notebookId: string) {
    if (confirm('¿Estás seguro de que quieres eliminar este cuaderno permanentemente?')) {
      this.notebookService.deleteNotebookPermanentlyFromTrash(notebookId);
      this.loadTrashData();
    }
  }
  
  emptySheetsTrash() {
    if (confirm('¿Estás seguro de que quieres vaciar la papelera de hojas?')) {
      this.notebookService.emptyTrashedSheets();
      this.loadTrashData();
    }
  }
  
  emptyNotebooksTrash() {
    if (confirm('¿Estás seguro de que quieres vaciar la papelera de cuadernos?')) {
      this.notebookService.emptyTrashedNotebooks();
      this.loadTrashData();
    }
  }
  
  emptyAllTrash() {
    if (confirm('¿Estás seguro de que quieres vaciar toda la papelera permanentemente?')) {
      this.notebookService.emptyAllTrash();
      this.loadTrashData();
    }
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  onClose() {
    this.closeModal.emit();
  }
  
  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
