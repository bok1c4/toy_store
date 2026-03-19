The key insight from the docs: always start a new session per phase. OpenCode's compaction is good but accumulated tool call history from Phase 1 will still eat tokens during Phase 6. Clean sessions keep Kimi focused.

# Manually running seed.sql

`docker compose exec db psql -U toystore_user -d toystore -f /docker-entrypoint-initdb.d/seed.sql`
