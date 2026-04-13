---
name: cron-log-writer
description: Appends a timestamped line to log.txt. Used for cron durability certification.
allowed-tools:
  - write
  - read
execution:
  type: side_effect_mutation
  retry: 3
  idempotency:
    key: "timestamp+sequence"
---
# Cron log writer

## Workflow

1. Read the current sequence number from log.txt (or start at 1 if the file doesn't exist)
2. Generate a timestamped line: `{sequence} | {ISO timestamp} | OK`
3. Append the line to log.txt using write
4. Increment the sequence number
