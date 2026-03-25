import { contextBridge, ipcRenderer } from 'electron';
import type { IPCAPI } from './types';


const electronAPI: IPCAPI = {
  // Auth
  register: (credentials) => ipcRenderer.invoke('auth:register', credentials),
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Projects
  createProject: (data) => ipcRenderer.invoke('project:create', data),

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
  listDocuments: () => ipcRenderer.invoke('doc:list'),
  deleteDocument: (docId) => ipcRenderer.invoke('doc:delete', docId),

  // Peers
  listPeers: () => ipcRenderer.invoke('peers:list'),
  trustPeer: (peerId) => ipcRenderer.invoke('peers:trust', peerId),
  blockPeer: (peerId) => ipcRenderer.invoke('peers:block', peerId),
  getSafetyNumber: (peerId) => ipcRenderer.invoke('peers:get-safety-number', peerId),

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
  onDocumentUpdate: (callback) => {
    ipcRenderer.on('document-update', (_event, docId) => callback(docId));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', (_event, info) => callback(info));
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);