---
name: browser-automation
description: Automates a browser session to extract data from a web page. Maintains session state across interactions with heartbeat monitoring.
allowed-tools:
  - playwright
  - write_file
execution:
  type: stateful_session
  retry: 2
  heartbeat_interval: 30
---
# Browser automation

## Workflow

1. Launch a playwright browser session and navigate to the target URL
2. Wait for the page to fully load and check that the expected content is visible
3. Extract the data from the page by scraping the target elements
4. Take a screenshot for verification
5. Close the playwright browser session
6. Use write_file to save the extracted data to results.json
