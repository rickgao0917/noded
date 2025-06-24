# Workspace Sharing API Documentation

## Authentication

All sharing endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <session_token>
```

## Endpoints

### Search Users

Search for users to share workspaces with.

**Endpoint:** `GET /api/shares/users/search`

**Query Parameters:**
- `q` (required): Search query (minimum 2 characters)
- `limit` (optional): Maximum number of results (default: 10)

**Response:**
```json
{
  "users": [
    {
      "id": "user_123",
      "username": "john_doe"
    }
  ]
}
```

### Share Workspace

Share a workspace with another user.

**Endpoint:** `POST /api/shares/workspaces/:workspaceId/shares`

**Requirements:** Must be workspace owner

**Request Body:**
```json
{
  "shareWithUserId": "user_456",
  "expiresAt": "2025-12-31T23:59:59Z" // Optional
}
```

**Response:**
```json
{
  "id": "share_789",
  "workspaceId": "workspace_123",
  "ownerId": "user_123",
  "sharedWithUserId": "user_456",
  "sharedWithUsername": "jane_doe",
  "permissionLevel": "view",
  "createdAt": "2025-06-23T10:00:00Z",
  "expiresAt": null,
  "isActive": true
}
```

### Revoke Share

Remove a user's access to a shared workspace.

**Endpoint:** `DELETE /api/shares/workspaces/:workspaceId/shares/:userId`

**Requirements:** Must be workspace owner

**Response:** 204 No Content

### List Workspace Shares

Get all active shares for a workspace.

**Endpoint:** `GET /api/shares/workspaces/:workspaceId/shares`

**Requirements:** Must be workspace owner

**Response:**
```json
{
  "shares": [
    {
      "id": "share_789",
      "workspaceId": "workspace_123",
      "ownerId": "user_123",
      "sharedWithUserId": "user_456",
      "sharedWithUsername": "jane_doe",
      "permissionLevel": "view",
      "createdAt": "2025-06-23T10:00:00Z",
      "expiresAt": null,
      "lastAccessed": "2025-06-23T11:00:00Z",
      "isActive": true
    }
  ]
}
```

### List Shared With Me

Get all workspaces shared with the current user.

**Endpoint:** `GET /api/shares/shared-with-me`

**Response:**
```json
{
  "workspaces": [
    {
      "id": "workspace_789",
      "name": "Project Planning",
      "ownerId": "user_123",
      "ownerUsername": "john_doe",
      "sharedAt": "2025-06-23T10:00:00Z",
      "lastAccessed": "2025-06-23T11:00:00Z",
      "expiresAt": null
    }
  ]
}
```

### Create Share Link

Generate a shareable link for a workspace.

**Endpoint:** `POST /api/shares/workspaces/:workspaceId/share-link`

**Requirements:** Must be workspace owner

**Request Body:**
```json
{
  "requiresLogin": true,  // Default: true
  "expiresIn": 168       // Hours until expiration (optional)
}
```

**Response:**
```json
{
  "id": "link_123",
  "workspaceId": "workspace_123",
  "ownerId": "user_123",
  "token": "abc123def456",
  "requiresLogin": true,
  "createdAt": "2025-06-23T10:00:00Z",
  "expiresAt": "2025-06-30T10:00:00Z",
  "accessCount": 0,
  "isActive": true,
  "link": "https://app.noded.com/shared/abc123def456"
}
```

### Access Share Link

Access a workspace via share link.

**Endpoint:** `GET /api/shares/shared/:token`

**Authentication:** Optional (depends on link settings)

**Response:**
```json
{
  "workspace": {
    "id": "workspace_123",
    "name": "My Workspace",
    "graphData": "...",
    "canvasState": "...",
    "createdAt": "2025-06-23T10:00:00Z",
    "updatedAt": "2025-06-23T11:00:00Z",
    "isReadOnly": true,
    "shareInfo": {
      "type": "link",
      "owner": "john_doe"
    }
  }
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `400 Bad Request`: Invalid input or validation error
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied (e.g., not workspace owner)
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "error": "Human-readable error message"
}
```

## Rate Limiting

API endpoints are subject to rate limiting:
- User search: 30 requests per minute
- Share operations: 60 requests per minute
- Share link access: 100 requests per minute

## Security Considerations

1. **Authentication**: All endpoints except public share links require valid session tokens
2. **Authorization**: Only workspace owners can share their workspaces
3. **Expiration**: Shares can have optional expiration dates
4. **Activity Logging**: All share operations are logged for audit purposes
5. **Token Security**: Share link tokens are cryptographically secure random strings