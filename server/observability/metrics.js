const client = require('prom-client');

client.collectDefaultMetrics({
  prefix: 'eventora_',
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'eventora_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const authFailedLoginTotal = new client.Counter({
  name: 'eventora_auth_failed_login_total',
  help: 'Total failed login attempts',
  labelNames: ['reason'],
});

module.exports = {
  client,
  httpRequestDurationSeconds,
  authFailedLoginTotal,
};

