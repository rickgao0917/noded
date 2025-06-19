const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Simple Gemini API integration
const GEMINI_API_KEY = 'AIzaSyBjgivUoXPF8QSz18fcKYtocSsL2Xjt2dI'; // Replace with your API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Call Gemini 2.0 Flash API with the provided JSON data
 */
async function callGeminiAPI(jsonData) {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 GEMINI API REQUEST');
  console.log('='.repeat(80));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Input JSON Data:');
  console.log('-'.repeat(40));
  console.log(JSON.stringify(jsonData, null, 2));
  console.log('='.repeat(80));

  // Convert the graph data to a meaningful conversation prompt
  let prompt = "";
  
  if (jsonData.nodes && jsonData.nodes.length > 0) {
    // Build conversation from the chain of nodes
    jsonData.nodes.forEach((node, nodeIndex) => {
      if (node.blocks && node.blocks.length > 0) {
        node.blocks.forEach((block) => {
          if (block.type === 'chat') {
            prompt += `Human: ${block.content}\n\n`;
          } else if (block.type === 'response') {
            prompt += `Assistant: ${block.content}\n\n`;
          }
          // Skip markdown blocks for conversation flow
        });
      }
    });
    
    // If no conversation found, create a simple prompt
    if (!prompt.trim()) {
      prompt = "Please provide a helpful response to continue this conversation.";
    } else {
      // Add instruction for the next response
      prompt += "Please continue this conversation with a helpful response:";
    }
  } else {
    prompt = "Hello! How can I help you today?";
  }

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    }
  };

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ GEMINI API RESPONSE');
    console.log('='.repeat(80));
    console.log('Timestamp:', new Date().toISOString());
    console.log('Response JSON:');
    console.log('-'.repeat(40));
    console.log(JSON.stringify(responseData, null, 2));
    console.log('='.repeat(80) + '\n');

    return responseData;
  } catch (error) {
    console.error('\n❌ GEMINI API ERROR:');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error.message);
    console.error('='.repeat(80) + '\n');
    throw error;
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return types[ext] || 'text/plain';
}

/**
 * Serve static files
 */
function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    
    const contentType = getContentType(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

/**
 * Main HTTP server
 */
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);

  // Handle API routes
  if (pathname === '/api/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const jsonData = JSON.parse(body);
        
        console.log('\n📨 RECEIVED SUBMISSION:');
        console.log('Timestamp:', new Date().toISOString());
        console.log('Data size:', JSON.stringify(jsonData).length, 'characters');
        
        // Call Gemini API
        const geminiResponse = await callGeminiAPI(jsonData);
        
        // Send response back to client
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        const responseData = {
          success: true,
          submitted: jsonData,
          geminiResponse: geminiResponse,
          timestamp: new Date().toISOString()
        };
        
        res.end(JSON.stringify(responseData, null, 2));
        
      } catch (error) {
        console.error('\n❌ SUBMISSION ERROR:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error:', error.message);
        
        res.writeHead(500, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
    });
    return;
  }
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Serve static files
  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
  } else if (pathname === '/standalone.html') {
    filePath = path.join(__dirname, 'standalone.html');
  } else if (pathname.startsWith('/dist/')) {
    filePath = path.join(__dirname, pathname);
  } else {
    // Try to serve other static files
    filePath = path.join(__dirname, pathname);
  }

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    } else {
      serveStaticFile(res, filePath);
    }
  });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 NODE EDITOR SERVER STARTED');
  console.log('='.repeat(80));
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Main app: http://localhost:${PORT}/`);
  console.log(`Standalone: http://localhost:${PORT}/standalone.html`);
  console.log('API endpoint: /api/submit (POST)');
  console.log('Ready to receive graph submissions and call Gemini 2.0 Flash API!');
  console.log('='.repeat(80) + '\n');
});