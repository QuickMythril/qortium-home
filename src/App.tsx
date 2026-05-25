import './styles.css';
import { useState } from 'react';
import { AccountsPanel } from './AccountsPanel';
import { QdnExplorer } from './QdnExplorer';
import { QdnViewer } from './QdnViewer';
import { TopBar } from './TopBar';
import type { QdnRoute } from './qdn';

type RouteHistoryState = {
  entries: (QdnRoute | null)[];
  index: number;
};

export function App() {
  const [routeHistory, setRouteHistory] = useState<RouteHistoryState>({
    entries: [null],
    index: 0,
  });
  const currentRoute = routeHistory.entries[routeHistory.index] ?? null;
  const isQdnRoute = currentRoute !== null;
  const canGoBack = routeHistory.index > 0;
  const canGoForward = routeHistory.index < routeHistory.entries.length - 1;

  function navigateToRoute(route: QdnRoute) {
    setRouteHistory((currentHistory) => {
      const currentEntry = currentHistory.entries[currentHistory.index] ?? null;

      if (currentEntry?.displayUrl === route.displayUrl) {
        return currentHistory;
      }

      const entries = [...currentHistory.entries.slice(0, currentHistory.index + 1), route];

      return {
        entries,
        index: entries.length - 1,
      };
    });
  }

  function goBack() {
    setRouteHistory((currentHistory) => ({
      ...currentHistory,
      index: Math.max(0, currentHistory.index - 1),
    }));
  }

  function goForward() {
    setRouteHistory((currentHistory) => ({
      ...currentHistory,
      index: Math.min(currentHistory.entries.length - 1, currentHistory.index + 1),
    }));
  }

  function goToHistoryIndex(index: number) {
    setRouteHistory((currentHistory) => ({
      ...currentHistory,
      index: Math.max(0, Math.min(currentHistory.entries.length - 1, index)),
    }));
  }

  return (
    <main className="app-shell">
      <TopBar
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        currentRoute={currentRoute}
        historyEntries={routeHistory.entries}
        historyIndex={routeHistory.index}
        onGoBack={goBack}
        onGoForward={goForward}
        onGoToHistoryIndex={goToHistoryIndex}
        onNavigate={navigateToRoute}
      />
      <section
        className={`app-main${isQdnRoute ? ' app-main--viewer' : ''}`}
        aria-label={isQdnRoute ? 'QDN page' : 'Qortium Home'}
      >
        {currentRoute?.kind === 'resource' ? (
          <QdnViewer resource={currentRoute.resource} />
        ) : currentRoute ? (
          <QdnExplorer route={currentRoute} onNavigate={navigateToRoute} />
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
