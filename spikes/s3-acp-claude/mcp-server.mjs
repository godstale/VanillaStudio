// Stand-in for the app's `vanilla-tools` MCP server (D-014): one tool, logs each call.
import { appendFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const log = process.env.VANILLA_MCP_LOG;
const server = new McpServer({ name: 'vanilla', version: '0.0.1' });

server.tool(
  'vanilla_ping',
  'Vanilla Studio test tool. Returns a pong with the given message.',
  { message: z.string() },
  async ({ message }) => {
    if (log) appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), tool: 'vanilla_ping', message }) + '\n');
    return { content: [{ type: 'text', text: `pong: ${message}` }] };
  },
);

await server.connect(new StdioServerTransport());
