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
  accountId: string | null;
  history: RouteHistoryState;
  id: string;
};

type BrowserTabState = {
  activeTabId: string;
  tabs: BrowserTab[];
};

type TabDropPosition = 'after' | 'before';

let nextTabId = 1;

const EMPTY_ACCOUNTS_STATE: QortiumAccountsState = {
  accounts: [],
  activeAccountId: null,
};

function accountExists(accountsState: QortiumAccountsState, accountId: string | null) {
  return !!accountId && accountsState.accounts.some((account) => account.id === accountId);
}

function getDefaultAccountId(accountsState: QortiumAccountsState) {
  if (accountExists(accountsState, accountsState.activeAccountId)) {
    return accountsState.activeAccountId;
  }

  return accountsState.accounts[0]?.id ?? null;
}

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Account action failed.';
  }

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function createBrowserTab(accountId: string | null = null): BrowserTab {
  const id = `tab-${nextTabId}`;

  nextTabId += 1;

  return {
    accountId,
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
  const [accountsState, setAccountsState] = useState<QortiumAccountsState>(EMPTY_ACCOUNTS_STATE);
  const [accountsError, setAccountsError] = useState('');
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [nodeSettings, setNodeSettings] = useState<QortiumNodeSettings | null>(null);
  const [nodeSettingsError, setNodeSettingsError] = useState('');
  const [tabState, setTabState] = useState<BrowserTabState>(createInitialTabState);
  const activeTab = tabState.tabs.find((tab) => tab.id === tabState.activeTabId) ?? tabState.tabs[0];
  const activeAccount =
    accountsState.accounts.find((account) => account.id === activeTab.accountId) ?? null;
  const routeHistory = activeTab.history;
  const currentRoute = routeHistory.entries[routeHistory.index] ?? null;
  const isViewerRoute = currentRoute !== null;
  const canGoBack = routeHistory.index > 0;
  const canGoForward = routeHistory.index < routeHistory.entries.length - 1;

  function reconcileTabsWithAccounts(nextAccountsState: QortiumAccountsState) {
    setTabState((currentTabState) => {
      const defaultAccountId = getDefaultAccountId(nextAccountsState);
      const tabs = currentTabState.tabs.map((tab) => {
        if (accountExists(nextAccountsState, tab.accountId)) {
          return tab;
        }

        const currentRoute = tab.history.entries[tab.history.index] ?? null;
        const nextAccountId = tab.accountId && currentRoute ? null : defaultAccountId;

        if (tab.accountId === nextAccountId) {
          return tab;
        }

        return {
          ...tab,
          accountId: nextAccountId,
        };
      });

      return {
        ...currentTabState,
        tabs,
      };
    });
  }

  function handleAccountsStateChange(nextAccountsState: QortiumAccountsState) {
    setAccountsState(nextAccountsState);
    setAccountsError('');
    reconcileTabsWithAccounts(nextAccountsState);
  }

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

  useEffect(() => {
    let isDisposed = false;

    window.qortiumHome.accounts
      .list()
      .then((nextAccountsState) => {
        if (!isDisposed) {
          handleAccountsStateChange(nextAccountsState);
        }
      })
      .catch((error) => {
        if (!isDisposed) {
          setAccountsError(formatError(error));
        }
      })
      .finally(() => {
        if (!isDisposed) {
          setIsLoadingAccounts(false);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  async function saveNodeSettings(request: QortiumNodeSettingsRequest) {
    const settings = await window.qortiumHome.node.saveSettings(request);

    setNodeSettings(settings);

    return settings;
  }

  function updateActiveTab(updateTab: (tab: BrowserTab) => BrowserTab) {
    setTabState((currentTabState) => ({
      ...currentTabState,
      tabs: currentTabState.tabs.map((tab) =>
        tab.id === currentTabState.activeTabId ? updateTab(tab) : tab,
      ),
    }));
  }

  function updateActiveTabHistory(updateHistory: (history: RouteHistoryState) => RouteHistoryState) {
    updateActiveTab((tab) => ({
      ...tab,
      history: updateHistory(tab.history),
    }));
  }

  function updateActiveTabAccount(accountId: string | null) {
    updateActiveTab((tab) => {
      if (tab.accountId === accountId) {
        return tab;
      }

      return {
        ...tab,
        accountId,
      };
    });
  }

  function navigateToRoute(route: AppRoute) {
    const defaultAccountId = getDefaultAccountId(accountsState);

    updateActiveTab((tab) => {
      const currentEntry = tab.history.entries[tab.history.index] ?? null;
      const accountId = accountExists(accountsState, tab.accountId) ? tab.accountId : defaultAccountId;
      const history =
        currentEntry?.displayUrl === route.displayUrl
          ? tab.history
          : {
              entries: [...tab.history.entries.slice(0, tab.history.index + 1), route],
              index: tab.history.index + 1,
            };

      if (history === tab.history && accountId === tab.accountId) {
        return tab;
      }

      return {
        ...tab,
        accountId,
        history,
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
    const tab = createBrowserTab(getDefaultAccountId(accountsState));

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
        const tab = createBrowserTab(getDefaultAccountId(accountsState));

        return {
          tabs: [tab],
          activeTabId: tab.id,
        };
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

  function reorderTab(draggedTabId: string, targetTabId: string, dropPosition: TabDropPosition) {
    setTabState((currentTabState) => {
      if (draggedTabId === targetTabId) {
        return currentTabState;
      }

      const draggedTab = currentTabState.tabs.find((tab) => tab.id === draggedTabId);

      if (!draggedTab) {
        return currentTabState;
      }

      const tabsWithoutDraggedTab = currentTabState.tabs.filter((tab) => tab.id !== draggedTabId);
      const targetIndex = tabsWithoutDraggedTab.findIndex((tab) => tab.id === targetTabId);

      if (targetIndex === -1) {
        return currentTabState;
      }

      const insertIndex = dropPosition === 'after' ? targetIndex + 1 : targetIndex;
      const tabs = [
        ...tabsWithoutDraggedTab.slice(0, insertIndex),
        draggedTab,
        ...tabsWithoutDraggedTab.slice(insertIndex),
      ];

      return {
        ...currentTabState,
        tabs,
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
        activeAccount={activeAccount}
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
        onReorderTab={reorderTab}
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
            <AccountsPanel
              accountsError={accountsError}
              accountsState={accountsState}
              isLoadingAccounts={isLoadingAccounts}
              selectedAccountId={activeTab.accountId}
              onAccountsStateChange={handleAccountsStateChange}
              onSelectedAccountChange={updateActiveTabAccount}
            />
          </div>
        )}
      </section>
    </main>
  );
}
