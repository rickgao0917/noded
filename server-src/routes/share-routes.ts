import { Router, Request, Response } from 'express';
import { ShareService } from '../services/share-service';
import { WorkspaceService } from '../services/workspace-service';
import { requireOwnership } from '../middleware/share-auth';
import { Logger } from '../utils/logger';
import { ValidationError } from '../types/errors';

interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string };
}

export function createShareRoutes(
  shareService: ShareService,
  workspaceService: WorkspaceService,
  requireAuth: (req: any, res: any, next: any) => void
): Router {
  const router = Router();
  const logger = new Logger('ShareRoutes');
  
  // All share routes require authentication
  router.use(requireAuth);

  // Search for users to share with
  router.get('/users/search', async (req: AuthenticatedRequest, res: Response) => {
    const correlationId = logger.generateCorrelationId();
    
    try {
      logger.logFunctionEntry('searchUsers', {
        query: req.query.q,
        limit: req.query.limit
      });
      
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!query || query.trim().length < 2) {
        res.status(400).json({
          error: 'Search query must be at least 2 characters'
        });
        return;
      }
      
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const users = await shareService.searchUsers(
        query,
        userId,
        limit
      );
      
      logger.logBusinessLogic('User search completed', {
        query,
        resultCount: users.length
      }, correlationId);
      
      res.json({ users });
      
    } catch (error) {
      logger.logError(error as Error, 'searchUsers', { correlationId });
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  // Share workspace with another user
  router.post('/workspaces/:workspaceId/shares',
    requireOwnership(shareService),
    async (req: AuthenticatedRequest, res: Response) => {
      const correlationId = logger.generateCorrelationId();
      
      try {
        logger.logFunctionEntry('createShare', {
          workspaceId: req.params.workspaceId,
          body: req.body
        });
        
        const { shareWithUserId, expiresAt } = req.body;
        
        if (!shareWithUserId) {
          res.status(400).json({
            error: 'shareWithUserId is required'
          });
          return;
        }
        
        // Validate expiration date if provided
        if (expiresAt) {
          const expDate = new Date(expiresAt);
          if (isNaN(expDate.getTime()) || expDate <= new Date()) {
            res.status(400).json({
              error: 'Invalid expiration date'
            });
            return;
          }
        }
        
        const userId = req.user?.id;
        if (!userId) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        
        const workspaceId = req.params.workspaceId;
        if (!workspaceId) {
          res.status(400).json({ error: 'Workspace ID required' });
          return;
        }
        
        const share = await shareService.shareWorkspace(
          workspaceId,
          userId!,
          shareWithUserId,
          expiresAt
        );
        
        // Get username for response
        const sharedWithUser = await shareService.searchUsers(
          shareWithUserId,
          userId!,
          1
        );
        
        logger.logBusinessLogic('Workspace shared', {
          workspaceId,
          shareId: share.id
        }, correlationId);
        
        res.status(201).json({
          ...share,
          sharedWithUsername: sharedWithUser[0]?.username || 'Unknown'
        });
        
      } catch (error) {
        logger.logError(error as Error, 'createShare', { correlationId });
        
        if (error instanceof ValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        
        res.status(500).json({ error: 'Failed to share workspace' });
      }
    }
  );

  // Revoke share access
  router.delete('/workspaces/:workspaceId/shares/:userId',
    requireOwnership(shareService),
    async (req: AuthenticatedRequest, res: Response) => {
      const correlationId = logger.generateCorrelationId();
      
      try {
        logger.logFunctionEntry('revokeShare', {
          workspaceId: req.params.workspaceId,
          userId: req.params.userId
        });
        
        const userId = req.user?.id;
        if (!userId) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        
        const workspaceId = req.params.workspaceId;
        if (!workspaceId) {
          res.status(400).json({ error: 'Workspace ID required' });
          return;
        }
        
        const revokeUserId = req.params.userId;
        if (!revokeUserId) {
          res.status(400).json({ error: 'User ID required' });
          return;
        }
        
        const success = await shareService.revokeShare(
          workspaceId,
          userId!,
          revokeUserId
        );
        
        if (!success) {
          res.status(404).json({ error: 'Share not found' });
          return;
        }
        
        logger.logBusinessLogic('Share revoked', {
          workspaceId,
          revokedUserId: revokeUserId
        }, correlationId);
        
        res.status(204).send();
        
      } catch (error) {
        logger.logError(error as Error, 'revokeShare', { correlationId });
        res.status(500).json({ error: 'Failed to revoke share' });
      }
    }
  );

  // List all shares for a workspace
  router.get('/workspaces/:workspaceId/shares',
    requireOwnership(shareService),
    async (req: AuthenticatedRequest, res: Response) => {
      const correlationId = logger.generateCorrelationId();
      
      try {
        logger.logFunctionEntry('listShares', {
          workspaceId: req.params.workspaceId
        });
        
        const userId = req.user?.id;
        if (!userId) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        
        const workspaceId = req.params.workspaceId;
        if (!workspaceId) {
          res.status(400).json({ error: 'Workspace ID required' });
          return;
        }
        
        const shares = await shareService.getMyShares(
          userId!,
          workspaceId
        );
        
        logger.logBusinessLogic('Shares retrieved', {
          workspaceId,
          count: shares.length
        }, correlationId);
        
        res.json({ shares });
        
      } catch (error) {
        logger.logError(error as Error, 'listShares', { correlationId });
        res.status(500).json({ error: 'Failed to retrieve shares' });
      }
    }
  );

  // List workspaces shared with current user
  router.get('/shared-with-me', async (req: AuthenticatedRequest, res: Response) => {
    const correlationId = logger.generateCorrelationId();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      logger.logFunctionEntry('getSharedWithMe', {
        userId
      });
      
      const workspaces = await shareService.getSharedWithMe(userId!);
      
      logger.logBusinessLogic('Shared workspaces retrieved', {
        userId,
        count: workspaces.length
      }, correlationId);
      
      res.json({ workspaces });
      
    } catch (error) {
      logger.logError(error as Error, 'getSharedWithMe', { correlationId });
      res.status(500).json({ error: 'Failed to retrieve shared workspaces' });
    }
  });

  // Generate shareable link
  router.post('/workspaces/:workspaceId/share-link',
    requireOwnership(shareService),
    async (req: AuthenticatedRequest, res: Response) => {
      const correlationId = logger.generateCorrelationId();
      
      try {
        logger.logFunctionEntry('createShareLink', {
          workspaceId: req.params.workspaceId,
          options: req.body
        });
        
        const { requiresLogin = true, expiresIn } = req.body;
        
        const userId = req.user?.id;
        if (!userId) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        
        const workspaceId = req.params.workspaceId;
        if (!workspaceId) {
          res.status(400).json({ error: 'Workspace ID required' });
          return;
        }
        
        const shareLink = await shareService.createShareLink(
          workspaceId,
          userId!,
          { requiresLogin, expiresIn }
        );
        
        // Construct full URL
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const fullLink = `${baseUrl}/shared/${shareLink.token}`;
        
        logger.logBusinessLogic('Share link created', {
          workspaceId,
          linkId: shareLink.id
        }, correlationId);
        
        res.status(201).json({
          ...shareLink,
          link: fullLink
        });
        
      } catch (error) {
        logger.logError(error as Error, 'createShareLink', { correlationId });
        res.status(500).json({ error: 'Failed to create share link' });
      }
    }
  );

  // Access workspace via share link
  router.get('/shared/:token', async (req: Request, res: Response) => {
    const correlationId = logger.generateCorrelationId();
    
    try {
      logger.logFunctionEntry('accessShareLink', {
        token: req.params.token,
        authenticated: !!(req as any).user
      });
      
      const token = req.params.token;
      if (!token) {
        res.status(400).json({ error: 'Share token required' });
        return;
      }
      
      const shareLink = await shareService.validateShareLink(token);
      
      if (!shareLink) {
        res.status(404).json({ error: 'Invalid or expired share link' });
        return;
      }
      
      // Check if login is required
      if (shareLink.requiresLogin && !(req as any).user) {
        res.status(401).json({ 
          error: 'Authentication required',
          requiresLogin: true 
        });
        return;
      }
      
      // Get workspace data - We need to check the workspace service method signature
      const workspace = await workspaceService.getWorkspaceById(shareLink.workspaceId);
      
      if (!workspace) {
        res.status(404).json({ error: 'Workspace not found' });
        return;
      }
      
      // Log access
      await shareService.logShareActivity(
        shareLink.workspaceId,
        (req as any).user?.id || null,
        'viewed',
        { shareType: 'link_share', token: req.params.token }
      );
      
      // Increment access count
      await shareService.incrementShareLinkAccess(shareLink.id);
      
      logger.logBusinessLogic('Share link accessed', {
        workspaceId: shareLink.workspaceId,
        authenticated: !!(req as any).user
      }, correlationId);
      
      res.json({
        workspace: {
          ...workspace,
          isReadOnly: true,
          shareInfo: {
            type: 'link',
            owner: shareLink.ownerUsername
          }
        }
      });
      
    } catch (error) {
      logger.logError(error as Error, 'accessShareLink', { correlationId });
      res.status(500).json({ error: 'Failed to access shared workspace' });
    }
  });

  return router;
}