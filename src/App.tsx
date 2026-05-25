import './styles.css';
import { useState } from 'react';
import { AccountsPanel } from './AccountsPanel';
import { QdnViewer } from './QdnViewer';
import { TopBar } from './TopBar';
import type { QdnResource } from './qdn';

export function App() {
  const [currentResource, setCurrentResource] = useState<QdnResource | null>(null);

  return (
    <main className="app-shell">
      <TopBar currentResource={currentResource} onNavigate={setCurrentResource} />
      <section
        className={`app-main${currentResource ? ' app-main--viewer' : ''}`}
        aria-label={currentResource ? 'QDN page' : 'Qortium Home'}
      >
        {currentResource ? (
          <QdnViewer resource={currentResource} />
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
