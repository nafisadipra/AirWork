import { contextBridge, ipcRenderer } from 'electron';
import type { IPCAPI } from './types';

const electronAPI: IPCAPI = {
  // Auth
  register: (credentials) => ipcRenderer.invoke('auth:register', credentials),
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Profile
  getProfile: (userId) => ipcRenderer.invoke('profile:get', userId),
  updateProfile: (data) => ipcRenderer.invoke('profile:update', data),
  updateProjectAlias: (data) => ipcRenderer.invoke('profile:updateAlias', data),
  deleteProfile: (userId) => ipcRenderer.invoke('profile:delete', userId),

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
  exportPdf: (data) => ipcRenderer.invoke('doc:exportPdf', data),

  // Document Save/Load & Delete Branch --->
  loadDocument: (docId) => ipcRenderer.invoke('doc:load', docId),
  saveDocument: (data) => ipcRenderer.invoke('doc:save', data),
  deleteBranch: (data) => ipcRenderer.invoke('doc:deleteBranch', data),

  // Document Branching 
  createBranch: (data) => ipcRenderer.invoke('doc:createBranch', data),
  listBranches: (data) => ipcRenderer.invoke('doc:listBranches', data),
  mergeBranch: (data) => ipcRenderer.invoke('doc:mergeBranch', data),
  forceOverwriteBranch: (data) => ipcRenderer.invoke('doc:forceOverwriteBranch', data),

  // <--- NEW: Document History --->
  saveVersion: (data) => ipcRenderer.invoke('doc:saveVersion', data),
  listVersions: (data) => ipcRenderer.invoke('doc:listVersions', data),
  restoreVersion: (data) => ipcRenderer.invoke('doc:restoreVersion', data),

  // Peers
  listPeers: () => ipcRenderer.invoke('peers:list'),
  trustPeer: (peerId) => ipcRenderer.invoke('peers:trust', peerId),
  blockPeer: (peerId) => ipcRenderer.invoke('peers:block', peerId),
  getSafetyNumber: (peerId) => ipcRenderer.invoke('peers:get-safety-number', peerId),

  // Sync Events
  onSyncRefresh: (callback: () => void) => {
    ipcRenderer.on('sync-refresh', () => callback());
  },

  onSyncMessage: (callback: (data?: any) => void) => {
    const listener = (_event: any, data?: any) => callback(data);
    ipcRenderer.on('sync-refresh', listener);
    return () => ipcRenderer.removeListener('sync-refresh', listener);
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

  // Live P2P Sync
  sendDocumentUpdate: (data) => ipcRenderer.send('doc:send-update', data),
  onDocumentUpdate: (callback) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('doc:receive-update', subscription);
    return () => {
      ipcRenderer.removeListener('doc:receive-update', subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);