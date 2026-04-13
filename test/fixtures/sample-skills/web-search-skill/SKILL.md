---
name: web-search
description: Searches the web for a given query and returns the top results. Safe to retry indefinitely.
allowed-tools:
  - web_search
  - exa_search
execution:
  type: idempotent_read
  retry: 5
  cache:
    ttl: 300
---
# Web search

## Workflow

1. Use web_search to search for the given query
2. Filter results to the top 5 most relevant entries
3. Return the results with title, url, and snippet for each
