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

type QortiumSelectWalletResult =
  | {
      canceled: true;
    }
  | {
      accountId: string;
      address: string;
      canceled: false;
      suggestedName: string;
      token: string;
    };

type QortiumCreateWalletResult = QortiumAccountsState & {
  canceled: boolean;
};

interface Window {
  qortiumHome: {
    accounts: {
      list: () => Promise<QortiumAccountsState>;
      selectWalletFile: () => Promise<QortiumSelectWalletResult>;
      discardLoadedWallet: (token: string) => Promise<void>;
      saveLoadedWallet: (token: string, name: string) => Promise<QortiumAccountsState>;
      createWallet: (name: string, password: string) => Promise<QortiumCreateWalletResult>;
      setActiveAccount: (accountId: string) => Promise<QortiumAccountsState>;
      unlockWallet: (accountId: string, password: string) => Promise<QortiumAccountsState>;
      lockWallet: (accountId: string) => Promise<QortiumAccountsState>;
      removeWallet: (accountId: string, password?: string) => Promise<QortiumAccountsState>;
    };
    appName: string;
  };
}
