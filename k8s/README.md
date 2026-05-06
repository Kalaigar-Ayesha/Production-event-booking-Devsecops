## Kubernetes deployment (Eventora)

This folder contains production-style Kubernetes manifests:

- **Deployments + Services**: `api`, `web`
- **StatefulSet + Service**: `mongo` (separate DB tier)
- **Ingress**: NGINX Ingress-compatible resource routing `/` and `/api`
- **ConfigMaps + Secrets**: configuration split from code
- **Security**:
  - NetworkPolicies (default deny + explicit allows)
  - Pod/container security contexts (non-root, drop capabilities, no privilege escalation)
  - Resource requests/limits

### Apply

1) Create the namespace and base resources:

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secrets.yaml
```

2) Deploy database + app:

```bash
kubectl apply -f k8s/10-mongo.yaml
kubectl apply -f k8s/20-api.yaml
kubectl apply -f k8s/30-web.yaml
```

3) Apply ingress and network policies:

```bash
kubectl apply -f k8s/40-ingress.yaml
kubectl apply -f k8s/90-networkpolicies.yaml
```

### Notes

- **Images**: update `IMAGE` fields in `20-api.yaml` and `30-web.yaml` to your registry tags.
- **Ingress controller**: install NGINX Ingress Controller in your cluster (e.g. it runs in namespace `ingress-nginx` by default).
- **Secrets**: `k8s/02-secrets.yaml` contains placeholder values. Replace them (or use an external secrets manager) before production.
