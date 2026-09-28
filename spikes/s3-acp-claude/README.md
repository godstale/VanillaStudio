# S3 — Rust ACP 클라이언트로 Claude Code 구동

PoC 결과: `wiki/sources/poc-s3.md`

## 구성

- `src/main.rs` (`acp-probe`): `agent-client-protocol` 2.2.0 클라이언트.
  - 권한 정책(D-010): 프로젝트 안 파일 작업은 자동 허용, 셸·네트워크는 "사용자 거부"를 가정해 응답, 프로젝트 밖은 거부.
  - fs 요청을 처리하고, 모든 이벤트를 `out/session.jsonl`에 기록.
  - 시나리오: `shell-write`, `fs`, `shell`, `outside`, `mcp`, `cancel`(6초 뒤 `session/cancel`).
- `mcp-server.mjs`: stdio MCP 대역(`vanilla_ping`)
- `mcp-http-server.mjs`: Streamable HTTP MCP 대역(127.0.0.1, Bearer 토큰)
- `summarize.mjs`: 세션 로그에서 핵심 이벤트만 추려 출력
- `sandbox/`: 가짜 사용자 프로젝트(cwd), `outside.txt`: 프로젝트 밖 파일

## 실행

```powershell
pnpm install --ignore-workspace   # @agentclientprotocol/claude-agent-acp 0.83.0, @modelcontextprotocol/sdk, zod
cargo build
$env:VANILLA_STRICT = '1'          # 사용자 전역 설정 격리 + 셸 ask 규칙
target/debug/acp-probe.exe all     # 또는 fs | shell | shell-write | outside | mcp | cancel
node summarize.mjs out/session.jsonl

# HTTP MCP
$env:VANILLA_MCP_TOKEN = '<random>'; node mcp-http-server.mjs   # 별도 창
$env:VANILLA_MCP_HTTP = 'http://127.0.0.1:47811/mcp'; target/debug/acp-probe.exe mcp
```

Claude Code에 로그인되어 있어야 한다. 실행하면 구독 사용량을 쓴다(격리 모드 전체 시나리오 약 $0.07).
