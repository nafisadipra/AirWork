export const INITIAL_SCHEMA = `
  -- ==========================================
  -- 1. PEERS & IDENTITY
  -- ==========================================
  CREATE TABLE IF NOT EXISTS peers (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT,
    public_key TEXT NOT NULL,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ==========================================
  -- 2. PROJECTS & WORKSPACES
  -- ==========================================
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES peers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT,
    peer_id TEXT,
    role TEXT NOT NULL DEFAULT 'editor', 
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, peer_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (peer_id) REFERENCES peers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS project_invites (
    invite_token TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    created_by TEXT,
    role TEXT NOT NULL DEFAULT 'editor',
    expires_at DATETIME NOT NULL,
    is_accepted BOOLEAN DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES peers(id) ON DELETE CASCADE
  );

  -- ==========================================
  -- 3. KANBAN TIMELINES & DOCUMENTS
  -- ==========================================
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    position INTEGER NOT NULL DEFAULT 0,
    assigned_to TEXT, 
    start_date TEXT, 
    due_date TEXT, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES peers(id) ON DELETE SET NULL
  );

  -- The "main" branch of your documents
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL, 
    title TEXT NOT NULL,
    yjs_state BLOB,
    last_edited_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (last_edited_by) REFERENCES peers(id) ON DELETE SET NULL
  );

  -- <--- NEW: ISOLATED DOCUMENT BRANCHES --->
  CREATE TABLE IF NOT EXISTS document_branches (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    yjs_state BLOB,
    created_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES peers(id) ON DELETE SET NULL
  );

  -- ==========================================
  -- 4. ENCRYPTED CHAT & ATTACHMENTS
  -- ==========================================
  CREATE TABLE IF NOT EXISTS project_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    text TEXT,
    attachment TEXT,
    attachment_name TEXT,
    is_edited INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL
  );

  -- ==========================================
  -- 5. AUDIT LOG
  -- ==========================================
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    peer_id TEXT, 
    action TEXT NOT NULL, 
    target_name TEXT NOT NULL, 
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (peer_id) REFERENCES peers(id) ON DELETE SET NULL
  );
`;