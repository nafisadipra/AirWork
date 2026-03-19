export const INITIAL_SCHEMA = `
  -- ==========================================
  -- 1. PEERS & IDENTITY
  -- ==========================================
  CREATE TABLE IF NOT EXISTS peers (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT, -- <--- ADDED THIS LINE
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
    -- If the creator deletes their account, the project stays, but creator becomes NULL
    FOREIGN KEY (created_by) REFERENCES peers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT,
    peer_id TEXT,
    role TEXT NOT NULL DEFAULT 'editor', 
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, peer_id),
    -- CASCADE: If a project is deleted, or a user is deleted, instantly destroy this membership link
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
    assigned_to TEXT, 
    position INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    -- SET NULL: If a user leaves, their tasks remain on the board but become unassigned
    FOREIGN KEY (assigned_to) REFERENCES peers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL, 
    yjs_state BLOB,
    last_edited_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (last_edited_by) REFERENCES peers(id) ON DELETE SET NULL
  );

  -- ==========================================
  -- 4. FEEDBACK & CHAT ROOMS
  -- ==========================================
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    sender_id TEXT,
    content TEXT NOT NULL,
    attached_file_hash TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    -- SET NULL: Keeps the chat history intact even if the sender deletes their account
    FOREIGN KEY (sender_id) REFERENCES peers(id) ON DELETE SET NULL
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