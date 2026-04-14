import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './account/login/login';
import { Account } from './account/account';
import { Notebook } from './notebook/notebook';
import { Sheets } from './notebook/sheets/sheets';
import { inject } from '@angular/core';
import { NotebookService } from './services/notebook';

export const routes: Routes = [
    {title: 'Mis cuadernos', path: '', component: Home},
    {title: 'Log In', path: 'login', component: Login},
    {title: 'Cuenta', path: 'account', component: Account},
    {
        title: (route) => {
            const notebookService = inject(NotebookService);
            const notebookId = route.paramMap.get('id');
            if (notebookId) {
                const notebook = notebookService.getNotebook(notebookId);
                return notebook ? `Cuaderno: ${notebook.name}` : 'Cuaderno no encontrado';
            }
            return 'Cuaderno';
        },
        path: 'notebook/:id',
        component: Notebook,
        children: [
            {
                title: (route) => {
                    const notebookService = inject(NotebookService);
                    const notebookId = route.paramMap.get('id') || route.parent?.paramMap.get('id');
                    const sheetId = route.paramMap.get('sheetId');
                    if (notebookId && sheetId) {
                        const sheet = notebookService.getSheet(notebookId, sheetId);
                        return sheet ? `Hoja: ${sheet.title}` : 'Hoja no encontrada';
                    }
                    return 'Hoja';
                },
                path: 'sheet/:sheetId',
                component: Sheets
            }
        ]
    },
    {path: '**', redirectTo: '', pathMatch: 'full', title: 'Mis cuadernos'}
];
