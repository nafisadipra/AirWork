// Authentication Types
export interface AuthCredentials {
  userId: string;
  password?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: any;
}

// Document Types
export interface DocumentMetadata {
  type: 'private' | 'shared';
  title: string;
}

export interface DocumentResult {
  success: boolean;
  id?: string;
  error?: string;
  documents?: any[];
}

// The core IPC API exposed to the frontend
export interface IPCAPI {
  // Auth
  register: (credentials: AuthCredentials) => Promise<AuthResult>;
  login: (credentials: AuthCredentials) => Promise<AuthResult>;
  logout: () => Promise<void>;

  // Documents
  createDocument: (metadata: DocumentMetadata) => Promise<DocumentResult>;
  openDocument: (docId: string) => Promise<DocumentResult>;
  listDocuments: () => Promise<DocumentResult>;
  deleteDocument: (docId: string) => Promise<{ success: boolean }>;

  // Peers & P2P
  listPeers: () => Promise<{ success: boolean; peers?: any[] }>;
  trustPeer: (peerId: string) => Promise<{ success: boolean }>;
  blockPeer: (peerId: string) => Promise<{ success: boolean }>;
  getSafetyNumber: (peerId: string) => Promise<{ success: boolean; safetyNumber?: string }>;

  // Security & Backup
  getAuditLog: (limit: number) => Promise<{ success: boolean; logs?: any[] }>;
  getStats: () => Promise<{ success: boolean; stats?: any }>;
  createBackup: (password: string) => Promise<{ success: boolean; path?: string }>;
  restoreBackup: (backupPath: string, password: string) => Promise<{ success: boolean }>;

  // Event Listeners (Main to Renderer)
  onPeerDiscovered: (callback: (peerId: string) => void) => void;
  onPeerConnected: (callback: (peerId: string) => void) => void;
  onPeerDisconnected: (callback: (peerId: string) => void) => void;
  onDocumentUpdate: (callback: (docId: string) => void) => void;
  onUpdateAvailable: (callback: (info: any) => void) => void;
}

// Extend the global Window object so Next.js recognizes the API
declare global {
  interface Window {
    electronAPI: IPCAPI;
  }
}