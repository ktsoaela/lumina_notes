# Kubernetes

Apply in order (or `kubectl apply -f k8s/`):

```bash
docker build -t lumina-notes:latest .
kubectl apply -f k8s/
```

Update `JWT_SECRET` in `config.yaml` before production. Point the Deployment `image` at your registry if the cluster cannot use a local tag.
