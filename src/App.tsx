import './styles.css';
import { useState } from 'react';
import { AccountsPanel } from './AccountsPanel';
import { ApiViewer } from './ApiViewer';
import { QdnExplorer } from './QdnExplorer';
import { QdnViewer } from './QdnViewer';
import { TopBar } from './TopBar';
import type { AppRoute } from './routes';

type RouteHistoryState = {
  entries: (AppRoute | null)[];
  index: number;
};

export function App() {
  const [routeHistory, setRouteHistory] = useState<RouteHistoryState>({
    entries: [null],
    index: 0,
  });
  const currentRoute = routeHistory.entries[routeHistory.index] ?? null;
  const isViewerRoute = currentRoute !== null;
  const canGoBack = routeHistory.index > 0;
  const canGoForward = routeHistory.index < routeHistory.entries.length - 1;

  function navigateToRoute(route: AppRoute) {
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
        className={`app-main${isViewerRoute ? ' app-main--viewer' : ''}`}
        aria-label={isViewerRoute ? 'Browser page' : 'Qortium Home'}
      >
        {currentRoute?.kind === 'node-api' ? (
          <ApiViewer route={currentRoute} />
        ) : currentRoute?.kind === 'resource' ? (
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
