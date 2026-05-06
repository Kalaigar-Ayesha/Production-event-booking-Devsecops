## Vault secrets management (production)

This project is designed to **avoid hardcoding secrets** in Git. In Kubernetes, secrets are sourced from **HashiCorp Vault** and synced into the namespace using **External Secrets Operator (ESO)**.

### Architecture

- **Vault** is the source of truth for secrets (KV v2).
- **ESO** reads from Vault and creates/refreshes a Kubernetes Secret named `eventora-secrets`.
- Workloads (`api`, `mongo` init) reference the generated `eventora-secrets` at runtime.

### Prerequisites

- Vault installed and reachable from the cluster (example service DNS used in `k8s/03-vault-secretstore.yaml`):
  - `vault.vault.svc.cluster.local:8200`
- Vault KV v2 enabled at mount: `secret/`
- ESO installed in the cluster (CRDs present):
  - `SecretStore`
  - `ExternalSecret`
- Vault Kubernetes auth enabled and configured:
  - auth mount path: `kubernetes`
  - role: `eventora`
  - bound to the Kubernetes ServiceAccount: `eventora-api` in namespace `eventora`

### Vault secret data shape

Create these entries in Vault KV (v2):

- `secret/data/eventora/api`
  - `JWT_SECRET`
  - `EMAIL_USER` (optional)
  - `EMAIL_PASS` (optional)

- `secret/data/eventora/mongo`
  - `MONGO_ROOT_USERNAME`
  - `MONGO_ROOT_PASSWORD`
  - `MONGO_URI` (full connection string used by the API)

### Apply order

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/20-api.yaml              # creates ServiceAccount used by SecretStore auth
kubectl apply -f k8s/03-vault-secretstore.yaml
kubectl apply -f k8s/02-secrets.yaml           # ExternalSecret -> creates runtime Secret
kubectl apply -f k8s/10-mongo.yaml
kubectl apply -f k8s/30-web.yaml
kubectl apply -f k8s/40-ingress.yaml
kubectl apply -f k8s/90-networkpolicies.yaml
```

