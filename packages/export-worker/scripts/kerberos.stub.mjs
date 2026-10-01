// Bundle-time stand-in for the optional native peer `kerberos` (T7.2 fix).
//
// `proxy-agent-negotiate` lazily `import('kerberos')` only for Negotiate proxy
// authentication. `kerberos` is a native module, so it can neither be installed
// as a portable dependency nor inlined into the single-file `vanilla-export.mjs`
// bundle. Without this alias Vite emits an unconditional
// `throw new Error('Could not resolve "kerberos" ...')` at the end of the
// bundle, which kills *every* real export job (only `--help`/early exits
// survived, which is why the old bundle test passed).
//
// This stub mirrors upstream semantics: importing succeeds, and only actual
// Negotiate-auth use throws — at the call site, not at worker startup.
export function initializeClient() {
  throw new Error(
    'export worker: "kerberos" is not bundled; Negotiate proxy authentication is unsupported. ' +
      'Plain and Basic proxy auth work without it.',
  );
}

export const GSS_MECH_OID_SPNEGO = undefined;
