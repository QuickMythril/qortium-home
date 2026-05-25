import { Lock, Unlock } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const EMPTY_ACCOUNTS_STATE: QortiumAccountsState = {
  accounts: [],
  activeAccountId: null,
};

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Account action failed.';
  }

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function formatAccountOption(account: QortiumAccountSummary) {
  return `${account.label} - ${account.address}`;
}

export function AccountsPanel() {
  const [accountsState, setAccountsState] = useState<QortiumAccountsState>(EMPTY_ACCOUNTS_STATE);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWalletPassword, setNewWalletPassword] = useState('');
  const [newWalletPasswordConfirm, setNewWalletPasswordConfirm] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [unlockingAccountId, setUnlockingAccountId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [accountError, setAccountError] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    let isMounted = true;

    window.qortiumHome.accounts
      .list()
      .then((nextAccountsState) => {
        if (isMounted) {
          setAccountsState(nextAccountsState);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAccountError(formatError(error));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAccounts(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeAccount = useMemo(
    () => accountsState.accounts.find((account) => account.id === accountsState.activeAccountId),
    [accountsState.accounts, accountsState.activeAccountId],
  );
  const unlockingAccount = useMemo(
    () => accountsState.accounts.find((account) => account.id === unlockingAccountId),
    [accountsState.accounts, unlockingAccountId],
  );
  const hasSavedAccounts = accountsState.accounts.length > 0;

  function openCreateDialog() {
    setAccountError('');
    setCreateError('');
    setNewWalletPassword('');
    setNewWalletPasswordConfirm('');
    setIsCreateDialogOpen(true);
  }

  function closeCreateDialog() {
    if (isCreatingWallet) {
      return;
    }

    setIsCreateDialogOpen(false);
    setCreateError('');
    setNewWalletPassword('');
    setNewWalletPasswordConfirm('');
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError('');

    if (!newWalletPassword) {
      setCreateError('Enter the wallet password.');
      return;
    }

    if (!newWalletPasswordConfirm) {
      setCreateError('Confirm the wallet password.');
      return;
    }

    if (newWalletPassword !== newWalletPasswordConfirm) {
      setCreateError('Wallet passwords do not match.');
      return;
    }

    setIsCreatingWallet(true);

    try {
      const nextAccountsState = await window.qortiumHome.accounts.createWallet(newWalletPassword);

      if (!nextAccountsState.canceled) {
        setAccountsState({
          accounts: nextAccountsState.accounts,
          activeAccountId: nextAccountsState.activeAccountId,
        });
      }

      setIsCreateDialogOpen(false);
      setNewWalletPassword('');
      setNewWalletPasswordConfirm('');
    } catch (error) {
      setCreateError(formatError(error));
    } finally {
      setIsCreatingWallet(false);
    }
  }

  async function handleLoadWallet() {
    setAccountError('');
    setIsLoadingWallet(true);

    try {
      const nextAccountsState = await window.qortiumHome.accounts.loadWallet();

      if (!nextAccountsState.canceled) {
        setAccountsState({
          accounts: nextAccountsState.accounts,
          activeAccountId: nextAccountsState.activeAccountId,
        });
      }
    } catch (error) {
      setAccountError(formatError(error));
    } finally {
      setIsLoadingWallet(false);
    }
  }

  async function handleActiveAccountChange(accountId: string) {
    setAccountError('');

    try {
      setAccountsState(await window.qortiumHome.accounts.setActiveAccount(accountId));
    } catch (error) {
      setAccountError(formatError(error));
    }
  }

  async function handleLockToggle() {
    if (!activeAccount) {
      return;
    }

    setAccountError('');

    if (!activeAccount.isUnlocked) {
      setPassword('');
      setUnlockError('');
      setUnlockingAccountId(activeAccount.id);
      return;
    }

    try {
      setAccountsState(await window.qortiumHome.accounts.lockWallet(activeAccount.id));
    } catch (error) {
      setAccountError(formatError(error));
    }
  }

  function closeUnlockDialog() {
    setUnlockingAccountId(null);
    setPassword('');
    setUnlockError('');
  }

  async function handleUnlockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!unlockingAccount) {
      return;
    }

    setUnlockError('');
    setIsUnlocking(true);

    try {
      setAccountsState(await window.qortiumHome.accounts.unlockWallet(unlockingAccount.id, password));
      closeUnlockDialog();
    } catch (error) {
      setUnlockError(formatError(error));
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <section className="accounts-panel" aria-label="Accounts">
      <div className="accounts-panel__actions" aria-label="Account actions">
        <button
          className="button"
          type="button"
          disabled={isLoadingAccounts || isCreatingWallet}
          onClick={openCreateDialog}
        >
          {isCreatingWallet ? 'Creating' : 'New'}
        </button>
        <button
          className="button"
          type="button"
          disabled={isLoadingAccounts || isLoadingWallet}
          onClick={handleLoadWallet}
        >
          {isLoadingWallet ? 'Loading' : 'Load'}
        </button>
      </div>

      {hasSavedAccounts ? (
        <label className="account-selector">
          <span className="account-selector__label">Active account</span>
          <span className="account-selector__control">
            <select
              className="account-selector__select"
              value={activeAccount?.id ?? ''}
              onChange={(event) => handleActiveAccountChange(event.target.value)}
            >
              {accountsState.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {formatAccountOption(account)}
                </option>
              ))}
            </select>
            <button
              aria-label={activeAccount?.isUnlocked ? 'Lock selected account' : 'Unlock selected account'}
              className={`icon-button account-selector__lock-button${
                activeAccount?.isUnlocked ? ' account-selector__lock-button--unlocked' : ''
              }`}
              title={activeAccount?.isUnlocked ? 'Lock selected account' : 'Unlock selected account'}
              type="button"
              onClick={handleLockToggle}
            >
              {activeAccount?.isUnlocked ? <Unlock size={20} /> : <Lock size={20} />}
            </button>
          </span>
        </label>
      ) : null}

      {accountError ? <p className="accounts-panel__message accounts-panel__message--error">{accountError}</p> : null}

      {isCreateDialogOpen ? (
        <div className="modal-backdrop" onMouseDown={closeCreateDialog}>
          <form
            aria-label="Create account"
            aria-modal="true"
            className="unlock-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={handleCreateSubmit}
          >
            <h2 className="unlock-dialog__title">New Account</h2>
            <label className="field">
              <span className="field__label">Password</span>
              <input
                autoFocus
                className="field__input"
                type="password"
                value={newWalletPassword}
                onChange={(event) => setNewWalletPassword(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Confirm password</span>
              <input
                className="field__input"
                type="password"
                value={newWalletPasswordConfirm}
                onChange={(event) => setNewWalletPasswordConfirm(event.target.value)}
              />
            </label>
            {createError ? (
              <p className="accounts-panel__message accounts-panel__message--error">{createError}</p>
            ) : null}
            <div className="unlock-dialog__actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={isCreatingWallet}
                onClick={closeCreateDialog}
              >
                Cancel
              </button>
              <button className="button" type="submit" disabled={isCreatingWallet}>
                {isCreatingWallet ? 'Creating' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {unlockingAccount ? (
        <div className="modal-backdrop" onMouseDown={closeUnlockDialog}>
          <form
            aria-label="Unlock account"
            aria-modal="true"
            className="unlock-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={handleUnlockSubmit}
          >
            <h2 className="unlock-dialog__title">Unlock Account</h2>
            <p className="unlock-dialog__account">{formatAccountOption(unlockingAccount)}</p>
            <label className="field">
              <span className="field__label">Password</span>
              <input
                autoFocus
                className="field__input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {unlockError ? (
              <p className="accounts-panel__message accounts-panel__message--error">{unlockError}</p>
            ) : null}
            <div className="unlock-dialog__actions">
              <button className="button button--secondary" type="button" onClick={closeUnlockDialog}>
                Cancel
              </button>
              <button className="button" type="submit" disabled={isUnlocking}>
                {isUnlocking ? 'Unlocking' : 'Unlock'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
