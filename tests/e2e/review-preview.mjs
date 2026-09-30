// Review preview smoke scenario (T4.21, F-REV-01): with the app open on a trusted fixture project,
// open the review tab and assert the Bridge reaches `ready` with a live 127.0.0.1 preview iframe.
// Problem allowlist: Vite logs warnings; only errors fail the run.
import { attach, collectProblems, evaluate, listTargets, waitForEval, waitForTarget } from './cdp.mjs';

const REVIEW_TAB_TEXTS = ['검수', 'Review'];
const BRIDGE_READY_TEXTS = ['미리보기 연결됨', 'Preview connected'];

/** The app's main window: dev serves localhost:14xxx, the bundle uses a tauri origin. */
function isMainTarget(t) {
  if (t.type !== 'page' || !t.webSocketDebuggerUrl) return false;
  return /localhost:14\d+|127\.0\.0\.1:14\d+|tauri\.localhost|__tauri__/.test(t.url);
}

async function attachMain(port, timeoutMs) {
  const target = await waitForTarget(port, (ts) => ts.find(isMainTarget), { timeoutMs, label: 'main window' });
  const session = attach(target);
  await session.ready;
  await session.send('Runtime.enable');
  await session.send('Log.enable');
  await session.send('Page.enable');
  return { target, session };
}

const SEED_EXPR = (projectDir) => `(() => {
  localStorage.setItem('wt_current_workspace_root', ${JSON.stringify(projectDir)});
  try {
    const map = JSON.parse(localStorage.getItem('wt_trusted_workspaces') ?? '{}');
    map[${JSON.stringify(projectDir)}] = true;
    localStorage.setItem('wt_trusted_workspaces', JSON.stringify(map));
  } catch {}
  const recent = JSON.parse(localStorage.getItem('wt_recent_workspaces') ?? '[]');
  if (!recent.includes(${JSON.stringify(projectDir)})) {
    localStorage.setItem('wt_recent_workspaces', JSON.stringify([${JSON.stringify(projectDir)}, ...recent].slice(0, 10)));
  }
  location.reload();
  return true;
})()`;

/** Seed workspace root + trust (what the welcome/project UI writes) and reattach after reload. */
async function seedAndReattach(port, projectDir, timeoutMs) {
  const first = await attachMain(port, timeoutMs);
  await evaluate(first.session, SEED_EXPR(projectDir));
  first.session.close();
  // The reload swaps the target: wait for a fresh main page that answers evaluates.
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const targets = await listTargets(port);
      const target = targets.find(isMainTarget);
      if (target?.webSocketDebuggerUrl) {
        const session = attach(target);
        await session.ready;
        await session.send('Runtime.enable');
        await session.send('Log.enable');
        await evaluate(session, 'document.readyState');
        return { target, session };
      }
    } catch {
      /* reloading */
    }
    if (Date.now() > deadline) throw new Error('timed out reattaching after seed reload');
    await new Promise((r) => setTimeout(r, 500));
  }
}

const DISMISS_DIALOGS_EXPR = `(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')]
    .find((e) => /언어 선택|language/i.test(e.textContent));
  if (!dlg) return 'no-language-dialog';
  const btns = [...dlg.querySelectorAll('button')];
  const ko = btns.find((e) => e.textContent.trim() === '한국어');
  if (ko) ko.click();
  const ok = [...dlg.querySelectorAll('button')]
    .find((e) => ['확인', 'Close'].includes(e.textContent.trim()));
  if (ok) ok.click();
  return 'dismissed-language-dialog';
})()`;

const OPEN_PIPELINE_EXPR = `(() => {
  const hit = [...document.querySelectorAll('button')]
    .find((e) => (e.getAttribute('aria-label') ?? '').trim() === '파이프라인');
  if (!hit) return null;
  hit.click();
  return 'pipeline';
})()`;

const OPEN_REVIEW_EXPR = `(() => {
  const texts = ${JSON.stringify(REVIEW_TAB_TEXTS)};
  const els = [...document.querySelectorAll('button, [role="tab"]')];
  const visible = (e) => e.offsetParent !== null || e.getClientRects().length > 0;
  const exact = els.find((e) => texts.includes(e.textContent.trim()) && visible(e));
  const prefixed = els.find((e) => texts.some((w) => e.textContent.trim().endsWith(w)) && visible(e));
  const hit = exact ?? prefixed;
  if (!hit) return null;
  hit.click();
  return hit.textContent.trim();
})()`;

const BRIDGE_STATUS_EXPR = `(() => {
  const el = document.querySelector('[data-testid="bridge-status"]');
  return el ? el.textContent.trim() : null;
})()`;

const PREVIEW_EXPR = `(() => {
  const box = document.querySelector('[data-testid="preview-box"] iframe');
  const scrubber = document.querySelector('[data-testid="scrubber"]');
  const params = document.querySelector('[data-testid="params-panel"]');
  return {
    iframeSrc: box ? box.getAttribute('src') : null,
    scrubber: Boolean(scrubber),
    paramsPanel: Boolean(params),
    status: document.querySelector('[data-testid="bridge-status"]')?.textContent.trim() ?? null,
  };
})()`;

/**
 * Run the scenario. Resolves with `{ steps, problems }`; rejects with the failing step.
 *
 * @param {{ port: number, projectDir: string, timeoutMs: number }} opts
 */
export async function runReviewPreviewScenario({ port, projectDir, timeoutMs }) {
  const steps = [];
  const step = (name, detail = null) => {
    steps.push({ name, detail, at: new Date().toISOString() });
    console.log(`[e2e] ${name}${detail === null ? '' : ` — ${JSON.stringify(detail)}`}`);
  };

  const { session } = await seedAndReattach(port, projectDir, timeoutMs);
  const problems = collectProblems(session);
  try {
    step('seeded workspace and reattached', projectDir);

    step(await evaluate(session, DISMISS_DIALOGS_EXPR));

    // The reload lands before React renders: wait for the shell.
    await waitForEval(
      session,
      `(() => [...document.querySelectorAll('button')]
        .some((e) => (e.getAttribute('aria-label') ?? '').trim() === '파이프라인'))()`,
      { timeoutMs: 30_000, label: 'app shell' },
    );
    const pipeline = await evaluate(session, OPEN_PIPELINE_EXPR);
    if (!pipeline) throw new Error('pipeline activity not found (aria-label: 파이프라인)');
    step('opened pipeline panel');
    await waitForEval(
      session,
      `(() => [...document.querySelectorAll('button, [role="tab"]')]
        .some((e) => ${JSON.stringify(REVIEW_TAB_TEXTS)}.some((w) => e.textContent.trim().endsWith(w))))()`,
      { timeoutMs: 15_000, label: 'review stage tab' },
    );

    const clicked = await evaluate(session, OPEN_REVIEW_EXPR);
    if (!clicked) throw new Error('review tab not found (texts: 검수/Review)');
    step('opened review tab', clicked);

    // Preview server boot + Vite compile can take a while on first run.
    await waitForEval(
      session,
      `(() => { const s = (${BRIDGE_STATUS_EXPR}); return ${JSON.stringify(BRIDGE_READY_TEXTS)}.includes(s) ? s : null; })()`,
      { timeoutMs, label: 'bridge ready' },
    );
    step('bridge ready');

    const preview = await evaluate(session, PREVIEW_EXPR);
    const origin = (() => {
      try {
        return new URL(preview.iframeSrc).origin;
      } catch {
        return null;
      }
    })();
    if (!origin?.startsWith('http://127.0.0.1:')) {
      throw new Error(`preview iframe missing or not loopback-isolated: ${preview.iframeSrc}`);
    }
    step('preview iframe loopback-isolated', preview.iframeSrc);
    if (!preview.scrubber) throw new Error('scrubber (T4.13) not rendered');
    if (!preview.paramsPanel) throw new Error('params panel (T4.14) not rendered');
    step('scrubber and params panel rendered');

    // A preview target on 127.0.0.1 proves the frame navigated (not just the element existing).
    const previewTarget = await waitForTarget(
      port,
      (ts) => ts.find((t) => t.type === 'iframe' && t.url.startsWith('http://127.0.0.1:')),
      { timeoutMs: 15_000, label: 'preview iframe target' },
    );
    step('preview target live', previewTarget.url);

    const errors = problems.filter((p) => !/favicon/i.test(JSON.stringify(p)));
    if (errors.length > 0) throw new Error(`page errors during scenario: ${JSON.stringify(errors.slice(0, 5))}`);
    step('no page errors');
    return { steps, problems };
  } finally {
    session.close();
  }
}
