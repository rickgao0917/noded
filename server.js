const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { DatabaseService } = require('./dist-server/services/database-service');
const { AuthenticationService } = require('./dist-server/services/authentication-service');
const { WorkspaceService } = require('./dist-server/services/workspace-service');
const { UserDiscoveryService } = require('./dist-server/services/user-discovery-service');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
app.use(express.static('.'));
app.use('/dist', express.static(path.join(__dirname, 'dist')));
app.use('/config', express.static(path.join(__dirname, 'config')));

// Initialize services
let authService;
let workspaceService;
let userDiscoveryService;
let dbService;

async function initializeServices() {
  try {
    dbService = DatabaseService.getInstance();
    await dbService.initialize();
    
    authService = AuthenticationService.getInstance();
    workspaceService = WorkspaceService.getInstance();
    userDiscoveryService = UserDiscoveryService.getInstance();
    
    console.log('Services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Authentication middleware
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.slice(7);
  
  try {
    const session = await authService.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    req.user = session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// === Authentication Endpoints ===

// Register
app.post('/api/auth/register', async (req, res) => {
  console.log('Registration attempt:', { username: req.body.username });
  try {
    const result = await authService.register(req.body);
    res.json(result);
  } catch (error) {
    console.error('Registration error:', error.message, error.stack);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  console.log('Login attempt:', { username: req.body.username });
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(400).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    await authService.logout(req.user.sessionToken);
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Validate session
app.get('/api/auth/session', requireAuth, async (req, res) => {
  res.json({ session: req.user });
});

// === Workspace Endpoints ===

// List workspaces
app.get('/api/workspaces', requireAuth, async (req, res) => {
  try {
    const workspaces = await workspaceService.listWorkspaces(req.user.userId);
    res.json(workspaces);
  } catch (error) {
    console.error('List workspaces error:', error);
    res.status(500).json({ error: 'Failed to list workspaces' });
  }
});

// Create workspace
app.post('/api/workspaces', requireAuth, async (req, res) => {
  try {
    const workspace = await workspaceService.createWorkspace(req.user.userId, req.body);
    res.json(workspace);
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get workspace
app.get('/api/workspaces/:workspaceId', requireAuth, async (req, res) => {
  try {
    const workspace = await workspaceService.getWorkspace(req.user.userId, req.params.workspaceId);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    res.json(workspace);
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Failed to get workspace' });
  }
});

// Update workspace
app.put('/api/workspaces/:workspaceId', requireAuth, async (req, res) => {
  try {
    const workspace = await workspaceService.updateWorkspace(
      req.user.userId,
      req.params.workspaceId,
      req.body
    );
    res.json(workspace);
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete workspace
app.delete('/api/workspaces/:workspaceId', requireAuth, async (req, res) => {
  try {
    await workspaceService.deleteWorkspace(req.user.userId, req.params.workspaceId);
    res.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get or create default workspace
app.get('/api/workspaces/default/get-or-create', requireAuth, async (req, res) => {
  try {
    const workspace = await workspaceService.getOrCreateDefaultWorkspace(req.user.userId);
    res.json(workspace);
  } catch (error) {
    console.error('Get default workspace error:', error);
    res.status(500).json({ error: 'Failed to get default workspace' });
  }
});

// === User Discovery Endpoints ===

// Search for users
app.get('/api/discovery/users/search', requireAuth, async (req, res) => {
  try {
    const { q: query, limit = 10, offset = 0 } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const result = await userDiscoveryService.searchUsers(
      query,
      req.user.userId,
      parseInt(limit.toString()),
      parseInt(offset.toString())
    );
    
    res.json(result);
  } catch (error) {
    console.error('User search error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get user's public workspaces
app.get('/api/discovery/users/:userId/workspaces', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const workspaces = await userDiscoveryService.getUserWorkspaces(
      userId,
      req.user.userId
    );
    
    res.json(workspaces);
  } catch (error) {
    console.error('Get user workspaces error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get user statistics
app.get('/api/discovery/statistics', requireAuth, async (req, res) => {
  try {
    const stats = await userDiscoveryService.getUserStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});


// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  // Cleanup expired sessions periodically
  setInterval(async () => {
    try {
      await dbService.cleanupExpiredSessions();
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }, 3600000); // Every hour
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  try {
    if (dbService) {
      await dbService.close();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});