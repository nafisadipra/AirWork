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

  createProject: (data: { name: string; userId: string }) => Promise<{ success: boolean; projectId?: string; error?: string }>;
  joinProject: (data: { token: string; userId: string }) => Promise<{ success: boolean; error?: string }>;

  // Projectlists
  listProjects: (data: { userId: string }) => Promise<{ success: boolean; projects?: any[]; error?: string }>;

  // Tasks
  listTasks: (data: { projectId: string }) => Promise<{ success: boolean; tasks?: any[]; error?: string }>;
  createTask: (args: { 
    projectId: string; 
    title: string; 
    status: string; 
    assigneeId?: string | null; 
    startDate?: string | null; 
    dueDate?: string | null; 
  }) => Promise<{ success: boolean; taskId?: string; error?: string }>;
  updateTaskStatus: (data: { taskId: string; newStatus: string }) => Promise<{ success: boolean; error?: string }>;

  deleteTask: (data: { taskId: string }) => Promise<{ success: boolean; error?: string }>;

  getProjectMembers: (data: { projectId: string }) => Promise<{ success: boolean; members?: any[]; error?: string }>;
  generateInviteToken: (data: { projectId: string; userId: string }) => Promise<{ success: boolean; inviteToken?: string; error?: string }>;

  // Documents
  createDocument: (metadata: { projectId: string, title: string, type: string }) => Promise<DocumentResult>;
  openDocument: (docId: string) => Promise<DocumentResult>;
  listDocuments: (data: { projectId: string }) => Promise<DocumentResult>;
  deleteDocument: (docId: string) => Promise<{ success: boolean }>;

  // <--- NEW: Document Save/Load & Delete Branch --->
  loadDocument: (docId: string) => Promise<{ success: boolean; state?: number[]; error?: string }>;
  saveDocument: (data: { docId: string; state: number[] }) => Promise<{ success: boolean; error?: string }>;
  deleteBranch: (data: { branchId: string }) => Promise<{ success: boolean; error?: string }>;

  // Document Branching (NEW)
  createBranch: (data: { documentId: string; branchName: string; userId: string }) => Promise<{ success: boolean; branchId?: string; error?: string }>;
  listBranches: (data: { documentId: string }) => Promise<{ success: boolean; branches?: any[]; error?: string }>;
  mergeBranch: (data: { branchId: string; documentId: string }) => Promise<{ success: boolean; error?: string }>;

  // Peers & P2P
  listPeers: () => Promise<{ success: boolean; peers?: any[] }>;
  trustPeer: (peerId: string) => Promise<{ success: boolean }>;
  blockPeer: (peerId: string) => Promise<{ success: boolean }>;
  getSafetyNumber: (peerId: string) => Promise<{ success: boolean; safetyNumber?: string }>;

  // Sync Events
  onSyncRefresh: (callback: () => void) => void;

  // Chat
  getMessages: (data: { projectId: string }) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
  sendMessage: (data: { id: string; projectId: string; sender: string; text: string; attachment: string | null; attachmentName: string | null; timestamp: string }) => Promise<{ success: boolean }>;
  editMessage: (data: { id: string; text: string }) => Promise<{ success: boolean }>;
  deleteMessage: (data: { id: string }) => Promise<{ success: boolean }>;

  // Security & Backup
  getAuditLog: (limit: number) => Promise<{ success: boolean; logs?: any[] }>;
  getStats: () => Promise<{ success: boolean; stats?: any }>;
  createBackup: (password: string) => Promise<{ success: boolean; path?: string }>;
  restoreBackup: (backupPath: string, password: string) => Promise<{ success: boolean }>;

  // Event Listeners (Main to Renderer)
  onPeerDiscovered: (callback: (peerId: string) => void) => void;
  onPeerConnected: (callback: (peerId: string) => void) => void;
  onPeerDisconnected: (callback: (peerId: string) => void) => void;
  onUpdateAvailable: (callback: (info: any) => void) => void;

  // Live P2P Sync (Upgraded)
  sendDocumentUpdate: (data: { docId: string, update: number[] }) => void;
  onDocumentUpdate: (callback: (data: { docId: string, update: number[] }) => void) => () => void;
}

// Extend the global Window object so Next.js recognizes the API
declare global {
  interface Window {
    electronAPI: IPCAPI;
  }
}