"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserDataService = exports.UserDataError = void 0;
const logger_1 = require("../utils/logger");
const errors_1 = require("../types/errors");
const database_service_1 = require("./database-service");
class UserDataError extends errors_1.BaseError {
    constructor(message, cause) {
        super('UserDataError', message, cause);
    }
}
exports.UserDataError = UserDataError;
class UserDataService {
    constructor() {
        this.logger = new logger_1.Logger('UserDataService');
        this.MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
        this.database = database_service_1.DatabaseService.getInstance();
    }
    static getInstance() {
        if (!UserDataService.instance) {
            UserDataService.instance = new UserDataService();
        }
        return UserDataService.instance;
    }
    validateFileName(fileName) {
        if (!fileName || fileName.length === 0) {
            throw new UserDataError('File name cannot be empty');
        }
        if (fileName.length > 255) {
            throw new UserDataError('File name is too long');
        }
        if (!/^[a-zA-Z0-9_\-\s.]+$/.test(fileName)) {
            throw new UserDataError('File name contains invalid characters');
        }
    }
    validateFileSize(data) {
        const jsonString = JSON.stringify(data);
        const sizeInBytes = new Blob([jsonString]).size;
        if (sizeInBytes > this.MAX_FILE_SIZE) {
            throw new UserDataError(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
        }
    }
    validateCanvasState(canvasState) {
        return (canvasState &&
            typeof canvasState === 'object' &&
            'pan' in canvasState &&
            typeof canvasState.pan === 'object' &&
            typeof canvasState.pan.x === 'number' &&
            typeof canvasState.pan.y === 'number' &&
            'zoom' in canvasState &&
            typeof canvasState.zoom === 'number' &&
            canvasState.zoom > 0 &&
            canvasState.zoom <= 10);
    }
    async saveUserFile(userId, request) {
        this.logger.logFunctionEntry('saveUserFile', { userId, fileName: request.fileName });
        try {
            // Validate input
            this.validateFileName(request.fileName);
            this.validateFileSize(request.graphData);
            if (!this.validateCanvasState(request.canvasState)) {
                throw new UserDataError('Invalid canvas state');
            }
            // Validate graph data structure
            if (!Array.isArray(request.graphData)) {
                throw new UserDataError('Graph data must be an array of nodes');
            }
            // Basic validation of nodes
            for (const node of request.graphData) {
                if (!node.id || !node.position || !Array.isArray(node.blocks)) {
                    throw new UserDataError('Invalid node structure');
                }
            }
            // Save to database
            const fileId = await this.database.saveUserFile(userId, request.fileName, request.graphData, request.canvasState, {
                nodeCount: request.graphData.length,
                lastModified: new Date().toISOString()
            });
            this.logger.info('File saved successfully', { userId, fileId });
            return fileId;
        }
        catch (error) {
            this.logger.logError(error, 'saveUserFile');
            if (error instanceof UserDataError) {
                throw error;
            }
            throw new UserDataError('Failed to save file', error);
        }
        finally {
            this.logger.logFunctionExit('saveUserFile');
        }
    }
    async loadUserFile(userId, fileName) {
        this.logger.logFunctionEntry('loadUserFile', { userId, fileName });
        try {
            this.validateFileName(fileName);
            const file = await this.database.getUserFile(userId, fileName);
            if (!file) {
                return null;
            }
            const graphData = JSON.parse(file.graphData);
            const canvasState = JSON.parse(file.canvasState);
            // Validate loaded data
            if (!this.validateCanvasState(canvasState)) {
                throw new UserDataError('Corrupted canvas state in saved file');
            }
            return {
                userId,
                fileId: file.id,
                fileName: file.fileName,
                nodes: graphData,
                canvasState
            };
        }
        catch (error) {
            this.logger.logError(error, 'loadUserFile');
            if (error instanceof UserDataError) {
                throw error;
            }
            throw new UserDataError('Failed to load file', error);
        }
        finally {
            this.logger.logFunctionExit('loadUserFile');
        }
    }
    async updateUserFile(userId, fileId, request) {
        this.logger.logFunctionEntry('updateUserFile', { userId, fileId });
        try {
            // Validate input
            this.validateFileSize(request.graphData);
            if (!this.validateCanvasState(request.canvasState)) {
                throw new UserDataError('Invalid canvas state');
            }
            // Get existing file to verify ownership and get fileName
            const files = await this.database.listUserFiles(userId);
            const file = files.find(f => f.id === fileId);
            if (!file) {
                throw new UserDataError('File not found or access denied');
            }
            // Update file
            await this.database.saveUserFile(userId, file.fileName, request.graphData, request.canvasState, Object.assign(Object.assign({}, file.metadata), { nodeCount: request.graphData.length, lastModified: new Date().toISOString() }));
            this.logger.info('File updated successfully', { userId, fileId });
        }
        catch (error) {
            this.logger.logError(error, 'updateUserFile');
            if (error instanceof UserDataError) {
                throw error;
            }
            throw new UserDataError('Failed to update file', error);
        }
        finally {
            this.logger.logFunctionExit('updateUserFile');
        }
    }
    async listUserFiles(userId) {
        this.logger.logFunctionEntry('listUserFiles', { userId });
        try {
            const files = await this.database.listUserFiles(userId);
            return files.map(file => ({
                id: file.id,
                fileName: file.fileName,
                updatedAt: file.updatedAt,
                metadata: file.metadata
            }));
        }
        catch (error) {
            this.logger.logError(error, 'listUserFiles');
            throw new UserDataError('Failed to list files', error);
        }
        finally {
            this.logger.logFunctionExit('listUserFiles');
        }
    }
    async deleteUserFile(userId, fileId) {
        this.logger.logFunctionEntry('deleteUserFile', { userId, fileId });
        try {
            // Verify ownership
            const files = await this.database.listUserFiles(userId);
            const file = files.find(f => f.id === fileId);
            if (!file) {
                throw new UserDataError('File not found or access denied');
            }
            // For now, we'll implement soft delete by renaming
            const deletedFileName = `_deleted_${Date.now()}_${file.fileName}`;
            await this.database.saveUserFile(userId, deletedFileName, [], { pan: { x: 0, y: 0 }, zoom: 1 }, Object.assign(Object.assign({}, file.metadata), { deletedAt: new Date().toISOString() }));
            this.logger.info('File deleted successfully', { userId, fileId });
        }
        catch (error) {
            this.logger.logError(error, 'deleteUserFile');
            if (error instanceof UserDataError) {
                throw error;
            }
            throw new UserDataError('Failed to delete file', error);
        }
        finally {
            this.logger.logFunctionExit('deleteUserFile');
        }
    }
    async getOrCreateDefaultFile(userId) {
        this.logger.logFunctionEntry('getOrCreateDefaultFile', { userId });
        try {
            // Try to load the default file
            const defaultFileName = 'default';
            let file = await this.loadUserFile(userId, defaultFileName);
            if (!file) {
                // Create empty default file
                const fileId = await this.saveUserFile(userId, {
                    fileName: defaultFileName,
                    graphData: [],
                    canvasState: { pan: { x: 0, y: 0 }, zoom: 1 }
                });
                file = {
                    userId,
                    fileId,
                    fileName: defaultFileName,
                    nodes: [],
                    canvasState: { pan: { x: 0, y: 0 }, zoom: 1 }
                };
            }
            return file;
        }
        catch (error) {
            this.logger.logError(error, 'getOrCreateDefaultFile');
            throw new UserDataError('Failed to access default file', error);
        }
        finally {
            this.logger.logFunctionExit('getOrCreateDefaultFile');
        }
    }
}
exports.UserDataService = UserDataService;
