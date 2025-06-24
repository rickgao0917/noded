import { Logger } from '../utils/logger';
import { BaseError } from '../types/errors';
import { DatabaseService } from './database-service';
import type {
  UserId,
  CanvasState
} from '../types/auth.types';

export interface Workspace {
  id: string;
  name: string;
  graphData: any[];
  canvasState: CanvasState;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  graphData?: any[];
  canvasState?: CanvasState;
}

export class WorkspaceError extends BaseError {
  constructor(message: string, cause?: Error) {
    super('WorkspaceError', message, cause);
  }
}

export class WorkspaceService {
  private static instance: WorkspaceService;
  private readonly logger = new Logger('WorkspaceService');
  private readonly database: DatabaseService;
  private readonly MAX_WORKSPACE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default

  private constructor() {
    this.database = DatabaseService.getInstance();
  }

  public static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }

  private validateWorkspaceName(name: string): void {
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

  private validateWorkspaceSize(data: any): void {
    const jsonString = JSON.stringify(data);
    const sizeInBytes = new Blob([jsonString]).size;
    
    if (sizeInBytes > this.MAX_WORKSPACE_SIZE) {
      throw new WorkspaceError(
        `Workspace size exceeds maximum allowed size of ${this.MAX_WORKSPACE_SIZE / 1024 / 1024}MB`
      );
    }
  }

  public async createWorkspace(userId: UserId, request: CreateWorkspaceRequest): Promise<Workspace> {
    this.logger.logFunctionEntry('createWorkspace', { userId, name: request.name });

    try {
      this.validateWorkspaceName(request.name);

      // Create empty workspace
      const workspaceId = await this.database.saveWorkspace(
        userId as string,
        request.name,
        [], // Empty graph data
        { pan: { x: 0, y: 0 }, zoom: 1 }, // Default canvas state
        { createdBy: userId }
      );

      const workspace = await this.getWorkspace(userId, workspaceId);
      if (!workspace) {
        throw new WorkspaceError('Failed to retrieve created workspace');
      }

      this.logger.info('Workspace created successfully', { userId, workspaceId });
      return workspace;
    } catch (error) {
      this.logger.logError(error as Error, 'createWorkspace');
      if (error instanceof WorkspaceError) {
        throw error;
      }
      throw new WorkspaceError('Failed to create workspace', error as Error);
    } finally {
      this.logger.logFunctionExit('createWorkspace');
    }
  }

  public async getWorkspace(userId: UserId, workspaceId: string): Promise<Workspace | null> {
    this.logger.logFunctionEntry('getWorkspace', { userId, workspaceId });

    try {
      // Get workspace from database - need to find by ID
      const workspaces = await this.database.listWorkspaces(userId as string);
      const workspaceInfo = workspaces.find(w => w.id === workspaceId);
      
      if (!workspaceInfo) {
        return null;
      }

      const dbWorkspace = await this.database.getWorkspace(userId as string, workspaceInfo.name);
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
    } catch (error) {
      this.logger.logError(error as Error, 'getWorkspace');
      return null;
    } finally {
      this.logger.logFunctionExit('getWorkspace');
    }
  }

  public async getWorkspaceByName(userId: UserId, name: string): Promise<Workspace | null> {
    this.logger.logFunctionEntry('getWorkspaceByName', { userId, name });

    try {
      const dbWorkspace = await this.database.getWorkspace(userId as string, name);
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
    } catch (error) {
      this.logger.logError(error as Error, 'getWorkspaceByName');
      return null;
    } finally {
      this.logger.logFunctionExit('getWorkspaceByName');
    }
  }

  public async listWorkspaces(userId: UserId): Promise<Workspace[]> {
    this.logger.logFunctionEntry('listWorkspaces', { userId });

    try {
      const workspaces = await this.database.listWorkspaces(userId as string);
      
      return workspaces.map(w => ({
        id: w.id,
        name: w.name,
        graphData: [], // Don't load data for list view
        canvasState: { pan: { x: 0, y: 0 }, zoom: 1 },
        createdAt: w.updatedAt, // Using updatedAt as proxy for now
        updatedAt: w.updatedAt
      }));
    } catch (error) {
      this.logger.logError(error as Error, 'listWorkspaces');
      throw new WorkspaceError('Failed to list workspaces', error as Error);
    } finally {
      this.logger.logFunctionExit('listWorkspaces');
    }
  }

  public async getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
    this.logger.logFunctionEntry('getWorkspaceById', { workspaceId });

    try {
      // Query database directly by workspace ID
      const dbWorkspace = await this.database.get<any>(
        'SELECT * FROM workspaces WHERE id = ?',
        [workspaceId]
      );
      
      if (!dbWorkspace) {
        return null;
      }

      const graphData = JSON.parse(dbWorkspace.graph_data);
      const canvasState = JSON.parse(dbWorkspace.canvas_state);

      return {
        id: dbWorkspace.id,
        name: dbWorkspace.name,
        graphData,
        canvasState,
        createdAt: new Date(dbWorkspace.created_at),
        updatedAt: new Date(dbWorkspace.updated_at)
      };
    } catch (error) {
      this.logger.logError(error as Error, 'getWorkspaceById');
      return null;
    } finally {
      this.logger.logFunctionExit('getWorkspaceById');
    }
  }

  public async updateWorkspace(
    userId: UserId,
    workspaceId: string,
    request: UpdateWorkspaceRequest
  ): Promise<Workspace> {
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

      await this.database.saveWorkspace(
        userId as string,
        name,
        graphData,
        canvasState,
        { lastModified: new Date().toISOString() }
      );

      const updated = await this.getWorkspaceByName(userId, name);
      if (!updated) {
        throw new WorkspaceError('Failed to retrieve updated workspace');
      }

      this.logger.info('Workspace updated successfully', { userId, workspaceId });
      return updated;
    } catch (error) {
      this.logger.logError(error as Error, 'updateWorkspace');
      if (error instanceof WorkspaceError) {
        throw error;
      }
      throw new WorkspaceError('Failed to update workspace', error as Error);
    } finally {
      this.logger.logFunctionExit('updateWorkspace');
    }
  }

  public async deleteWorkspace(userId: UserId, workspaceId: string): Promise<void> {
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
      await this.database.saveWorkspace(
        userId as string,
        deletedName,
        [],
        { pan: { x: 0, y: 0 }, zoom: 1 },
        { deletedAt: new Date().toISOString(), originalName: workspace.name }
      );

      this.logger.info('Workspace deleted successfully', { userId, workspaceId });
    } catch (error) {
      this.logger.logError(error as Error, 'deleteWorkspace');
      if (error instanceof WorkspaceError) {
        throw error;
      }
      throw new WorkspaceError('Failed to delete workspace', error as Error);
    } finally {
      this.logger.logFunctionExit('deleteWorkspace');
    }
  }

  public async getOrCreateDefaultWorkspace(userId: UserId): Promise<Workspace> {
    this.logger.logFunctionEntry('getOrCreateDefaultWorkspace', { userId });

    try {
      // Try to find any existing workspace
      const workspaces = await this.listWorkspaces(userId);
      
      if (workspaces.length > 0) {
        // Return the first workspace
        const first = await this.getWorkspace(userId, workspaces[0]!.id);
        if (first) {
          return first;
        }
      }

      // Create default workspace
      return await this.createWorkspace(userId, { name: 'Default Workspace' });
    } catch (error) {
      this.logger.logError(error as Error, 'getOrCreateDefaultWorkspace');
      throw new WorkspaceError('Failed to get or create default workspace', error as Error);
    } finally {
      this.logger.logFunctionExit('getOrCreateDefaultWorkspace');
    }
  }
}