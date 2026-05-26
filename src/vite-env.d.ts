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

type QortiumQdnAuthorizeRequest = {
  identifier?: string;
  name: string;
  service: string;
};

type QortiumQdnAuthorizeResult = {
  authorized: true;
  nodeApiUrl: string;
};

type QortiumQdnRawResourceRequest = QortiumQdnAuthorizeRequest & {
  maxBytes?: number;
  path?: string;
  suggestedFilename?: string;
};

type QortiumQdnResourcesSearchRequest = {
  exactMatchNames?: boolean;
  includeMetadata?: boolean;
  includeStatus?: boolean;
  limit?: number;
  name?: string;
  service?: string;
};

type QortiumQdnTextResult =
  | {
      content: string;
      contentLength?: number;
      contentType?: string;
      tooLarge: false;
    }
  | {
      contentLength?: number;
      contentType?: string;
      tooLarge: true;
    };

type QortiumNodeApiRequest = {
  maxBytes?: number;
  path: string;
};

type QortiumNodeApiResult =
  | {
      body: string;
      contentLength?: number;
      contentType: string;
      status: number;
      statusText: string;
      tooLarge: false;
    }
  | {
      contentLength?: number;
      contentType: string;
      status: number;
      statusText: string;
      tooLarge: true;
    };

type QortiumQdnDownloadResult =
  | {
      canceled: true;
    }
  | {
      canceled: false;
      filePath: string;
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
    qdn: {
      authorizeResource: (
        request: QortiumQdnAuthorizeRequest,
      ) => Promise<QortiumQdnAuthorizeResult>;
      listResources: (
        request: QortiumQdnResourcesSearchRequest,
      ) => Promise<unknown>;
      fetchNodeApi: (
        request: QortiumNodeApiRequest,
      ) => Promise<QortiumNodeApiResult>;
      fetchResourceText: (
        request: QortiumQdnRawResourceRequest,
      ) => Promise<QortiumQdnTextResult>;
      downloadResource: (
        request: QortiumQdnRawResourceRequest,
      ) => Promise<QortiumQdnDownloadResult>;
    };
  };
}
