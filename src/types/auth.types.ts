// Branded types for authentication
export type UserId = string & { readonly _brand: 'UserId' };
export type SessionToken = string & { readonly _brand: 'SessionToken' };
export type FileId = string & { readonly _brand: 'FileId' };

// User authentication interfaces
export interface UserCredentials {
  username: string;
  password: string;
}

export interface UserSession {
  userId: UserId;
  username: string;
  sessionToken: SessionToken;
  expiresAt: Date;
}

export interface UserGraphData {
  userId: UserId;
  fileId: FileId;
  fileName: string;
  nodes: any; // Will be GraphNode[] but avoiding circular dependency
  canvasState: CanvasState;
}

export interface CanvasState {
  pan: { x: number; y: number };
  zoom: number;
}

export interface SaveFileRequest {
  fileName: string;
  graphData: any;
  canvasState: CanvasState;
}

export interface UpdateFileRequest {
  graphData: any;
  canvasState: CanvasState;
}

export interface FileMetadata {
  id: FileId;
  fileName: string;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface LoginResponse {
  session: UserSession;
  message: string;
}

export interface RegisterResponse {
  userId: UserId;
  username: string;
  message: string;
}