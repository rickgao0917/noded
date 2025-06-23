"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = exports.WorkspaceError = void 0;
const logger_1 = require("../utils/logger");
const errors_1 = require("../types/errors");
const database_service_1 = require("./database-service");
class WorkspaceError extends errors_1.BaseError {
    constructor(message, cause) {
        super('WorkspaceError', message, cause);
    }
}
exports.WorkspaceError = WorkspaceError;
class WorkspaceService {
    constructor() {
        this.logger = new logger_1.Logger('WorkspaceService');
        this.MAX_WORKSPACE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
        this.database = database_service_1.DatabaseService.getInstance();
    }
    static getInstance() {
        if (!WorkspaceService.instance) {
            WorkspaceService.instance = new WorkspaceService();
        }
        return WorkspaceService.instance;
    }
    validateWorkspaceName(name) {
        if (!name || name.length === 0) {
            throw new WorkspaceError('Workspace name cannot be empty');
        }
        if (name.length > 100) {
            throw new WorkspaceError('Workspace name is too long');
        }
        if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
            throw new WorkspaceError('Workspace name contains invalid characters');
        }
    }
    validateWorkspaceSize(data) {
        const jsonString = JSON.stringify(data);
        const sizeInBytes = new Blob([jsonString]).size;
        if (sizeInBytes > this.MAX_WORKSPACE_SIZE) {
            throw new WorkspaceError(`Workspace size exceeds maximum allowed size of ${this.MAX_WORKSPACE_SIZE / 1024 / 1024}MB`);
        }
    }
    async createWorkspace(userId, request) {
        this.logger.logFunctionEntry('createWorkspace', { userId, name: request.name });
        try {
            this.validateWorkspaceName(request.name);
            // Create empty workspace
            const workspaceId = await this.database.saveWorkspace(userId, request.name, [], // Empty graph data
            { pan: { x: 0, y: 0 }, zoom: 1 }, // Default canvas state
            { createdBy: userId });
            const workspace = await this.getWorkspace(userId, workspaceId);
            if (!workspace) {
                throw new WorkspaceError('Failed to retrieve created workspace');
            }
            this.logger.info('Workspace created successfully', { userId, workspaceId });
            return workspace;
        }
        catch (error) {
            this.logger.logError(error, 'createWorkspace');
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError('Failed to create workspace', error);
        }
        finally {
            this.logger.logFunctionExit('createWorkspace');
        }
    }
    async getWorkspace(userId, workspaceId) {
        this.logger.logFunctionEntry('getWorkspace', { userId, workspaceId });
        try {
            // Get workspace from database - need to find by ID
            const workspaces = await this.database.listWorkspaces(userId);
            const workspaceInfo = workspaces.find(w => w.id === workspaceId);
            if (!workspaceInfo) {
                return null;
            }
            const dbWorkspace = await this.database.getWorkspace(userId, workspaceInfo.name);
            if (!dbWorkspace) {
                return null;
            }
            const graphData = JSON.parse(dbWorkspace.graphData);
            const canvasState = JSON.parse(dbWorkspace.canvasState);
            return {
                id: dbWorkspace.id,
                name: dbWorkspace.name,
                graphData,
                canvasState,
                createdAt: dbWorkspace.createdAt,
                updatedAt: dbWorkspace.updatedAt
            };
        }
        catch (error) {
            this.logger.logError(error, 'getWorkspace');
            return null;
        }
        finally {
            this.logger.logFunctionExit('getWorkspace');
        }
    }
    async getWorkspaceByName(userId, name) {
        this.logger.logFunctionEntry('getWorkspaceByName', { userId, name });
        try {
            const dbWorkspace = await this.database.getWorkspace(userId, name);
            if (!dbWorkspace) {
                return null;
            }
            const graphData = JSON.parse(dbWorkspace.graphData);
            const canvasState = JSON.parse(dbWorkspace.canvasState);
            return {
                id: dbWorkspace.id,
                name: dbWorkspace.name,
                graphData,
                canvasState,
                createdAt: dbWorkspace.createdAt,
                updatedAt: dbWorkspace.updatedAt
            };
        }
        catch (error) {
            this.logger.logError(error, 'getWorkspaceByName');
            return null;
        }
        finally {
            this.logger.logFunctionExit('getWorkspaceByName');
        }
    }
    async listWorkspaces(userId) {
        this.logger.logFunctionEntry('listWorkspaces', { userId });
        try {
            const workspaces = await this.database.listWorkspaces(userId);
            return workspaces.map(w => ({
                id: w.id,
                name: w.name,
                graphData: [], // Don't load data for list view
                canvasState: { pan: { x: 0, y: 0 }, zoom: 1 },
                createdAt: w.updatedAt, // Using updatedAt as proxy for now
                updatedAt: w.updatedAt
            }));
        }
        catch (error) {
            this.logger.logError(error, 'listWorkspaces');
            throw new WorkspaceError('Failed to list workspaces', error);
        }
        finally {
            this.logger.logFunctionExit('listWorkspaces');
        }
    }
    async updateWorkspace(userId, workspaceId, request) {
        this.logger.logFunctionEntry('updateWorkspace', { userId, workspaceId });
        try {
            const workspace = await this.getWorkspace(userId, workspaceId);
            if (!workspace) {
                throw new WorkspaceError('Workspace not found');
            }
            // If renaming, validate new name
            if (request.name && request.name !== workspace.name) {
                this.validateWorkspaceName(request.name);
            }
            // Update with new data
            const graphData = request.graphData !== undefined ? request.graphData : workspace.graphData;
            const canvasState = request.canvasState || workspace.canvasState;
            const name = request.name || workspace.name;
            this.validateWorkspaceSize({ graphData, canvasState });
            await this.database.saveWorkspace(userId, name, graphData, canvasState, { lastModified: new Date().toISOString() });
            const updated = await this.getWorkspaceByName(userId, name);
            if (!updated) {
                throw new WorkspaceError('Failed to retrieve updated workspace');
            }
            this.logger.info('Workspace updated successfully', { userId, workspaceId });
            return updated;
        }
        catch (error) {
            this.logger.logError(error, 'updateWorkspace');
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError('Failed to update workspace', error);
        }
        finally {
            this.logger.logFunctionExit('updateWorkspace');
        }
    }
    async deleteWorkspace(userId, workspaceId) {
        this.logger.logFunctionEntry('deleteWorkspace', { userId, workspaceId });
        try {
            const workspace = await this.getWorkspace(userId, workspaceId);
            if (!workspace) {
                throw new WorkspaceError('Workspace not found');
            }
            // Don't allow deleting the last workspace
            const allWorkspaces = await this.listWorkspaces(userId);
            if (allWorkspaces.length <= 1) {
                throw new WorkspaceError('Cannot delete the last workspace');
            }
            // Soft delete by renaming
            const deletedName = `_deleted_${Date.now()}_${workspace.name}`;
            await this.database.saveWorkspace(userId, deletedName, [], { pan: { x: 0, y: 0 }, zoom: 1 }, { deletedAt: new Date().toISOString(), originalName: workspace.name });
            this.logger.info('Workspace deleted successfully', { userId, workspaceId });
        }
        catch (error) {
            this.logger.logError(error, 'deleteWorkspace');
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError('Failed to delete workspace', error);
        }
        finally {
            this.logger.logFunctionExit('deleteWorkspace');
        }
    }
    async getOrCreateDefaultWorkspace(userId) {
        this.logger.logFunctionEntry('getOrCreateDefaultWorkspace', { userId });
        try {
            // Try to find any existing workspace
            const workspaces = await this.listWorkspaces(userId);
            if (workspaces.length > 0) {
                // Return the first workspace
                const first = await this.getWorkspace(userId, workspaces[0].id);
                if (first) {
                    return first;
                }
            }
            // Create default workspace
            return await this.createWorkspace(userId, { name: 'Default Workspace' });
        }
        catch (error) {
            this.logger.logError(error, 'getOrCreateDefaultWorkspace');
            throw new WorkspaceError('Failed to get or create default workspace', error);
        }
        finally {
            this.logger.logFunctionExit('getOrCreateDefaultWorkspace');
        }
    }
}
exports.WorkspaceService = WorkspaceService;
