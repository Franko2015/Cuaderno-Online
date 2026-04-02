import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { NotebookService } from '../services/notebook';

export const notebookTitleResolver: ResolveFn<string> = (route, state) => {
  const notebookService = inject(NotebookService);
  const notebookId = route.paramMap.get('id');
  
  if (notebookId) {
    const notebook = notebookService.getNotebook(notebookId);
    const notebookName = notebook?.name || 'Cuaderno no encontrado';
    return `Cuaderno: ${notebookName}`;
  }
  
  return 'Cuaderno';
};
