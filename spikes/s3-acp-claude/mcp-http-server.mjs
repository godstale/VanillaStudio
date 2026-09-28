// Streamable HTTP variant of the vanilla MCP stand-in, bound to 127.0.0.1 with a bearer token.
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const port = Number(process.env.PORT ?? 47811);
const token = process.env.VANILLA_MCP_TOKEN ?? 'dev-token';
const log = process.env.VANILLA_MCP_LOG;

function build() {
  const server = new McpServer({ name: 'vanilla', version: '0.0.1' });
  server.tool('vanilla_ping', 'Vanilla Studio test tool. Returns a pong with the given message.', { message: z.string() }, async ({ message }) => {
    if (log) appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), transport: 'http', tool: 'vanilla_ping', message }) + '\n');
    return { content: [{ type: 'text', text: `pong-http: ${message}` }] };
  });
  return server;
}

createServer(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401).end('unauthorized');
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
  // Stateless mode: a fresh server/transport per request.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = build();
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}).listen(port, '127.0.0.1', () => console.log(`vanilla mcp http on 127.0.0.1:${port}`));
