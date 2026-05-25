/// <reference types="vite/client" />

type QortiumAccountSummary = {
  address: string;
  id: string;
  isUnlocked: boolean;
  label: string;
  sourceFilename: string;
};

type QortiumAccountsState = {
  accounts: QortiumAccountSummary[];
  activeAccountId: string | null;
};

type QortiumLoadWalletResult = QortiumAccountsState & {
  canceled: boolean;
};

interface Window {
  qortiumHome: {
    accounts: {
      list: () => Promise<QortiumAccountsState>;
      loadWallet: () => Promise<QortiumLoadWalletResult>;
      setActiveAccount: (accountId: string) => Promise<QortiumAccountsState>;
      unlockWallet: (accountId: string, password: string) => Promise<QortiumAccountsState>;
      lockWallet: (accountId: string) => Promise<QortiumAccountsState>;
    };
    appName: string;
  };
}
