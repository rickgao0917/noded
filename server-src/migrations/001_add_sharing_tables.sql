-- Create workspace_shares table
CREATE TABLE IF NOT EXISTS workspace_shares (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  shared_with_user_id TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'view',
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_accessed TEXT,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (shared_with_user_id) REFERENCES users(id),
  CHECK (permission_level IN ('view'))
);

-- Create unique index for workspace-user pairs
CREATE UNIQUE INDEX idx_workspace_shares_unique 
ON workspace_shares(workspace_id, shared_with_user_id) 
WHERE is_active = 1;

-- Create indexes for queries
CREATE INDEX idx_workspace_shares_shared_with ON workspace_shares(shared_with_user_id);
CREATE INDEX idx_workspace_shares_owner ON workspace_shares(owner_id);
CREATE INDEX idx_workspace_shares_workspace ON workspace_shares(workspace_id);

-- Create share_links table
CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  requires_login INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  access_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Create index for token lookups
CREATE UNIQUE INDEX idx_share_links_token ON share_links(share_token);
CREATE INDEX idx_share_links_workspace ON share_links(workspace_id);

-- Create share_activity table
CREATE TABLE IF NOT EXISTS share_activity (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  share_type TEXT NOT NULL CHECK (share_type IN ('direct_share', 'link_share')),
  action TEXT NOT NULL CHECK (action IN ('viewed', 'exported', 'link_created', 'share_granted', 'share_revoked')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

-- Create indexes for activity queries
CREATE INDEX idx_share_activity_workspace ON share_activity(workspace_id, created_at);
CREATE INDEX idx_share_activity_user ON share_activity(user_id);

-- Add sharing columns to workspaces table
ALTER TABLE workspaces ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN share_settings TEXT;