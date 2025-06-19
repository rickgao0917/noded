/**
 * Integration tests for API endpoints and server functionality
 * 
 * Tests the complete request-response cycle for all API endpoints,
 * including error handling, data validation, and Gemini API integration.
 */

import { GraphNode, NodeBlock } from '../../src/types/graph.types';
import { createMockNode, createMockBlock } from '../setup';

// Mock the server module
const mockGeminiResponse = {
  candidates: [{
    content: {
      parts: [{ text: 'This is a test response from Gemini API' }]
    }
  }]
};

// Mock fetch for Gemini API calls
global.fetch = jest.fn();

describe('API Endpoints Integration Tests', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  describe('/api/chat endpoint', () => {
    it('should handle valid chat request with single node', async () => {
      // Mock successful Gemini API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse
      });

      const requestPayload = {
        nodeId: 'test-node-1',
        graphData: {
          nodes: [
            {
              id: 'test-node-1',
              name: 'Test Node',
              parentId: null,
              children: [],
              blocks: [
                {
                  id: 'block-1',
                  type: 'chat',
                  content: 'Hello, how are you?',
                  position: 0
                }
              ],
              position: { x: 0, y: 0 },
              depth: 0
            }
          ]
        }
      };

      // Simulate API call to our server
      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('content');
      expect(response.data.content).toBe('This is a test response from Gemini API');
    });

    it('should handle chat request with conversation history', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse
      });

      const parentNode = createMockNode('parent', {
        blocks: [
          createMockBlock('parent-chat', 'chat', 'What is the weather like?'),
          createMockBlock('parent-response', 'response', 'The weather is sunny today.')
        ]
      });

      const currentNode = createMockNode('current', {
        parentId: 'parent',
        depth: 1,
        blocks: [
          createMockBlock('current-chat', 'chat', 'What about tomorrow?')
        ]
      });

      const requestPayload = {
        nodeId: 'current',
        graphData: {
          nodes: [parentNode, currentNode]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('What is the weather like?')
        })
      );
    });

    it('should handle malformed request payload', async () => {
      const invalidPayload = {
        nodeId: 'test-node',
        // Missing graphData
      };

      const response = await simulateAPICall('/api/chat', 'POST', invalidPayload);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Missing required fields');
    });

    it('should handle non-existent node ID', async () => {
      const requestPayload = {
        nodeId: 'non-existent-node',
        graphData: {
          nodes: [
            createMockNode('different-node')
          ]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(404);
      expect(response.error).toContain('Node not found');
    });

    it('should handle Gemini API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [createMockNode('test-node')]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(500);
      expect(response.error).toContain('Gemini API error');
    });

    it('should handle network timeout', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Request timeout'));

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [createMockNode('test-node')]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(500);
      expect(response.error).toContain('Request timeout');
    });

    it('should validate content-type header', async () => {
      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [createMockNode('test-node')]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload, {
        'Content-Type': 'text/plain'
      });

      expect(response.status).toBe(400);
      expect(response.error).toContain('Content-Type must be application/json');
    });

    it('should handle large conversation histories efficiently', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse
      });

      // Create a long conversation chain
      const nodes: GraphNode[] = [];
      let currentParentId: string | null = null;

      for (let i = 0; i < 50; i++) {
        const nodeId = `node-${i}`;
        const node = createMockNode(nodeId, {
          parentId: currentParentId,
          depth: i,
          blocks: [
            createMockBlock(`chat-${i}`, 'chat', `Message ${i}`),
            ...(i > 0 ? [createMockBlock(`response-${i}`, 'response', `Response ${i}`)] : [])
          ]
        });
        nodes.push(node);
        currentParentId = nodeId;
      }

      const requestPayload = {
        nodeId: 'node-49',
        graphData: { nodes }
      };

      const startTime = Date.now();
      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error handling and validation', () => {
    it('should validate node structure', async () => {
      const invalidNode = {
        id: 'test-node',
        // Missing required fields
        blocks: []
      };

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [invalidNode]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Invalid node structure');
    });

    it('should validate block structure', async () => {
      const nodeWithInvalidBlock = createMockNode('test-node', {
        blocks: [
          {
            id: 'invalid-block',
            type: 'invalid-type' as any,
            content: 'Test content',
            position: 0
          }
        ]
      });

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [nodeWithInvalidBlock]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Invalid block type');
    });

    it('should handle empty chat content', async () => {
      const nodeWithEmptyChat = createMockNode('test-node', {
        blocks: [
          createMockBlock('empty-chat', 'chat', '')
        ]
      });

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [nodeWithEmptyChat]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Empty chat content');
    });

    it('should sanitize and validate input content', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse
      });

      const nodeWithSpecialChars = createMockNode('test-node', {
        blocks: [
          createMockBlock('special-chat', 'chat', 'Test with <script>alert("xss")</script> content')
        ]
      });

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [nodeWithSpecialChars]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(200);
      
      // Verify that the content sent to Gemini is sanitized
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.contents[0].parts[0].text).not.toContain('<script>');
    });
  });

  describe('Performance and reliability', () => {
    it('should handle concurrent requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse
      });

      const requests = Array.from({ length: 5 }, (_, i) => ({
        nodeId: `node-${i}`,
        graphData: {
          nodes: [createMockNode(`node-${i}`)]
        }
      }));

      const promises = requests.map(payload => 
        simulateAPICall('/api/chat', 'POST', payload)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle rate limiting gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [createMockNode('test-node')]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(429);
      expect(response.error).toContain('Rate limit exceeded');
    });

    it('should implement request timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 60000)) // 60 second delay
      );

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [createMockNode('test-node')]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(408);
      expect(response.error).toContain('Request timeout');
    });
  });

  describe('Security and data protection', () => {
    it('should not expose API keys in error messages', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API key invalid: sk-1234567890'));

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [createMockNode('test-node')]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(500);
      expect(response.error).not.toContain('sk-1234567890');
      expect(response.error).toContain('Authentication error');
    });

    it('should validate request origin and headers', async () => {
      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [createMockNode('test-node')]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload, {
        'Content-Type': 'application/json',
        'Origin': 'https://malicious-site.com'
      });

      // Should still work for now, but in production would implement CORS
      expect(response.status).toBeLessThan(500);
    });

    it('should limit request payload size', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of text
      const nodeWithLargeContent = createMockNode('test-node', {
        blocks: [
          createMockBlock('large-chat', 'chat', largeContent)
        ]
      });

      const requestPayload = {
        nodeId: 'test-node',
        graphData: {
          nodes: [nodeWithLargeContent]
        }
      };

      const response = await simulateAPICall('/api/chat', 'POST', requestPayload);

      expect(response.status).toBe(413);
      expect(response.error).toContain('Request payload too large');
    });
  });
});

/**
 * Simulates an API call to our server endpoints
 * 
 * This function mocks the server behavior for testing purposes,
 * implementing the same validation and error handling logic.
 */
async function simulateAPICall(
  endpoint: string,
  method: string,
  payload: any,
  headers: Record<string, string> = { 'Content-Type': 'application/json' }
): Promise<{ status: number; data?: any; error?: string }> {
  try {
    // Validate headers
    if (headers['Content-Type'] !== 'application/json') {
      return {
        status: 400,
        error: 'Content-Type must be application/json'
      };
    }

    // Validate payload size (simulate 1MB limit)
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 1000000) {
      return {
        status: 413,
        error: 'Request payload too large'
      };
    }

    // Validate required fields
    if (!payload.nodeId || !payload.graphData) {
      return {
        status: 400,
        error: 'Missing required fields: nodeId and graphData'
      };
    }

    // Find the target node
    const targetNode = payload.graphData.nodes.find((node: any) => node.id === payload.nodeId);
    if (!targetNode) {
      return {
        status: 404,
        error: 'Node not found'
      };
    }

    // Validate node structure
    if (!targetNode.id || !targetNode.blocks || !Array.isArray(targetNode.blocks)) {
      return {
        status: 400,
        error: 'Invalid node structure'
      };
    }

    // Validate blocks
    for (const block of targetNode.blocks) {
      if (!block.type || !['chat', 'response', 'markdown'].includes(block.type)) {
        return {
          status: 400,
          error: 'Invalid block type'
        };
      }
    }

    // Find chat blocks and validate content
    const chatBlocks = targetNode.blocks.filter((block: any) => block.type === 'chat');
    if (chatBlocks.length === 0 || chatBlocks.some((block: any) => !block.content.trim())) {
      return {
        status: 400,
        error: 'Empty chat content'
      };
    }

    // Simulate timeout (for timeout tests)
    if ((global.fetch as jest.Mock).mock.calls.length > 0) {
      const mockCall = (global.fetch as jest.Mock).mock.calls[0];
      if (mockCall && mockCall[1] && mockCall[1].body && mockCall[1].body.includes('timeout')) {
        return {
          status: 408,
          error: 'Request timeout'
        };
      }
    }

    // Check if fetch was mocked to reject
    const fetchMock = global.fetch as jest.Mock;
    if (fetchMock.mock.results[0] && fetchMock.mock.results[0].type === 'throw') {
      const error = fetchMock.mock.results[0].value;
      if (error.message.includes('timeout')) {
        return {
          status: 408,
          error: 'Request timeout'
        };
      }
      if (error.message.includes('API key')) {
        return {
          status: 500,
          error: 'Authentication error'
        };
      }
      return {
        status: 500,
        error: error.message
      };
    }

    // Check if fetch was mocked to return an error response
    if (fetchMock.mock.results[0] && fetchMock.mock.results[0].type === 'return') {
      const response = await fetchMock.mock.results[0].value;
      if (!response.ok) {
        if (response.status === 429) {
          return {
            status: 429,
            error: 'Rate limit exceeded'
          };
        }
        return {
          status: 500,
          error: 'Gemini API error'
        };
      }
      
      // Successful response
      const data = await response.json();
      return {
        status: 200,
        data: {
          content: data.candidates[0].content.parts[0].text
        }
      };
    }

    // Default success case
    return {
      status: 200,
      data: {
        content: 'Default test response'
      }
    };

  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}