// Condense out/session.jsonl into the events that matter for the S3 matrix.
import { readFileSync } from 'node:fs';

const lines = readFileSync(process.argv[2] ?? 'out/session.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
let message = '';
const flush = () => {
  if (message) console.log(`  agent: ${message.replace(/\s+/g, ' ').slice(0, 300)}`);
  message = '';
};
for (const { ms, kind, data } of lines) {
  const t = `${(ms / 1000).toFixed(1)}s`.padStart(7);
  if (kind === 'update') {
    const u = data.sessionUpdate;
    if (u === 'agent_message_chunk') message += data.content?.text ?? '';
    else if (u === 'tool_call') { flush(); console.log(`${t} tool_call ${data.kind} ${data.name ?? ''} "${data.title}"`); }
    else if (u === 'tool_call_update' && data.status) { flush(); console.log(`${t} tool_update ${data.status} ${data.title ?? ''}`); }
    else if (u === 'usage_update' && data.cost) console.log(`${t} cost $${data.cost.amount.toFixed(3)} context ${data.used}`);
  } else if (kind === 'permission') {
    flush();
    console.log(`${t} PERMISSION ${data.decision} (${data.why}) kind=${data.toolCall.kind} offered=${data.offered.join('/')} "${data.toolCall.title}"`);
  } else if (kind.startsWith('fs.') || kind.startsWith('scenario') || kind === 'cancel.sent') {
    flush();
    console.log(`${t} ${kind} ${JSON.stringify(data)}`);
  }
}
flush();
