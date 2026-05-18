import { InvestigationsPage } from './pages/InvestigationsPage';
import { InvestigationCanvasPage } from './pages/InvestigationCanvasPage';
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = [
  { path: '/apps/investigations', element: <InvestigationsPage /> },
  { path: '/apps/investigations/:id', element: <InvestigationCanvasPage /> },
  { path: '/apps/investigations/:id/canvas', element: <InvestigationCanvasPage /> },
];

export default routes;
