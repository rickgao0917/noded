"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShareRoutes = createShareRoutes;
const express_1 = require("express");
const share_auth_1 = require("../middleware/share-auth");
const logger_1 = require("../utils/logger");
const errors_1 = require("../types/errors");
function createShareRoutes(shareService, workspaceService, requireAuth) {
    const router = (0, express_1.Router)();
    const logger = new logger_1.Logger('ShareRoutes');
    // All share routes require authentication
    router.use(requireAuth);
    // Search for users to share with
    router.get('/users/search', async (req, res) => {
        var _a;
        const correlationId = logger.generateCorrelationId();
        try {
            logger.logFunctionEntry('searchUsers', {
                query: req.query.q,
                limit: req.query.limit
            });
            const query = req.query.q;
            const limit = parseInt(req.query.limit) || 10;
            if (!query || query.trim().length < 2) {
                res.status(400).json({
                    error: 'Search query must be at least 2 characters'
                });
                return;
            }
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const users = await shareService.searchUsers(query, userId, limit);
            logger.logBusinessLogic('User search completed', {
                query,
                resultCount: users.length
            }, correlationId);
            res.json({ users });
        }
        catch (error) {
            logger.logError(error, 'searchUsers', { correlationId });
            res.status(500).json({ error: 'Failed to search users' });
        }
    });
    // Share workspace with another user
    router.post('/workspaces/:workspaceId/shares', (0, share_auth_1.requireOwnership)(shareService), async (req, res) => {
        var _a, _b;
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
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const workspaceId = req.params.workspaceId;
            if (!workspaceId) {
                res.status(400).json({ error: 'Workspace ID required' });
                return;
            }
            const share = await shareService.shareWorkspace(workspaceId, userId, shareWithUserId, expiresAt);
            // Get username for response
            const sharedWithUser = await shareService.searchUsers(shareWithUserId, userId, 1);
            logger.logBusinessLogic('Workspace shared', {
                workspaceId,
                shareId: share.id
            }, correlationId);
            res.status(201).json(Object.assign(Object.assign({}, share), { sharedWithUsername: ((_b = sharedWithUser[0]) === null || _b === void 0 ? void 0 : _b.username) || 'Unknown' }));
        }
        catch (error) {
            logger.logError(error, 'createShare', { correlationId });
            if (error instanceof errors_1.ValidationError) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.status(500).json({ error: 'Failed to share workspace' });
        }
    });
    // Revoke share access
    router.delete('/workspaces/:workspaceId/shares/:userId', (0, share_auth_1.requireOwnership)(shareService), async (req, res) => {
        var _a;
        const correlationId = logger.generateCorrelationId();
        try {
            logger.logFunctionEntry('revokeShare', {
                workspaceId: req.params.workspaceId,
                userId: req.params.userId
            });
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
            const success = await shareService.revokeShare(workspaceId, userId, revokeUserId);
            if (!success) {
                res.status(404).json({ error: 'Share not found' });
                return;
            }
            logger.logBusinessLogic('Share revoked', {
                workspaceId,
                revokedUserId: revokeUserId
            }, correlationId);
            res.status(204).send();
        }
        catch (error) {
            logger.logError(error, 'revokeShare', { correlationId });
            res.status(500).json({ error: 'Failed to revoke share' });
        }
    });
    // List all shares for a workspace
    router.get('/workspaces/:workspaceId/shares', (0, share_auth_1.requireOwnership)(shareService), async (req, res) => {
        var _a;
        const correlationId = logger.generateCorrelationId();
        try {
            logger.logFunctionEntry('listShares', {
                workspaceId: req.params.workspaceId
            });
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const workspaceId = req.params.workspaceId;
            if (!workspaceId) {
                res.status(400).json({ error: 'Workspace ID required' });
                return;
            }
            const shares = await shareService.getMyShares(userId, workspaceId);
            logger.logBusinessLogic('Shares retrieved', {
                workspaceId,
                count: shares.length
            }, correlationId);
            res.json({ shares });
        }
        catch (error) {
            logger.logError(error, 'listShares', { correlationId });
            res.status(500).json({ error: 'Failed to retrieve shares' });
        }
    });
    // List workspaces shared with current user
    router.get('/shared-with-me', async (req, res) => {
        var _a;
        const correlationId = logger.generateCorrelationId();
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            logger.logFunctionEntry('getSharedWithMe', {
                userId
            });
            const workspaces = await shareService.getSharedWithMe(userId);
            logger.logBusinessLogic('Shared workspaces retrieved', {
                userId,
                count: workspaces.length
            }, correlationId);
            res.json({ workspaces });
        }
        catch (error) {
            logger.logError(error, 'getSharedWithMe', { correlationId });
            res.status(500).json({ error: 'Failed to retrieve shared workspaces' });
        }
    });
    // Generate shareable link
    router.post('/workspaces/:workspaceId/share-link', (0, share_auth_1.requireOwnership)(shareService), async (req, res) => {
        var _a;
        const correlationId = logger.generateCorrelationId();
        try {
            logger.logFunctionEntry('createShareLink', {
                workspaceId: req.params.workspaceId,
                options: req.body
            });
            const { requiresLogin = true, expiresIn } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const workspaceId = req.params.workspaceId;
            if (!workspaceId) {
                res.status(400).json({ error: 'Workspace ID required' });
                return;
            }
            const shareLink = await shareService.createShareLink(workspaceId, userId, { requiresLogin, expiresIn });
            // Construct full URL
            const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
            const fullLink = `${baseUrl}/shared/${shareLink.token}`;
            logger.logBusinessLogic('Share link created', {
                workspaceId,
                linkId: shareLink.id
            }, correlationId);
            res.status(201).json(Object.assign(Object.assign({}, shareLink), { link: fullLink }));
        }
        catch (error) {
            logger.logError(error, 'createShareLink', { correlationId });
            res.status(500).json({ error: 'Failed to create share link' });
        }
    });
    // Access workspace via share link
    router.get('/shared/:token', async (req, res) => {
        var _a;
        const correlationId = logger.generateCorrelationId();
        try {
            logger.logFunctionEntry('accessShareLink', {
                token: req.params.token,
                authenticated: !!req.user
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
            if (shareLink.requiresLogin && !req.user) {
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
            await shareService.logShareActivity(shareLink.workspaceId, ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null, 'viewed', { shareType: 'link_share', token: req.params.token });
            // Increment access count
            await shareService.incrementShareLinkAccess(shareLink.id);
            logger.logBusinessLogic('Share link accessed', {
                workspaceId: shareLink.workspaceId,
                authenticated: !!req.user
            }, correlationId);
            res.json({
                workspace: Object.assign(Object.assign({}, workspace), { isReadOnly: true, shareInfo: {
                        type: 'link',
                        owner: shareLink.ownerUsername
                    } })
            });
        }
        catch (error) {
            logger.logError(error, 'accessShareLink', { correlationId });
            res.status(500).json({ error: 'Failed to access shared workspace' });
        }
    });
    return router;
}
