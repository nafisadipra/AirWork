import { contextBridge, ipcRenderer } from 'electron';
import type { IPCAPI } from './types';

const electronAPI: IPCAPI = {
  // Auth
  register: (credentials) => ipcRenderer.invoke('auth:register', credentials),
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Projects
  createProject: (data) => ipcRenderer.invoke('project:create', data),
  joinProject: (data) => ipcRenderer.invoke('project:join', data),

  // Projectlist 
  listProjects: (data) => ipcRenderer.invoke('project:list', data),

  // Tasks
  listTasks: (data) => ipcRenderer.invoke('task:list', data),
  createTask: (data) => ipcRenderer.invoke('task:create', data),
  updateTaskStatus: (data) => ipcRenderer.invoke('task:updateStatus', data),

  deleteTask: (data) => ipcRenderer.invoke('task:delete', data),

  // Project Settings & Members
  getProjectMembers: (data) => ipcRenderer.invoke('project:getMembers', data),
  generateInviteToken: (data) => ipcRenderer.invoke('project:generateInvite', data),

  // Documents
  createDocument: (metadata) => ipcRenderer.invoke('doc:create', metadata),
  openDocument: (docId) => ipcRenderer.invoke('doc:open', docId),
  listDocuments: (data) => ipcRenderer.invoke('doc:list', data),
  deleteDocument: (docId) => ipcRenderer.invoke('doc:delete', docId),

  // <--- NEW: Document Save/Load & Delete Branch --->
  loadDocument: (docId) => ipcRenderer.invoke('doc:load', docId),
  saveDocument: (data) => ipcRenderer.invoke('doc:save', data),
  deleteBranch: (data) => ipcRenderer.invoke('doc:deleteBranch', data),

  // Document Branching (NEW)
  createBranch: (data) => ipcRenderer.invoke('doc:createBranch', data),
  listBranches: (data) => ipcRenderer.invoke('doc:listBranches', data),
  mergeBranch: (data) => ipcRenderer.invoke('doc:mergeBranch', data),

  // Peers
  listPeers: () => ipcRenderer.invoke('peers:list'),
  trustPeer: (peerId) => ipcRenderer.invoke('peers:trust', peerId),
  blockPeer: (peerId) => ipcRenderer.invoke('peers:block', peerId),
  getSafetyNumber: (peerId) => ipcRenderer.invoke('peers:get-safety-number', peerId),

  // Sync Events
  onSyncRefresh: (callback: () => void) => {
    ipcRenderer.on('sync-refresh', () => callback());
  },

  // Chat
  getMessages: (data) => ipcRenderer.invoke('chat:get', data),
  sendMessage: (data) => ipcRenderer.invoke('chat:send', data),
  editMessage: (data) => ipcRenderer.invoke('chat:edit', data),
  deleteMessage: (data) => ipcRenderer.invoke('chat:delete', data),

  // Security
  getAuditLog: (limit) => ipcRenderer.invoke('security:get-audit-log', limit),
  getStats: () => ipcRenderer.invoke('security:get-stats'),

  // Backup
  createBackup: (password) => ipcRenderer.invoke('backup:create', password),
  restoreBackup: (backupPath, password) => 
    ipcRenderer.invoke('backup:restore', { backupPath, password }),

  // Events
  onPeerDiscovered: (callback) => {
    ipcRenderer.on('peer-discovered', (_event, peerId) => callback(peerId));
  },
  onPeerConnected: (callback) => {
    ipcRenderer.on('peer-connected', (_event, peerId) => callback(peerId));
  },
  onPeerDisconnected: (callback) => {
    ipcRenderer.on('peer-disconnected', (_event, peerId) => callback(peerId));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', (_event, info) => callback(info));
  },

  // Live P2P Sync (Upgraded)
  sendDocumentUpdate: (data) => ipcRenderer.send('doc:send-update', data),
  onDocumentUpdate: (callback) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('doc:receive-update', subscription);
    // Return a cleanup function so React can stop listening when you close the document
    return () => {
      ipcRenderer.removeListener('doc:receive-update', subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);