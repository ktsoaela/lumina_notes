# Kubernetes

Cluster manifests live in the main repo under [`k8s/`](../k8s/).

## Apply

```bash
# Build and load the image into your cluster runtime first, e.g.:
docker build -t lumina-notes:latest .

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/config.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
```

## Secrets

Edit `k8s/config.yaml` and set a strong `JWT_SECRET` before production use. Prefer sealed secrets or an external secret manager in real environments.

## Ingress

The sample Ingress uses host `lumina-notes.local` and class `nginx`. Change host and class to match your cluster.

## Persistence

SQLite is stored on a PVC (`lumina-notes-data`). For multi-replica setups, switch to a networked database; SQLite is single-writer.
