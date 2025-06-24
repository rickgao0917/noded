import puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';

describe('Workspace Sharing E2E Tests', () => {
  let browser: Browser;
  let ownerPage: Page;
  let sharerPage: Page;
  const baseUrl = process.env.TEST_URL || 'http://localhost:8000';
  
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    ownerPage = await browser.newPage();
    sharerPage = await browser.newPage();
  });
  
  afterEach(async () => {
    await ownerPage.close();
    await sharerPage.close();
  });
  
  describe('Direct Share Workflow', () => {
    test('should create and share workspace directly with another user', async () => {
      // Owner login
      await ownerPage.goto(baseUrl);
      await ownerPage.waitForSelector('#loginForm');
      
      // Fill login form
      await ownerPage.type('#username', 'testowner');
      await ownerPage.type('#password', 'password123');
      await ownerPage.click('#loginSubmit');
      
      // Wait for workspace to load
      await ownerPage.waitForSelector('.workspace-container', { timeout: 5000 });
      
      // Create a new workspace
      await ownerPage.click('#createWorkspace');
      await ownerPage.waitForSelector('.workspace-name-input');
      await ownerPage.type('.workspace-name-input', 'Shared Test Workspace');
      await ownerPage.keyboard.press('Enter');
      
      // Add some content
      await ownerPage.waitForSelector('#addRootNodeBtn');
      await ownerPage.click('#addRootNodeBtn');
      await ownerPage.waitForSelector('.graph-node');
      
      // Open share dialog
      await ownerPage.click('#shareWorkspaceBtn');
      await ownerPage.waitForSelector('.share-dialog');
      
      // Share directly with another user
      await ownerPage.type('#shareUsername', 'testsharer');
      await ownerPage.click('#shareDirectBtn');
      
      // Wait for share confirmation
      await ownerPage.waitForSelector('.share-success-message');
      
      // Now login as the share recipient
      await sharerPage.goto(baseUrl);
      await sharerPage.waitForSelector('#loginForm');
      
      await sharerPage.type('#username', 'testsharer');
      await sharerPage.type('#password', 'password123');
      await sharerPage.click('#loginSubmit');
      
      // Check for shared workspace indicator
      await sharerPage.waitForSelector('.shared-workspaces-section');
      const sharedWorkspace = await sharerPage.$('.shared-workspace-item');
      expect(sharedWorkspace).toBeTruthy();
      
      // Click on shared workspace
      await sharerPage.click('.shared-workspace-item');
      
      // Verify read-only mode
      await sharerPage.waitForSelector('.read-only-indicator');
      const readOnlyIndicator = await sharerPage.$('.read-only-indicator');
      expect(readOnlyIndicator).toBeTruthy();
      
      // Verify owner info is displayed
      const ownerInfo = await sharerPage.$eval('.shared-workspace-indicator', el => el.textContent);
      expect(ownerInfo).toContain('testowner');
      
      // Verify editing is disabled
      const addNodeBtn = await sharerPage.$('#addRootNodeBtn');
      const isDisabled = await sharerPage.evaluate(btn => {
        return btn ? window.getComputedStyle(btn).display === 'none' : true;
      }, addNodeBtn);
      expect(isDisabled).toBe(true);
    });
    
    test('should handle concurrent access to shared workspace', async () => {
      // Both users access the same shared workspace
      const sharedWorkspaceUrl = `${baseUrl}?share=test-shared-id`;
      
      // Load workspace in both browsers
      await Promise.all([
        ownerPage.goto(sharedWorkspaceUrl),
        sharerPage.goto(sharedWorkspaceUrl)
      ]);
      
      // Wait for both to load
      await Promise.all([
        ownerPage.waitForSelector('.workspace-container'),
        sharerPage.waitForSelector('.workspace-container')
      ]);
      
      // Owner makes changes
      await ownerPage.click('#addRootNodeBtn');
      await ownerPage.waitForSelector('.graph-node');
      
      // Wait a moment for potential sync
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sharer should see read-only indicator
      const sharerReadOnly = await sharerPage.$('.read-only-indicator');
      expect(sharerReadOnly).toBeTruthy();
    });
  });
  
  describe('Link Share Workflow', () => {
    test('should create shareable link and access via URL', async () => {
      // Owner creates workspace and gets share link
      await ownerPage.goto(baseUrl);
      await ownerPage.waitForSelector('#loginForm');
      
      await ownerPage.type('#username', 'testowner');
      await ownerPage.type('#password', 'password123');
      await ownerPage.click('#loginSubmit');
      
      await ownerPage.waitForSelector('.workspace-container');
      
      // Open share dialog
      await ownerPage.click('#shareWorkspaceBtn');
      await ownerPage.waitForSelector('.share-dialog');
      
      // Create shareable link
      await ownerPage.click('#createShareLinkBtn');
      await ownerPage.waitForSelector('.share-link-display');
      
      // Get the share link
      const shareLink = await ownerPage.$eval('.share-link-input', (input: HTMLInputElement) => input.value);
      expect(shareLink).toContain('/share/');
      
      // Access via share link (no login required)
      await sharerPage.goto(shareLink);
      
      // Should see workspace in read-only mode
      await sharerPage.waitForSelector('.read-only-indicator');
      const indicator = await sharerPage.$eval('.shared-workspace-indicator', el => el.textContent);
      expect(indicator).toContain('Shared via link');
    });
    
    test('should copy share link to clipboard', async () => {
      await ownerPage.goto(baseUrl);
      
      // Mock clipboard API
      await ownerPage.evaluateOnNewDocument(() => {
        let clipboardText = '';
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: async (text: string) => {
              clipboardText = text;
              return Promise.resolve();
            },
            readText: async () => {
              return Promise.resolve(clipboardText);
            }
          },
          writable: false
        });
      });
      
      // Login and create share link
      await ownerPage.waitForSelector('#loginForm');
      await ownerPage.type('#username', 'testowner');
      await ownerPage.type('#password', 'password123');
      await ownerPage.click('#loginSubmit');
      
      await ownerPage.waitForSelector('.workspace-container');
      await ownerPage.click('#shareWorkspaceBtn');
      await ownerPage.waitForSelector('.share-dialog');
      await ownerPage.click('#createShareLinkBtn');
      
      // Click copy button
      await ownerPage.waitForSelector('.copy-link-btn');
      await ownerPage.click('.copy-link-btn');
      
      // Verify clipboard content
      const clipboardContent = await ownerPage.evaluate(() => navigator.clipboard.readText());
      expect(clipboardContent).toContain('/share/');
    });
  });
  
  describe('Read-Only Mode Enforcement', () => {
    test('should prevent all editing operations in shared workspace', async () => {
      const sharedUrl = `${baseUrl}?share=read-only-test`;
      await sharerPage.goto(sharedUrl);
      await sharerPage.waitForSelector('.workspace-container');
      
      // Try to add a node (should fail)
      const addNodeBtn = await sharerPage.$('#addRootNodeBtn');
      const isHidden = await sharerPage.evaluate(btn => {
        return btn ? window.getComputedStyle(btn).display === 'none' : true;
      }, addNodeBtn);
      expect(isHidden).toBe(true);
      
      // Try to drag a node (should fail)
      const node = await sharerPage.$('.graph-node');
      if (node) {
        const box = await node.boundingBox();
        if (box) {
          await sharerPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await sharerPage.mouse.down();
          await sharerPage.mouse.move(box.x + 100, box.y + 100);
          await sharerPage.mouse.up();
          
          // Verify node didn't move
          const newBox = await node.boundingBox();
          expect(newBox?.x).toBe(box.x);
          expect(newBox?.y).toBe(box.y);
        }
      }
      
      // Try to edit text (should fail)
      const textarea = await sharerPage.$('textarea');
      if (textarea) {
        const isReadOnly = await sharerPage.evaluate(ta => {
          const element = ta as HTMLTextAreaElement;
          return window.getComputedStyle(element).pointerEvents === 'none';
        }, textarea);
        expect(isReadOnly).toBe(true);
      }
    });
  });
  
  describe('Share Management UI', () => {
    test('should display share management dialog with all features', async () => {
      await ownerPage.goto(baseUrl);
      await ownerPage.waitForSelector('#loginForm');
      
      await ownerPage.type('#username', 'testowner');
      await ownerPage.type('#password', 'password123');
      await ownerPage.click('#loginSubmit');
      
      await ownerPage.waitForSelector('.workspace-container');
      await ownerPage.click('#shareWorkspaceBtn');
      
      // Check all UI elements are present
      const dialog = await ownerPage.waitForSelector('.share-dialog');
      expect(dialog).toBeTruthy();
      
      const directShareSection = await ownerPage.$('.direct-share-section');
      expect(directShareSection).toBeTruthy();
      
      const linkShareSection = await ownerPage.$('.link-share-section');
      expect(linkShareSection).toBeTruthy();
      
      const activeSharesList = await ownerPage.$('.active-shares-list');
      expect(activeSharesList).toBeTruthy();
    });
    
    test('should revoke share access', async () => {
      await ownerPage.goto(baseUrl);
      await ownerPage.waitForSelector('#loginForm');
      
      await ownerPage.type('#username', 'testowner');
      await ownerPage.type('#password', 'password123');
      await ownerPage.click('#loginSubmit');
      
      await ownerPage.waitForSelector('.workspace-container');
      
      // Create a share first
      await ownerPage.click('#shareWorkspaceBtn');
      await ownerPage.waitForSelector('.share-dialog');
      await ownerPage.type('#shareUsername', 'testuser');
      await ownerPage.click('#shareDirectBtn');
      
      // Wait for share to appear in list
      await ownerPage.waitForSelector('.share-item');
      
      // Revoke the share
      await ownerPage.click('.revoke-share-btn');
      
      // Confirm revocation
      await ownerPage.waitForSelector('.confirm-dialog');
      await ownerPage.click('.confirm-revoke-btn');
      
      // Verify share is removed
      await ownerPage.waitForFunction(() => {
        return document.querySelectorAll('.share-item').length === 0;
      });
    });
  });
  
  describe('Error Handling', () => {
    test('should show error when sharing with non-existent user', async () => {
      await ownerPage.goto(baseUrl);
      await ownerPage.waitForSelector('#loginForm');
      
      await ownerPage.type('#username', 'testowner');
      await ownerPage.type('#password', 'password123');
      await ownerPage.click('#loginSubmit');
      
      await ownerPage.waitForSelector('.workspace-container');
      await ownerPage.click('#shareWorkspaceBtn');
      await ownerPage.waitForSelector('.share-dialog');
      
      // Try to share with non-existent user
      await ownerPage.type('#shareUsername', 'nonexistentuser123');
      await ownerPage.click('#shareDirectBtn');
      
      // Should show error message
      await ownerPage.waitForSelector('.error-message');
      const errorText = await ownerPage.$eval('.error-message', el => el.textContent);
      expect(errorText).toContain('User not found');
    });
    
    test('should handle expired share links gracefully', async () => {
      const expiredShareUrl = `${baseUrl}?share=expired-share-id`;
      await sharerPage.goto(expiredShareUrl);
      
      // Should show appropriate error
      await sharerPage.waitForSelector('.share-error-page');
      const errorMessage = await sharerPage.$eval('.error-message', el => el.textContent);
      expect(errorMessage).toContain('This share link is no longer valid');
    });
  });
});