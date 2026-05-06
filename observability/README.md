## Monitoring, logging, and alerting

### Start observability stack

```bash
docker compose -f observability/docker-compose.observability.yml up -d
```

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (admin/admin)
- **Elasticsearch**: `http://localhost:9200`
- **Kibana**: `http://localhost:5601`

### Metrics shown (Grafana dashboard)

- CPU usage
- Requests per second (API)
- Failed login attempts

### Alerting (Grafana)

Provisioned rules live in:

- `observability/grafana/provisioning/alerting/alert-rules.yaml`

### Failed deployment alerts

Grafana alert rule `Failed deployments (Pushgateway)` expects Jenkins to publish a metric to Pushgateway.

Set Jenkins env var:

- `PUSHGATEWAY_URL=http://pushgateway:9091`

