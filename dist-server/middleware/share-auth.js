"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireShareAccess = requireShareAccess;
exports.requireOwnership = requireOwnership;
const logger_1 = require("../utils/logger");
function requireShareAccess(shareService) {
    const logger = new logger_1.Logger('ShareAuthMiddleware');
    return async (req, res, next) => {
        var _a;
        const correlationId = logger.generateCorrelationId();
        try {
            logger.logFunctionEntry('requireShareAccess', {
                method: req.method,
                path: req.path,
                workspaceId: req.params.workspaceId
            });
            const workspaceId = req.params.workspaceId || req.params.id;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
        }
        catch (error) {
            logger.logError(error, 'requireShareAccess', { correlationId });
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}
function requireOwnership(shareService) {
    const logger = new logger_1.Logger('ShareAuthMiddleware');
    return async (req, res, next) => {
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
        }
        catch (error) {
            logger.logError(error, 'requireOwnership', { correlationId });
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}
