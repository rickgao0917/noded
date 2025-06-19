/**
 * Helper function to parse logger output which may be pretty-printed JSON
 */
export function parseLoggerOutput(output: string): any {
  try {
    return JSON.parse(output);
  } catch (error) {
    // If parsing fails, it might be because the output contains multiple lines
    // Try to find a complete JSON object
    const lines = output.split('\n');
    let jsonStr = '';
    let braceCount = 0;
    
    for (const line of lines) {
      jsonStr += line;
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      if (braceCount === 0 && jsonStr.trim()) {
        try {
          return JSON.parse(jsonStr);
        } catch {
          // Continue accumulating
        }
      }
    }
    
    throw new Error(`Could not parse logger output: ${output}`);
  }
}