import { Request, Response, NextFunction } from 'express';
import { ShareService } from '../services/share-service';
import { Logger } from '../utils/logger';

interface ShareAuthRequest extends Request {
  shareAccess?: 'owner' | 'view';
  workspaceId?: string;
  user?: { id: string; username: string };
}

export function requireShareAccess(shareService: ShareService) {
  const logger = new Logger('ShareAuthMiddleware');
  
  return async (req: ShareAuthRequest, res: Response, next: NextFunction) => {
    const correlationId = logger.generateCorrelationId();
    
    try {
      logger.logFunctionEntry('requireShareAccess', {
        method: req.method,
        path: req.path,
        workspaceId: req.params.workspaceId
      });
      
      const workspaceId = req.params.workspaceId || req.params.id;
      const userId = req.user?.id;
      
      if (!userId) {
        logger.logBusinessLogic('No authenticated user', {}, correlationId);
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!workspaceId) {
        logger.logBusinessLogic('No workspace ID provided', {}, correlationId);
        return res.status(400).json({ error: 'Workspace ID required' });
      }
      
      const access = await shareService.validateShareAccess(workspaceId, userId);
      
      if (!access) {
        logger.logBusinessLogic('Access denied', { workspaceId, userId }, correlationId);
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Attach access level to request for downstream use
      req.shareAccess = access;
      req.workspaceId = workspaceId;
      
      logger.logBusinessLogic('Access granted', {
        workspaceId,
        userId,
        accessLevel: access
      }, correlationId);
      
      logger.logFunctionExit('requireShareAccess', undefined);
      next();
      
    } catch (error) {
      logger.logError(error as Error, 'requireShareAccess', { correlationId });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function requireOwnership(shareService: ShareService) {
  const logger = new Logger('ShareAuthMiddleware');
  
  return async (req: ShareAuthRequest, res: Response, next: NextFunction) => {
    const correlationId = logger.generateCorrelationId();
    
    try {
      // First check share access
      await requireShareAccess(shareService)(req, res, () => {
        // Then verify ownership
        if (req.shareAccess !== 'owner') {
          logger.logBusinessLogic('Ownership required but user is not owner', {
            workspaceId: req.workspaceId,
            accessLevel: req.shareAccess
          }, correlationId);
          return res.status(403).json({ error: 'Workspace ownership required' });
        }
        
        next();
      });
      
    } catch (error) {
      logger.logError(error as Error, 'requireOwnership', { correlationId });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}