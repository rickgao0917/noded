# Noded - Graph-based Node Editor (Docker-Only Development)

A TypeScript-based interactive node editor that creates tree structures of conversation nodes with real-time collaboration, authentication, and AI integration.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd noded

# Copy configuration template
cp config/config.example.js config/config.js
# Edit config/config.js and add your Gemini API key

# Start development environment with hot-reloading
./docker-scripts.sh dev

# Open browser to http://localhost:8000
```

## 📋 Prerequisites

- **Docker** (with Docker Compose)
- **Git**
- **Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/apikey))

**Note**: Node.js and npm are NOT required locally - everything runs in containers.

## 🐳 Docker-Only Development

This project exclusively uses Docker for all development operations. All npm commands have been replaced with Docker equivalents.

### Development Commands

```bash
# Start development environment (hot-reloading)
./docker-scripts.sh dev

# Build development environment
./docker-scripts.sh dev-build

# View development logs
./docker-scripts.sh dev-logs

# Stop development environment
./docker-scripts.sh dev-stop

# Restart development environment
./docker-scripts.sh dev-restart
```

### Production Commands

```bash
# Start production server
./docker-scripts.sh prod

# Build production environment
./docker-scripts.sh prod-build

# View production logs
./docker-scripts.sh prod-logs

# Stop production server
./docker-scripts.sh prod-stop
```

### Testing Commands

```bash
# Run test suite
./docker-scripts.sh test

# Run tests with coverage
./docker-scripts.sh test-coverage

# Run tests in watch mode
./docker-scripts.sh test-watch
```

### Utility Commands

```bash
# Clear database (removes all users/workspaces)
./docker-scripts.sh clear-db

# Clean up Docker resources
./docker-scripts.sh clean

# View container status
./docker-scripts.sh status

# View all logs
./docker-scripts.sh logs

# Open shell in container
./docker-scripts.sh shell

# Show help
./docker-scripts.sh help
```

## 🏗️ Architecture

### Multi-Stage Docker Build

- **Development**: Hot-reloading with nodemon, file watchers, volume mounts
- **Production**: Optimized build with security hardening and health checks
- **Testing**: Isolated environment with coverage reporting
- **Database**: Dedicated container for database operations

### Docker Compose Profiles

- `dev`: Development environment with hot-reloading
- `prod`: Production environment with optimizations
- `test`: Testing environment with coverage
- `db`: Database management operations

### Hot-Reloading Features

- **TypeScript Compilation**: Automatic rebuild on source changes
- **Server Restart**: Nodemon watches server files and restarts automatically
- **File Watchers**: Concurrent processes for client and server code
- **Volume Mounts**: Source code mounted for real-time updates

## 🔧 Configuration

### API Setup

1. Copy the example configuration:
   ```bash
   cp config/config.example.js config/config.js
   ```

2. Edit `config/config.js` and add your Gemini API key:
   ```javascript
   window.NODE_EDITOR_CONFIG = {
     GEMINI_API_KEY: 'your-actual-api-key-here',
     // ... other config
   };
   ```

3. Get your API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Environment Variables

Set these in your shell or Docker Compose environment:

```bash
NODE_ENV=development          # or production
CHOKIDAR_USEPOLLING=true     # for file watching in containers
WATCHPACK_POLLING=true       # for webpack-style watching
DEBUG=*                      # enable debug logging
```

## 📊 Features

### Core Features

- **Interactive Node Editor**: Drag-and-drop nodes with connection visualization
- **User Authentication**: Complete login/register system with SQLite database
- **Multi-Workspace Support**: Create and manage multiple workspaces per user
- **Real-time AI Integration**: Streaming responses from Gemini 2.0 Flash API
- **Version Control**: Branch nodes for different conversation paths
- **Hot-reloading Development**: Instant updates without manual rebuilds

### Advanced Features

- **Chat Interface**: Double-click nodes to open conversation panel
- **Auto-layout**: Intelligent node positioning with collision detection
- **Markdown Support**: Full markdown rendering with syntax highlighting
- **Canvas Controls**: Zoom, pan, and reset functionality
- **Database Management**: SQLite with automatic migrations and cleanup

## 🔍 Development Workflow

1. **Start Development**: `./docker-scripts.sh dev`
2. **Make Changes**: Edit TypeScript files in `src/` or `server-src/`
3. **Automatic Rebuild**: Watch for file changes and rebuild automatically
4. **View Changes**: Refresh browser to see updates
5. **Test Changes**: `./docker-scripts.sh test`
6. **Debug Issues**: `./docker-scripts.sh logs` or `./docker-scripts.sh shell`

### File Structure

```
src/                    # Client-side TypeScript
server-src/            # Server-side TypeScript
tests/                 # Test files
config/                # Configuration files
data/                  # SQLite database
dist/                  # Built client code (generated)
dist-server/           # Built server code (generated)
```

## 🧪 Testing

### Test Coverage

- **Target**: 80% global coverage, 100% for utility functions
- **Framework**: Jest with JSDOM for DOM testing
- **Reports**: HTML, LCOV, and JSON coverage reports
- **Integration**: API endpoint testing with authentication

### Test Commands

```bash
# Run all tests
./docker-scripts.sh test

# Run with coverage
./docker-scripts.sh test-coverage

# Watch mode for development
./docker-scripts.sh test-watch
```

## 🐛 Troubleshooting

### Common Issues

**Container won't start**:
```bash
# Check Docker is running
docker info

# Check container status
./docker-scripts.sh status

# View logs for errors
./docker-scripts.sh logs
```

**Database issues**:
```bash
# Clear database completely
./docker-scripts.sh clear-db

# Restart with fresh environment
./docker-scripts.sh dev-restart
```

**Performance issues**:
```bash
# Clean up Docker resources
./docker-scripts.sh clean

# Check resource usage
docker system df
```

**API key issues**:
- Edit `config/config.js` and verify your Gemini API key
- Check browser console for authentication errors
- Ensure config file is not empty or malformed

### Debug Commands

```bash
# Open shell in container
./docker-scripts.sh shell

# Check file structure
ls -la /app

# View environment variables
env | grep NODE

# Check database
ls -la data/noded.db
```

## 🔒 Security

- **Non-root User**: Production containers run as non-root user
- **Read-only Mounts**: Configuration files mounted read-only
- **Health Checks**: Automatic container health monitoring
- **API Key Security**: Configuration files excluded from version control

## 📈 Performance

- **Multi-stage Build**: Optimized production images
- **Layer Caching**: Efficient Docker layer caching
- **Volume Optimization**: Named volumes for persistent data
- **Resource Limits**: Configurable resource constraints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes using Docker development environment
4. Run tests: `./docker-scripts.sh test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: See `CLAUDE.md` for comprehensive technical documentation
- **API Setup**: See `docs/API_SETUP.md` for detailed API configuration
- **Debug Config**: See `docs/DEBUG_CONFIG.md` for debug configuration options

---

**Note**: This project has been fully containerized. All development should be done through Docker containers. Local Node.js/npm installation is not required or supported.