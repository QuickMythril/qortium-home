import './styles.css';
import { useState } from 'react';
import { AccountsPanel } from './AccountsPanel';
import { QdnExplorer } from './QdnExplorer';
import { QdnViewer } from './QdnViewer';
import { TopBar } from './TopBar';
import type { QdnRoute } from './qdn';

export function App() {
  const [currentRoute, setCurrentRoute] = useState<QdnRoute | null>(null);
  const isQdnRoute = currentRoute !== null;

  return (
    <main className="app-shell">
      <TopBar currentRoute={currentRoute} onNavigate={setCurrentRoute} />
      <section
        className={`app-main${isQdnRoute ? ' app-main--viewer' : ''}`}
        aria-label={isQdnRoute ? 'QDN page' : 'Qortium Home'}
      >
        {currentRoute?.kind === 'resource' ? (
          <QdnViewer resource={currentRoute.resource} />
        ) : currentRoute ? (
          <QdnExplorer route={currentRoute} onNavigate={setCurrentRoute} />
        ) : (
          <div className="home-content">
            <h1>Qortium Home</h1>
            <AccountsPanel />
          </div>
        )}
      </section>
    </main>
  );
}
