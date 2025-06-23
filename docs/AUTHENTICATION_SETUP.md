# Authentication and Persistence Setup

This document describes the authentication and persistence features added to the Node Editor.

## Overview

The application now includes:
- User authentication (login/register)
- Persistent storage of graph data per user
- Auto-save functionality (every 5 seconds)
- SQLite database for data storage

## Running the Application

### Option 1: With Authentication (Express Server)

```bash
# Install dependencies
npm install

# Build and start the server
npm run server

# Access the application at http://localhost:8000
```

### Option 2: Without Authentication (Simple HTTP Server)

```bash
# Build the client
npm run build

# Start Python HTTP server
npm run serve

# Access standalone.html directly
```

## Authentication Flow

1. **First Visit**: Users see a login modal
2. **Registration**: New users can register with username/password
3. **Login**: Existing users log in with credentials
4. **Session Management**: Sessions persist across browser refreshes
5. **Auto-save**: Graph changes are automatically saved every 5 seconds

## Database

- **Location**: `data/noded.db` (SQLite)
- **Tables**:
  - `users`: User accounts
  - `user_sessions`: Active sessions
  - `user_files`: Saved graph data

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login to existing account
- `POST /api/auth/logout` - End session
- `GET /api/auth/session` - Validate current session

### User Data
- `GET /api/files` - List user's files
- `POST /api/files` - Save/update file
- `GET /api/files/:fileName` - Load specific file
- `GET /api/files/default/get-or-create` - Get or create default file

## Security Features

- Password hashing with PBKDF2
- Session tokens with 24-hour expiration
- CORS enabled for API endpoints
- Input validation and sanitization

## File Structure

```
src/
├── components/
│   └── login-component.ts    # Login modal UI
├── services/
│   ├── auth-api-client.ts    # Client-side auth API
│   └── session-manager.ts    # Session management
└── types/
    └── auth.types.ts         # Authentication types

server-src/
└── services/
    ├── authentication-service.ts  # Auth logic
    ├── database-service.ts        # SQLite integration
    └── user-data-service.ts       # Data persistence

server.js                     # Express server
```

## Development Notes

- Frontend and backend TypeScript are compiled separately
- Server-side code uses CommonJS modules
- Client-side code uses ES6 modules
- Database is git-ignored (`data/` directory)