import './styles.css';
import { useEffect, useState } from 'react';
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

type BrowserTab = {
  history: RouteHistoryState;
  id: string;
};

type BrowserTabState = {
  activeTabId: string;
  tabs: BrowserTab[];
};

let nextTabId = 1;

function createBrowserTab(): BrowserTab {
  const id = `tab-${nextTabId}`;

  nextTabId += 1;

  return {
    id,
    history: {
      entries: [null],
      index: 0,
    },
  };
}

function createInitialTabState(): BrowserTabState {
  const tab = createBrowserTab();

  return {
    activeTabId: tab.id,
    tabs: [tab],
  };
}

function getTabLabel(tab: BrowserTab) {
  return tab.history.entries[tab.history.index]?.displayUrl ?? 'Qortium Home';
}

export function App() {
  const [nodeSettings, setNodeSettings] = useState<QortiumNodeSettings | null>(null);
  const [nodeSettingsError, setNodeSettingsError] = useState('');
  const [tabState, setTabState] = useState<BrowserTabState>(createInitialTabState);
  const activeTab = tabState.tabs.find((tab) => tab.id === tabState.activeTabId) ?? tabState.tabs[0];
  const routeHistory = activeTab.history;
  const currentRoute = routeHistory.entries[routeHistory.index] ?? null;
  const isViewerRoute = currentRoute !== null;
  const canGoBack = routeHistory.index > 0;
  const canGoForward = routeHistory.index < routeHistory.entries.length - 1;

  useEffect(() => {
    let isDisposed = false;

    async function loadNodeSettings() {
      try {
        const settings = await window.qortiumHome.node.getSettings();

        if (!isDisposed) {
          setNodeSettings(settings);
          setNodeSettingsError('');
        }
      } catch (error) {
        if (!isDisposed) {
          setNodeSettingsError(error instanceof Error ? error.message : 'Unable to load node settings.');
        }
      }
    }

    void loadNodeSettings();

    return () => {
      isDisposed = true;
    };
  }, []);

  async function saveNodeSettings(request: QortiumNodeSettingsRequest) {
    const settings = await window.qortiumHome.node.saveSettings(request);

    setNodeSettings(settings);

    return settings;
  }

  function updateActiveTabHistory(updateHistory: (history: RouteHistoryState) => RouteHistoryState) {
    setTabState((currentTabState) => ({
      ...currentTabState,
      tabs: currentTabState.tabs.map((tab) =>
        tab.id === currentTabState.activeTabId
          ? {
              ...tab,
              history: updateHistory(tab.history),
            }
          : tab,
      ),
    }));
  }

  function navigateToRoute(route: AppRoute) {
    updateActiveTabHistory((currentHistory) => {
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
    updateActiveTabHistory((currentHistory) => ({
      ...currentHistory,
      index: Math.max(0, currentHistory.index - 1),
    }));
  }

  function goForward() {
    updateActiveTabHistory((currentHistory) => ({
      ...currentHistory,
      index: Math.min(currentHistory.entries.length - 1, currentHistory.index + 1),
    }));
  }

  function goToHistoryIndex(index: number) {
    updateActiveTabHistory((currentHistory) => ({
      ...currentHistory,
      index: Math.max(0, Math.min(currentHistory.entries.length - 1, index)),
    }));
  }

  function addTab() {
    const tab = createBrowserTab();

    setTabState((currentTabState) => ({
      tabs: [...currentTabState.tabs, tab],
      activeTabId: tab.id,
    }));
  }

  function selectTab(tabId: string) {
    setTabState((currentTabState) => {
      if (!currentTabState.tabs.some((tab) => tab.id === tabId)) {
        return currentTabState;
      }

      return {
        ...currentTabState,
        activeTabId: tabId,
      };
    });
  }

  function closeTab(tabId: string) {
    setTabState((currentTabState) => {
      if (currentTabState.tabs.length <= 1) {
        return currentTabState;
      }

      const closingTabIndex = currentTabState.tabs.findIndex((tab) => tab.id === tabId);

      if (closingTabIndex === -1) {
        return currentTabState;
      }

      const tabs = currentTabState.tabs.filter((tab) => tab.id !== tabId);
      const nextActiveIndex = Math.min(closingTabIndex, tabs.length - 1);

      return {
        tabs,
        activeTabId:
          currentTabState.activeTabId === tabId ? tabs[nextActiveIndex].id : currentTabState.activeTabId,
      };
    });
  }

  if (!nodeSettings) {
    return (
      <main className="app-shell">
        <section className="app-main" aria-label="Qortium Home">
          <div className="home-content">
            <h1>Qortium Home</h1>
            <p className={`app-message${nodeSettingsError ? ' app-message--error' : ''}`}>
              {nodeSettingsError || 'Loading node settings'}
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <TopBar
        activeTabId={tabState.activeTabId}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        currentRoute={currentRoute}
        historyEntries={routeHistory.entries}
        historyIndex={routeHistory.index}
        tabs={tabState.tabs.map((tab) => ({
          id: tab.id,
          label: getTabLabel(tab),
        }))}
        onAddTab={addTab}
        onCloseTab={closeTab}
        onGoBack={goBack}
        onGoForward={goForward}
        onGoToHistoryIndex={goToHistoryIndex}
        onNavigate={navigateToRoute}
        onSaveNodeSettings={saveNodeSettings}
        onSelectTab={selectTab}
        nodeSettings={nodeSettings}
      />
      <section
        className={`app-main${isViewerRoute ? ' app-main--viewer' : ''}`}
        aria-label={isViewerRoute ? 'Browser page' : 'Qortium Home'}
      >
        {currentRoute?.kind === 'node-api' ? (
          <ApiViewer route={currentRoute} />
        ) : currentRoute?.kind === 'resource' ? (
          <QdnViewer nodeApiUrl={nodeSettings.nodeApiUrl} resource={currentRoute.resource} />
        ) : currentRoute ? (
          <QdnExplorer nodeApiUrl={nodeSettings.nodeApiUrl} route={currentRoute} onNavigate={navigateToRoute} />
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
