import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { NotebookService } from '../services/notebook';

export const sheetTitleResolver: ResolveFn<string> = (route, state) => {
  const notebookService = inject(NotebookService);
  const notebookId = route.paramMap.get('id') || route.parent?.paramMap.get('id');
  const sheetId = route.paramMap.get('sheetId');
  
  if (notebookId && sheetId) {
    const sheet = notebookService.getSheet(notebookId, sheetId);
    const sheetTitle = sheet?.title || 'Hoja no encontrada';
    return `Hoja: ${sheetTitle}`;
  }
  
  return 'Hoja';
};
