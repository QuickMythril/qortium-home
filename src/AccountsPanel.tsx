import { useEffect, useMemo, useState } from 'react';

const SAVED_ACCOUNTS_STORAGE_KEY = 'qortium-home.saved-accounts';
const ACTIVE_ACCOUNT_STORAGE_KEY = 'qortium-home.active-account-id';

type SavedAccount = {
  address: string;
  id: string;
  label: string;
};

function isSavedAccount(value: unknown): value is SavedAccount {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const account = value as Partial<SavedAccount>;

  return (
    typeof account.address === 'string' &&
    account.address.length > 0 &&
    typeof account.id === 'string' &&
    account.id.length > 0 &&
    typeof account.label === 'string' &&
    account.label.length > 0
  );
}

function readSavedAccounts() {
  try {
    const parsedAccounts: unknown = JSON.parse(
      window.localStorage.getItem(SAVED_ACCOUNTS_STORAGE_KEY) ?? '[]',
    );

    if (!Array.isArray(parsedAccounts)) {
      return [];
    }

    return parsedAccounts.filter(isSavedAccount);
  } catch {
    return [];
  }
}

function readActiveAccountId(savedAccounts: SavedAccount[]) {
  const storedAccountId = window.localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);

  if (storedAccountId && savedAccounts.some((account) => account.id === storedAccountId)) {
    return storedAccountId;
  }

  return savedAccounts[0]?.id ?? '';
}

function formatAccountOption(account: SavedAccount) {
  return `${account.label} - ${account.address}`;
}

export function AccountsPanel() {
  const [hasLoadedAccounts, setHasLoadedAccounts] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState('');

  useEffect(() => {
    const nextSavedAccounts = readSavedAccounts();

    setSavedAccounts(nextSavedAccounts);
    setActiveAccountId(readActiveAccountId(nextSavedAccounts));
    setHasLoadedAccounts(true);
  }, []);

  useEffect(() => {
    if (hasLoadedAccounts) {
      window.localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(savedAccounts));
    }
  }, [hasLoadedAccounts, savedAccounts]);

  useEffect(() => {
    if (!hasLoadedAccounts) {
      return;
    }

    if (activeAccountId) {
      window.localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, activeAccountId);
    } else {
      window.localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    }
  }, [activeAccountId, hasLoadedAccounts]);

  const hasSavedAccounts = savedAccounts.length > 0;
  const activeAccount = useMemo(
    () => savedAccounts.find((account) => account.id === activeAccountId),
    [activeAccountId, savedAccounts],
  );

  return (
    <section className="accounts-panel" aria-label="Accounts">
      <div className="accounts-panel__actions" aria-label="Account actions">
        <button className="button" type="button" disabled>
          New
        </button>
        <button className="button" type="button" disabled>
          Load
        </button>
      </div>

      {hasSavedAccounts ? (
        <label className="account-selector">
          <span className="account-selector__label">Active account</span>
          <select
            className="account-selector__select"
            value={activeAccount?.id ?? ''}
            onChange={(event) => setActiveAccountId(event.target.value)}
          >
            {savedAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {formatAccountOption(account)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}
