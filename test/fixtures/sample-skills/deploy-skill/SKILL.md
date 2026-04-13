---
name: deploy-service
description: Deploys a service to production. Checks health, decides rollout strategy, then applies. Requires human approval before applying destructive changes.
allowed-tools:
  - bash
  - read_file
  - write_file
execution:
  type: critical_transaction
  retry: 1
  hitl: required
  compensation: rollback_deployment
---
# Deploy service

## Workflow

1. Read the current deployment manifest from deployment.yaml using read_file
2. Run `bash` to check the current service health and error rate metrics
3. Decide the rollout strategy based on error rate: canary if above 1%, blue-green if below
4. Write the updated deployment plan to deploy-plan.yaml using write_file
5. Run `bash` to apply the deployment: `kubectl apply -f deploy-plan.yaml`
6. Run `bash` to verify the deployment rolled out successfully: `kubectl rollout status`
