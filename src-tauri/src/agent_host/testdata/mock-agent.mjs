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
const update = (u) => send({ method: 'session/update', params: { sessionId, update: u } });
const chunk = (text) => update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });

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
      send({ id: msg.id, result: { protocolVersion: 1, agentCapabilities: { loadSession: true }, agentInfo: { name: 'mock-agent', version: '0.0.1' }, authMethods: [] } });
      break;
    case 'session/new':
      record('session/new', { ...msg.params, processCwd: process.cwd() });
      send({ id: msg.id, result: { sessionId, modes: { currentModeId: 'default', availableModes: [{ id: 'default', name: 'Default' }] } } });
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
