// Mock ACP agent for the agent_host integration tests: newline-delimited JSON-RPC on stdio.
// The prompt text selects the scenario (see the `switch` below).
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const record = (kind, data) => {
  if (process.env.MOCK_RECORD) appendFileSync(process.env.MOCK_RECORD, JSON.stringify({ kind, data }) + '\n');
};
const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

let nextId = 1000;
const waiting = new Map();
const call = (method, params) =>
  new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    send({ id, method, params });
  });

let cancelResolve = null;
let sessionId = 'mock-sess-1';
let mcpServers = [];
// MOCK_MODE: the mode the mock starts in (lets tests simulate an agent whose settings say bypass/auto).
let currentMode = process.env.MOCK_MODE || 'default';
const modeState = () => ({
  currentModeId: currentMode,
  availableModes: ['default', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'].map((id) => ({ id, name: id })),
});
const update = (u) => send({ method: 'session/update', params: { sessionId, update: u } });
const chunk = (text) => update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });

// Calls the app's MCP server with the headers the host put into session/new (T2.10).
async function mcpPing() {
  const srv = mcpServers[0];
  if (!srv) return chunk('mcp:none');
  const auth = Object.fromEntries((srv.headers ?? []).map((h) => [h.name, h.value]));
  const base = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  const post = async (body, headers) => {
    const r = await fetch(srv.url, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: r.status, sid: r.headers.get('mcp-session-id'), text: await r.text() };
  };
  const parse = (text) => {
    const line = text.split('\n').find((l) => l.startsWith('data:') && l.length > 6);
    return JSON.parse(line ? line.slice(5) : text);
  };
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mock', version: '0' } } };
  const noAuth = await post(init, base);
  const ok = await post(init, { ...base, ...auth });
  const headers = { ...base, ...auth, 'Mcp-Session-Id': ok.sid ?? '', 'MCP-Protocol-Version': '2025-06-18' };
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, headers);
  const list = parse((await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, headers)).text);
  const ping = parse((await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ping', arguments: {} } }, headers)).text);
  chunk(JSON.stringify({ name: srv.name, noAuth: noAuth.status, init: ok.status, tools: list.result.tools.map((t) => t.name), ping: ping.result.content[0].text }));
}

async function prompt(text) {
  const [cmd, ...rest] = text.split(':');
  switch (cmd) {
    case 'hello':
      chunk('hi ');
      chunk('there');
      update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Read notes.txt', kind: 'read', status: 'in_progress', locations: [{ path: 'notes.txt' }] });
      update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' });
      return 'end_turn';
    case 'perm': {
      // perm:<kind>:<path?>  ("-" = no location)
      const [kind, path] = rest;
      const res = await call('session/request_permission', {
        sessionId,
        toolCall: { toolCallId: 'tp', title: `${kind} request`, kind, ...(path && path !== '-' ? { locations: [{ path: rest.slice(1).join(':') }] } : {}) },
        options: [
          { optionId: 'allow-always', name: 'Always allow', kind: 'allow_always' },
          { optionId: 'allow-once', name: 'Allow', kind: 'allow_once' },
          { optionId: 'reject-once', name: 'Reject', kind: 'reject_once' },
        ],
      });
      const o = res.result?.outcome;
      chunk(`outcome:${o?.outcome === 'selected' ? o.optionId : 'cancelled'}`);
      return 'end_turn';
    }
    case 'fsread': {
      const res = await call('fs/read_text_file', { sessionId, path: rest.join(':') });
      chunk(res.error ? `fs:err:${res.error.message}` : `fs:ok:${res.result.content}`);
      return 'end_turn';
    }
    case 'fswrite': {
      const [path, ...content] = rest;
      const res = await call('fs/write_text_file', { sessionId, path, content: content.join(':') });
      chunk(res.error ? `fs:err:${res.error.message}` : 'fs:ok');
      return 'end_turn';
    }
    case 'mcpping':
      await mcpPing();
      return 'end_turn';
    case 'mode':
      // the agent switches its own mode (e.g. after ExitPlanMode)
      currentMode = rest[0];
      update({ sessionUpdate: 'current_mode_update', currentModeId: currentMode });
      chunk(`mode:${currentMode}`);
      return 'end_turn';
    case 'slow':
      chunk('working');
      await new Promise((r) => { cancelResolve = r; });
      return 'cancelled';
    case 'die':
      process.exit(3);
      return 'end_turn';
    default:
      chunk(`echo:${text}`);
      return 'end_turn';
  }
}

createInterface({ input: process.stdin }).on('line', async (line) => {
  const msg = JSON.parse(line);
  if (msg.method === undefined && msg.id !== undefined) {
    waiting.get(msg.id)?.(msg);
    waiting.delete(msg.id);
    return;
  }
  switch (msg.method) {
    case 'initialize':
      record('initialize', msg.params);
      send({ id: msg.id, result: { protocolVersion: 1, agentCapabilities: { loadSession: !process.env.MOCK_NO_LOAD, sessionCapabilities: process.env.MOCK_RESUME ? { resume: {} } : {} }, agentInfo: { name: 'mock-agent', version: '0.0.1' }, authMethods: [] } });
      break;
    case 'session/new':
      record('session/new', { ...msg.params, processCwd: process.cwd() });
      mcpServers = msg.params.mcpServers ?? [];
      send({ id: msg.id, result: { sessionId, modes: modeState() } });
      break;
    case 'session/load':
    case 'session/resume':
      record(msg.method, { ...msg.params, processCwd: process.cwd() });
      mcpServers = msg.params.mcpServers ?? [];
      sessionId = msg.params.sessionId;
      if (msg.method === 'session/load') {
        // session/load replays the stored conversation as updates before answering
        update({ sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'old question' } });
        chunk('old answer');
      }
      send({ id: msg.id, result: { modes: modeState() } });
      break;
    case 'session/set_mode':
      record('session/set_mode', msg.params);
      if (process.env.MOCK_REFUSE_MODE) {
        send({ id: msg.id, error: { code: -32602, message: 'Invalid Mode' } });
        break;
      }
      currentMode = msg.params.modeId;
      send({ id: msg.id, result: {} });
      break;
    case 'session/prompt': {
      const text = msg.params.prompt.map((b) => b.text ?? '').join('');
      record('prompt', text);
      const stopReason = await prompt(text);
      send({ id: msg.id, result: { stopReason } });
      break;
    }
    case 'session/cancel':
      record('cancel', null);
      cancelResolve?.();
      cancelResolve = null;
      break;
    default:
      if (msg.id !== undefined) send({ id: msg.id, error: { code: -32601, message: 'method not found' } });
  }
});
