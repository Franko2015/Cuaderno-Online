import { Component, inject, signal, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NotebookService, SheetData } from '../../services/notebook';
import { GeminiService } from '../../services/gemini-service';

@Component({
  selector: 'app-sheets',
  imports: [],
  templateUrl: './sheets.html',
  styleUrl: './sheets.css',
})
export class Sheets implements OnInit {
  route = inject(ActivatedRoute);
  notebookService = inject(NotebookService);
  sheet = signal<SheetData | null>(null);
  @ViewChild('editor', { static: true }) editor!: ElementRef<HTMLDivElement>;
  showOptions = signal(false);

  gemini = inject(GeminiService);
  respuesta = '';

  ngOnInit() {
    const notebookId = this.route.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id');
    const sheetId = this.route.snapshot.paramMap.get('sheetId');
    if (notebookId && sheetId) {
      const s = this.notebookService.getSheet(notebookId, sheetId);
      this.sheet.set(s || null);
      if (this.sheet()) {
        setTimeout(() => {
          this.editor.nativeElement.innerHTML = this.sheet()!.content;
        });
      }
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.shiftKey && event.key === '_') {
      event.preventDefault();
      this.showOptions.set(true);
    }
  }
  
  saveContent() {
    if (this.sheet()) {
      const notebookId = this.route.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id');
      if (!notebookId) {
        return;
      }
      this.notebookService.updateSheet(notebookId, this.sheet()!.id, {
        content: this.editor.nativeElement.innerHTML,
      });
    }
  }

  insertTable() {
    const rows = prompt('Número de filas:');
    const cols = prompt('Número de columnas:');
    if (rows && cols) {
      const table = document.createElement('table');
      table.className = 'border-collapse border border-gray-300 dark:border-gray-600';
      for (let i = 0; i < +rows; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < +cols; j++) {
          const td = document.createElement('td');
          td.className = 'border border-gray-300 dark:border-gray-600 p-2';
          td.contentEditable = 'true';
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }
      this.insertElement(table);
    }
    this.showOptions.set(false);
  }

  insertHorizontalLine() {
    const hr = document.createElement('hr');
    hr.className = 'my-4 border-gray-300 dark:border-gray-600';
    this.insertElement(hr);
    this.showOptions.set(false);
  }

  insertVerticalLine() {
    // Para línea vertical, usar un div con estilo
    const div = document.createElement('div');
    div.className = 'inline-block w-px h-10 bg-gray-300 dark:bg-gray-600 mx-2';
    this.insertElement(div);
    this.showOptions.set(false);
  }

  private insertElement(element: HTMLElement) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.insertNode(element);
      range.setStartAfter(element);
      range.setEndAfter(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  closeOptions() {
    this.showOptions.set(false);
  }
}
