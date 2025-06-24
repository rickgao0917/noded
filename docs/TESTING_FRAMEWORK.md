# Testing Framework Documentation

This document provides comprehensive guidelines for testing the workspace sharing system in the Noded application.

## Overview

The testing framework is built on Jest with TypeScript support and provides utilities for testing database operations, API endpoints, and sharing functionality.

## Test Structure

```
tests/
├── services/          # Service layer tests
│   └── share-service.test.ts
├── integration/       # API integration tests
│   └── share-api.test.ts
├── e2e/              # End-to-end tests
│   └── workspace-sharing.e2e.test.ts
├── security/         # Security-focused tests
│   └── share-access-control.test.ts
├── performance/      # Performance tests
│   └── share-concurrent-access.test.ts
├── utils/            # Test utilities
│   └── test-db-helpers.ts
└── setup.ts          # Jest setup file
```

## Test Utilities

### Database Helpers

The `test-db-helpers.ts` file provides utilities for setting up test data:

```typescript
import { 
  createTestUser, 
  createTestWorkspace, 
  createTestShare,
  setupTestEnvironment,
  cleanupTestUser,
  verifyDatabaseIntegrity
} from '../utils/test-db-helpers';

// Create a test user
const user = await createTestUser(db, 'test_user', 'password123');

// Create a test workspace
const workspace = await createTestWorkspace(db, user.id, 'Test Workspace');

// Create a share between users
const share = await createTestShare(db, workspace.id, owner.id, recipient.id);

// Set up complete test environment
const testEnv = await setupTestEnvironment(db);
// Returns: { users, workspaces, shares, shareLinks }

// Clean up after tests
await cleanupTestUser(db, user.id);

// Verify database integrity
const { valid, errors } = await verifyDatabaseIntegrity(db);
```

## Writing Tests

### Unit Tests

Test individual service methods in isolation:

```typescript
describe('ShareService', () => {
  let db: DatabaseService;
  let shareService: ShareService;
  
  beforeEach(async () => {
    db = await DatabaseService.initialize(':memory:');
    await db.runMigration();
    shareService = new ShareService(db);
  });
  
  afterEach(async () => {
    await db.close();
  });
  
  test('should share workspace with user', async () => {
    const { users, workspaces } = await setupTestEnvironment(db);
    
    const share = await shareService.shareWorkspace(
      workspaces.workspace1.id,
      users.owner.id,
      users.recipient.id
    );
    
    expect(share).toMatchObject({
      workspaceId: workspaces.workspace1.id,
      sharedWithUserId: users.recipient.id,
      permissionLevel: 'view'
    });
  });
});
```

### Integration Tests

Test API endpoints with authentication:

```typescript
describe('Share API', () => {
  let app: Express;
  let testEnv: any;
  
  beforeEach(async () => {
    app = createTestApp();
    testEnv = await setupTestEnvironment(db);
  });
  
  test('POST /api/shares/:workspaceId/users', async () => {
    const response = await request(app)
      .post(`/api/shares/${testEnv.workspaces.workspace1.id}/users`)
      .set('Authorization', `Bearer ${testEnv.ownerToken}`)
      .send({ userId: testEnv.users.recipient.id });
    
    expect(response.status).toBe(201);
    expect(response.body.share).toMatchObject({
      sharedWithUserId: testEnv.users.recipient.id
    });
  });
});
```

### E2E Tests

Test complete user workflows:

```typescript
describe('Workspace Sharing E2E', () => {
  test('complete sharing workflow', async () => {
    // 1. Owner creates workspace
    const workspace = await createWorkspace(ownerSession, 'Shared Project');
    
    // 2. Owner searches for user
    const searchResults = await searchUsers(ownerSession, 'john');
    expect(searchResults).toContainEqual({ username: 'john_doe' });
    
    // 3. Owner shares workspace
    const share = await shareWorkspace(ownerSession, workspace.id, searchResults[0].id);
    
    // 4. Recipient sees shared workspace
    const sharedWorkspaces = await getSharedWithMe(recipientSession);
    expect(sharedWorkspaces).toContainEqual({
      id: workspace.id,
      name: 'Shared Project',
      ownerUsername: 'workspace_owner'
    });
    
    // 5. Recipient accesses workspace
    const workspaceData = await getWorkspace(recipientSession, workspace.id);
    expect(workspaceData.permissionLevel).toBe('view');
  });
});
```

## Test Patterns

### 1. Testing Access Control

```typescript
describe('Access Control', () => {
  test('should prevent unauthorized access', async () => {
    const { workspaces, users } = await setupTestEnvironment(db);
    
    // Non-owner cannot share
    await expect(
      shareService.shareWorkspace(
        workspaces.workspace1.id,
        users.otherUser.id,  // Not the owner
        users.recipient.id
      )
    ).rejects.toThrow('Workspace not found or you do not have permission');
  });
  
  test('should enforce read-only access', async () => {
    // Share workspace
    await shareService.shareWorkspace(
      workspace.id,
      owner.id,
      recipient.id
    );
    
    // Recipient cannot modify
    await expect(
      workspaceService.updateWorkspace(
        workspace.id,
        recipient.id,
        { name: 'Modified' }
      )
    ).rejects.toThrow('Permission denied');
  });
});
```

### 2. Testing Expiration

```typescript
describe('Share Expiration', () => {
  test('should handle expired shares', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    
    await shareService.shareWorkspace(
      workspace.id,
      owner.id,
      recipient.id,
      pastDate
    );
    
    const access = await shareService.validateShareAccess(
      workspace.id,
      recipient.id
    );
    
    expect(access).toBeNull();
  });
  
  test('should clean up expired shares', async () => {
    // Create expired share
    await createTestShare(db, workspace.id, owner.id, recipient.id, pastExpiry);
    
    // Run cleanup
    await shareService.cleanupExpiredShares();
    
    // Verify share is inactive
    const share = await db.get(
      'SELECT is_active FROM workspace_shares WHERE workspace_id = ?',
      [workspace.id]
    );
    
    expect(share.is_active).toBe(0);
  });
});
```

### 3. Testing Concurrent Access

```typescript
describe('Concurrent Access', () => {
  test('should handle simultaneous share operations', async () => {
    const promises = [];
    
    // Try to share with same user multiple times concurrently
    for (let i = 0; i < 5; i++) {
      promises.push(
        shareService.shareWorkspace(
          workspace.id,
          owner.id,
          recipient.id
        ).catch(err => err)
      );
    }
    
    const results = await Promise.all(promises);
    
    // Only one should succeed
    const successes = results.filter(r => !(r instanceof Error));
    expect(successes).toHaveLength(1);
    
    // Others should fail with duplicate error
    const errors = results.filter(r => r instanceof Error);
    expect(errors).toHaveLength(4);
    errors.forEach(err => {
      expect(err.message).toContain('already shared');
    });
  });
});
```

### 4. Testing Share Links

```typescript
describe('Share Links', () => {
  test('should create and validate share link', async () => {
    // Create link
    const link = await shareService.createShareLink(
      workspace.id,
      owner.id,
      { requiresLogin: true, expiresIn: 24 }
    );
    
    expect(link.token).toMatch(/^[a-f0-9]{64}$/);
    
    // Validate link
    const validated = await shareService.validateShareLink(link.token);
    expect(validated).toMatchObject({
      workspaceId: workspace.id,
      ownerUsername: owner.username
    });
    
    // Track access
    await shareService.incrementShareLinkAccess(link.id);
    
    const updatedLink = await db.get(
      'SELECT access_count FROM share_links WHERE id = ?',
      [link.id]
    );
    
    expect(updatedLink.access_count).toBe(1);
  });
});
```

## Mock Patterns

### Mocking Database

```typescript
import { createMockDatabase } from '../utils/test-db-helpers';

test('should handle database errors gracefully', async () => {
  const mockDb = createMockDatabase();
  mockDb.get.mockRejectedValue(new Error('Database connection failed'));
  
  const shareService = new ShareService(mockDb);
  
  await expect(
    shareService.validateShareAccess('workspace_id', 'user_id')
  ).rejects.toThrow('Database connection failed');
});
```

### Mocking External Services

```typescript
jest.mock('../../src/services/gemini-service');

test('should continue sharing when AI service is down', async () => {
  const mockGeminiService = {
    generateContent: jest.fn().mockRejectedValue(new Error('Service unavailable'))
  };
  
  // Sharing should still work even if AI features fail
  const share = await shareService.shareWorkspace(
    workspace.id,
    owner.id,
    recipient.id
  );
  
  expect(share).toBeDefined();
});
```

## Performance Testing

```typescript
describe('Performance', () => {
  test('should handle large number of shares efficiently', async () => {
    const startTime = Date.now();
    const userCount = 100;
    
    // Create many users
    const users = [];
    for (let i = 0; i < userCount; i++) {
      users.push(await createTestUser(db, `user_${i}`));
    }
    
    // Share with all users
    const sharePromises = users.map(user =>
      shareService.shareWorkspace(workspace.id, owner.id, user.id)
    );
    
    await Promise.all(sharePromises);
    
    const duration = Date.now() - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000); // 5 seconds for 100 shares
    
    // Verify all shares exist
    const shares = await shareService.getWorkspaceShares(workspace.id, owner.id);
    expect(shares).toHaveLength(userCount);
  });
});
```

## Database Migration Testing

```typescript
describe('Database Migrations', () => {
  test('should apply sharing tables migration', async () => {
    const db = await DatabaseService.initialize(':memory:');
    
    // Run migration
    await db.runMigration();
    
    // Verify tables exist
    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('workspace_shares');
    expect(tableNames).toContain('share_links');
    expect(tableNames).toContain('share_activity');
    
    // Verify indexes exist
    const indexes = await db.query(
      "SELECT name FROM sqlite_master WHERE type='index'"
    );
    
    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_workspace_shares_unique');
    expect(indexNames).toContain('idx_share_links_token');
  });
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test share-service

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run only integration tests
npm test -- --testPathPattern=integration

# Run with specific configuration
NODE_ENV=test npm test
```

## Test Coverage Goals

- Unit tests: 90%+ coverage for all services
- Integration tests: Cover all API endpoints
- E2E tests: Cover critical user workflows
- Security tests: Test all access control scenarios
- Performance tests: Validate scalability requirements

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data in `afterEach` hooks
3. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
4. **Arrange-Act-Assert**: Follow the AAA pattern in test structure
5. **Mock External Dependencies**: Mock external services to avoid flaky tests
6. **Test Edge Cases**: Include tests for error conditions and edge cases
7. **Use Test Utilities**: Leverage the provided test helpers for consistency
8. **Verify Side Effects**: Check that operations have the expected side effects

## Debugging Tests

```bash
# Run tests with debugging
node --inspect-brk ./node_modules/.bin/jest --runInBand

# Run specific test with verbose output
npm test -- --verbose share-service.test.ts

# Show test coverage gaps
npm run test:coverage -- --collectCoverageFrom="server-src/services/share-service.ts"
```

## Continuous Integration

The test suite is designed to run in CI environments:

```yaml
# Example GitHub Actions configuration
- name: Run Tests
  run: |
    npm run test:ci
    npm run test:coverage
  env:
    NODE_ENV: test
```