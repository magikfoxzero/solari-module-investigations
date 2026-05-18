import type { ModuleFrontend } from '@/shared/types/module';
import { useInvestigationsStore } from './store';

const module: ModuleFrontend = {
  id: 'investigations',
  pluginId: 'investigations-meta-app',
  routes: () => import('./routes'),
  navigation: {
    label: 'Investigations',
    icon: 'Search',
    section: 'apps',
    path: '/apps/investigations',
    order: 3,
  },
  dashboardCards: [
    { path: '/apps/investigations', label: 'Investigations', icon: 'Search', color: 'from-indigo-600 to-purple-600', order: 10 },
  ],
  homepageKey: 'investigations',
  onLogout: () => {
    useInvestigationsStore.setState({
      investigations: [], currentInvestigation: null,
      nodes: [], connections: [], drawings: [], statistics: null,
    });
  },
};

export default module;
