## TLS certificates for local/prod simulation

This directory is intentionally **empty in Git** (no private keys committed).

For local testing you can generate a self-signed certificate:

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout nginx/certs/tls.key \
  -out nginx/certs/tls.crt \
  -subj "/CN=localhost"
```

Then start the stack and access:

- `https://localhost/`
- `https://localhost/api/`

