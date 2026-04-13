---
name: data-pipeline
description: Reads data from a source, transforms it, and writes the result. Uses the tenure metadata encoding for agentskills.io compatibility.
allowed-tools:
  - read_file
  - write_file
metadata:
  tenure.execution_type: side_effect_mutation
  tenure.retry: "3"
  tenure.idempotent: "true"
  tenure.idempotency_key: pipeline_run_id
  tenure.hitl: none
  tenure.thinking_cost: low
---
# Data pipeline

## Workflow

1. Use read_file to read the raw CSV data from input.csv
2. Parse the CSV rows and filter out any rows with missing required fields
3. Transform each valid row: normalize column names, convert date formats to ISO 8601
4. Use write_file to write the cleaned data to output.csv
5. Use write_file to append a summary line to pipeline-log.txt with row counts
