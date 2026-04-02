import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'notebook/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => {
      // Return array of parameter objects for prerendering
      // This should return the actual notebook IDs you want to prerender
      // For now, return empty array to skip prerendering these routes
      return [];
    }
  },
  {
    path: 'notebook/:id/sheet/:sheetId',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => {
      // Return array of parameter objects for prerendering
      // This should return the actual notebook and sheet IDs you want to prerender
      // For now, return empty array to skip prerendering these routes
      return [];
    }
  }
];
