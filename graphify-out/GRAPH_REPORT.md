# Graph Report - messaging-gateway-mcp  (2026-07-13)

## Corpus Check
- 11 files · ~2,339 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 82 nodes · 85 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ff525556`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 10 edges
2. `Instagram DM → Agent V3: План интеграции` - 8 edges
3. `scripts` - 6 edges
4. `handleInboundMessage()` - 6 edges
5. `3. Этапы реализации` - 5 edges
6. `_ig_get()` - 4 edges
7. `instagram_insights()` - 3 edges
8. `instagram_media()` - 3 edges
9. `instagram_followers()` - 3 edges
10. `getToken()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `handleWebhook()` --calls--> `verifySignature()`  [EXTRACTED]
  src/webhook-handler.ts → src/webhook-security.ts

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (16): 1. Текущее состояние, 2. Архитектура, 3. Этапы реализации, 4. MCP инструменты, 5. Технические детали, 6. Риски, 7. Следующие шаги, Agent V3: (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.22
Nodes (12): app, pool, getReply(), getToken(), handleInboundMessage(), handleWebhook(), isWithin24h(), pool (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, outDir, resolveJsonModule, rootDir, skipLibCheck (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (8): _ig_get(), instagram_followers(), instagram_insights(), instagram_media(), MCP Instagram — FastMCP (streamable-http)., Instagram insights: reach, views, accounts_engaged. NOT impressions (removed fro, Recent Instagram posts: id, caption, permalink, media_type, like_count, comments, Instagram account info: username, followers_count, media_count.

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (7): dependencies, dotenv, express, pg, name, private, version

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (6): devDependencies, tsx, @types/express, @types/node, @types/pg, typescript

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): scripts, build, dev, migrate, start, subscribe

## Knowledge Gaps
- **43 isolated node(s):** `name`, `version`, `private`, `build`, `start` (+38 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `Community 6` to `Community 4`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 5` to `Community 4`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `MCP Instagram — FastMCP (streamable-http).`, `Instagram insights: reach, views, accounts_engaged. NOT impressions (removed fro`, `Recent Instagram posts: id, caption, permalink, media_type, like_count, comments` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._