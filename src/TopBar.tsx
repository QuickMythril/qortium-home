import { ArrowRight, ChevronLeft, ChevronRight, Globe2, Plus, X } from 'lucide-react';
import type { DragEvent, FormEvent, MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { NodeStatusButton } from './NodeStatusButton';
import { Popover } from './components/Popover';
import type { AppRoute } from './routes';
import { parseAppAddress } from './routes';

type TopBarProps = {
  activeTabId: string;
  canGoBack: boolean;
  canGoForward: boolean;
  currentRoute: AppRoute | null;
  historyEntries: (AppRoute | null)[];
  historyIndex: number;
  nodeSettings: QortiumNodeSettings;
  tabs: BrowserTabSummary[];
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoToHistoryIndex: (index: number) => void;
  onNavigate: (route: AppRoute) => void;
  onReorderTab: (draggedTabId: string, targetTabId: string, dropPosition: TabDropPosition) => void;
  onSaveNodeSettings: (request: QortiumNodeSettingsRequest) => Promise<QortiumNodeSettings>;
  onSelectTab: (tabId: string) => void;
};

type TabDropPosition = 'after' | 'before';

type BrowserTabSummary = {
  id: string;
  label: string;
};

type HistoryButtonProps = {
  canNavigate: boolean;
  direction: 'back' | 'forward';
  historyEntries: (AppRoute | null)[];
  historyIndex: number;
  onJump: (index: number) => void;
  onStep: () => void;
};

type HistoryMenuItem = {
  entry: AppRoute | null;
  index: number;
};

function formatHistoryEntry(entry: AppRoute | null) {
  return entry?.displayUrl ?? 'Qortium Home';
}

function getHistoryItems(
  direction: HistoryButtonProps['direction'],
  historyEntries: HistoryButtonProps['historyEntries'],
  historyIndex: number,
) {
  if (direction === 'back') {
    return historyEntries
      .slice(0, historyIndex)
      .map<HistoryMenuItem>((entry, index) => ({ entry, index }))
      .reverse();
  }

  return historyEntries.slice(historyIndex + 1).map<HistoryMenuItem>((entry, offset) => ({
    entry,
    index: historyIndex + offset + 1,
  }));
}

function HistoryButton({
  canNavigate,
  direction,
  historyEntries,
  historyIndex,
  onJump,
  onStep,
}: HistoryButtonProps) {
  const label = direction === 'back' ? 'Back' : 'Forward';
  const Icon = direction === 'back' ? ChevronLeft : ChevronRight;
  const items = useMemo(
    () => getHistoryItems(direction, historyEntries, historyIndex),
    [direction, historyEntries, historyIndex],
  );

  function handleContextMenu(event: MouseEvent<HTMLButtonElement>, open: () => void) {
    event.preventDefault();

    if (canNavigate) {
      open();
    }
  }

  return (
    <Popover
      className="top-bar__history"
      contentClassName={`top-bar__history-popover top-bar__history-popover--${direction}`}
      contentId={`top-bar-${direction}-history`}
      contentLabel={`${label} history`}
      contentRole="menu"
      renderTrigger={({ close, contentId, isOpen, open }) => (
        <button
          className="icon-button top-bar__history-button"
          disabled={!canNavigate}
          title={`${label} (right-click for history)`}
          type="button"
          aria-controls={isOpen ? contentId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          onClick={() => {
            close();
            onStep();
          }}
          onContextMenu={(event) => handleContextMenu(event, open)}
        >
          <Icon aria-hidden="true" size={20} strokeWidth={2} />
          <span className="sr-only">{label}</span>
        </button>
      )}
    >
      {({ close }) => (
        <div className="top-bar__history-menu">
          {items.map((item) => (
            <button
              className="top-bar__history-menu-item"
              key={`${item.index}:${formatHistoryEntry(item.entry)}`}
              role="menuitem"
              type="button"
              onClick={() => {
                close();
                onJump(item.index);
              }}
            >
              <span className="top-bar__history-menu-label">{formatHistoryEntry(item.entry)}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function BrowserTabs({
  activeTabId,
  onAddTab,
  onCloseTab,
  onReorderTab,
  onSelectTab,
  tabs,
}: {
  activeTabId: string;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onReorderTab: (draggedTabId: string, targetTabId: string, dropPosition: TabDropPosition) => void;
  onSelectTab: (tabId: string) => void;
  tabs: BrowserTabSummary[];
}) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    position: TabDropPosition;
    tabId: string;
  } | null>(null);

  function getDropPosition(event: DragEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    return event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after';
  }

  function clearDragState() {
    setDraggedTabId(null);
    setDragTarget(null);
  }

  return (
    <div className="top-bar__tabs">
      <div
        className="top-bar__tab-list"
        role="tablist"
        aria-label="Browser tabs"
        onDoubleClick={(event) => {
          if (event.currentTarget === event.target) {
            onAddTab();
          }
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isDragTarget = dragTarget?.tabId === tab.id;

          return (
            <div
              className={`top-bar__tab${isActive ? ' top-bar__tab--active' : ''}${
                draggedTabId === tab.id ? ' top-bar__tab--dragging' : ''
              }${
                isDragTarget ? ` top-bar__tab--drop-${dragTarget.position}` : ''
              }`}
              draggable
              key={tab.id}
              role="presentation"
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onCloseTab(tab.id);
                }
              }}
              onDragEnd={clearDragState}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragTarget((currentTarget) =>
                    currentTarget?.tabId === tab.id ? null : currentTarget,
                  );
                }
              }}
              onDragOver={(event) => {
                if (!draggedTabId || draggedTabId === tab.id) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragTarget({
                  tabId: tab.id,
                  position: getDropPosition(event),
                });
              }}
              onDragStart={(event) => {
                setDraggedTabId(tab.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', tab.id);
              }}
              onDrop={(event) => {
                const sourceTabId = draggedTabId || event.dataTransfer.getData('text/plain');

                if (!sourceTabId || sourceTabId === tab.id) {
                  clearDragState();
                  return;
                }

                event.preventDefault();
                onReorderTab(sourceTabId, tab.id, getDropPosition(event));
                clearDragState();
              }}
            >
              <button
                className="top-bar__tab-select"
                role="tab"
                type="button"
                title={tab.label}
                aria-selected={isActive}
                onClick={() => onSelectTab(tab.id)}
              >
                <span className="top-bar__tab-label">{tab.label}</span>
              </button>
              <button
                className="top-bar__tab-close"
                type="button"
                title={`Close ${tab.label}`}
                aria-label={`Close ${tab.label}`}
                onClick={() => onCloseTab(tab.id)}
              >
                <X aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
      <button className="icon-button top-bar__new-tab" title="New tab" type="button" onClick={onAddTab}>
        <Plus aria-hidden="true" size={20} strokeWidth={2} />
        <span className="sr-only">New tab</span>
      </button>
    </div>
  );
}

export function TopBar({
  activeTabId,
  canGoBack,
  canGoForward,
  currentRoute,
  historyEntries,
  historyIndex,
  nodeSettings,
  tabs,
  onAddTab,
  onCloseTab,
  onGoBack,
  onGoForward,
  onGoToHistoryIndex,
  onNavigate,
  onReorderTab,
  onSaveNodeSettings,
  onSelectTab,
}: TopBarProps) {
  const [addressValue, setAddressValue] = useState('');
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    setAddressValue(currentRoute?.displayUrl ?? '');
    setAddressError('');
  }, [activeTabId, currentRoute]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedUrl = parseAppAddress(addressValue, nodeSettings.nodeApiUrl);

    if (!parsedUrl.success) {
      setAddressError(parsedUrl.message);
      return;
    }

    setAddressError('');
    onNavigate(parsedUrl.route);
  }

  return (
    <header className="top-bar">
      <BrowserTabs
        activeTabId={activeTabId}
        tabs={tabs}
        onAddTab={onAddTab}
        onCloseTab={onCloseTab}
        onReorderTab={onReorderTab}
        onSelectTab={onSelectTab}
      />
      <form className="top-bar__address-form" onSubmit={handleSubmit}>
        <HistoryButton
          canNavigate={canGoBack}
          direction="back"
          historyEntries={historyEntries}
          historyIndex={historyIndex}
          onJump={onGoToHistoryIndex}
          onStep={onGoBack}
        />
        <HistoryButton
          canNavigate={canGoForward}
          direction="forward"
          historyEntries={historyEntries}
          historyIndex={historyIndex}
          onJump={onGoToHistoryIndex}
          onStep={onGoForward}
        />
        <label className="sr-only" htmlFor="browser-address">
          Address
        </label>
        <div className="top-bar__address-control">
          <Globe2 aria-hidden="true" className="top-bar__address-icon" size={20} strokeWidth={2} />
          <input
            autoComplete="off"
            className="top-bar__address-input"
            id="browser-address"
            placeholder="qdn://APP, qdn://*/name, or /admin/status"
            spellCheck={false}
            type="text"
            value={addressValue}
            onChange={(event) => {
              setAddressValue(event.target.value);
              setAddressError('');
            }}
          />
        </div>
        <button className="icon-button top-bar__go-button" title="Load address" type="submit">
          <ArrowRight aria-hidden="true" size={20} strokeWidth={2} />
          <span className="sr-only">Load address</span>
        </button>
        {addressError ? <p className="top-bar__error">{addressError}</p> : null}
      </form>
      <NodeStatusButton nodeSettings={nodeSettings} onSaveNodeSettings={onSaveNodeSettings} />
    </header>
  );
}
