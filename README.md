# Production-ready 3-tier DevOps platform

A real 3-tier application (React → FastAPI → Postgres) deployed to a
Kubernetes cluster with a full CI/CD pipeline.

```
frontend (React + Nginx)  --->  backend (FastAPI)  --->  database (Postgres)
   [externally reachable]         [internal only]          [internal only]
```

Only the frontend is exposed outside the cluster. The backend and
database are only reachable from inside — the same pattern real
production systems use to shrink the attack surface.

## Stage 1 — Run all 3 tiers locally

```bash
docker compose up --build
```

Visit `http://localhost:8080`. The React app calls `/api/*`, which
nginx forwards to the backend container, which talks to Postgres —
the exact same request path production will use.

## Stage 2 — Run backend tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

## Stage 3 — Push to GitHub

```bash
git init
git add .
git commit -m "Production-ready 3-tier platform"
git branch -M main
git remote add origin https://github.com/Kan6380/production-ready-3tier-devops-platform.git
git push -u origin main
```

## Stage 4 — Set up Docker Hub secrets

1. Docker Hub → Account Settings → Security → New Access Token
2. GitHub repo → Settings → Secrets and variables → Actions, add:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

## Stage 5 — Set up a self-hosted GitHub Actions runner

Hosted GitHub runners can't reach your homelab's private IPs, so the
`deploy` job needs a runner living on your network (your Windows
machine or `k8s-master` both work).

On GitHub: repo → Settings → Actions → Runners → New self-hosted
runner, then follow the generated setup script on that machine. Make
sure `kubectl` on that machine is configured to reach your cluster.

## Stage 6 — Prepare the cluster (one-time)

```bash
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=taskuser \
  --from-literal=POSTGRES_PASSWORD=<pick-a-real-password> \
  --from-literal=POSTGRES_DB=taskdb

kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl get pods -w   # wait for postgres to be Running/Ready
```

Edit `k8s/backend-deployment.yaml` and `k8s/frontend-deployment.yaml`,
replacing `YOUR_DOCKERHUB_USERNAME` with your real username, then:

```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl get pods -w
```

Visit `http://<any-node-ip>:30081` — same NodePort pattern as your
earlier nginx test.

## Stage 7 — Prove the full pipeline

Change something in `frontend/src/App.jsx` or `backend/app/main.py`,
push to `main`, and watch the Actions tab run: test → build both
images → push to Docker Hub → deploy to your cluster. Refresh the
site and confirm the change is live.

## What makes this "production-shaped" rather than a toy

- Backend and database are **not** reachable from outside the cluster
  — only the frontend is
- Every deployment has **resource requests/limits** and
  **readiness/liveness probes**
- Backend runs **2 replicas**; rolling updates mean no downtime on
  deploy
- Secrets are **not committed to git** — created directly on the
  cluster
- Containers run **as non-root** (both Dockerfiles)
- CI runs tests before anything gets built or pushed

## Where to go next

- Swap `kubectl set image` in CI for **Argo CD** (GitOps: the cluster
  pulls changes instead of CI pushing them)
- Add an **Ingress controller** so the frontend has a real hostname
  instead of a NodePort
- Add **Prometheus + Grafana** for metrics, and centralized logging
- Add a **HorizontalPodAutoscaler** on the backend and frontend
