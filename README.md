# task-tracker-3tier-devops platform

A real 3-tier application (React → FastAPI → Postgres) deployed to a
self-hosted Kubernetes homelab cluster with a full CI/CD pipeline

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
git commit -m "task-tracker-3tier-devops"
git branch -M main
git remote add origin https://github.com/Kan6380/task-tracker-3tier-devops.git
git push -u origin main
```

## Stage 4 — Set up Docker Hub secrets

1. Docker Hub → Account Settings → Security → New Access Token
2. GitHub repo → Settings → Secrets and variables → Actions, add:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

## Stage 5 — Set up a self-hosted GitHub Actions runner

Hosted GitHub runners can't reach a private homelab network, so the
`deploy` job needs a runner living inside it. It works by making an
**outbound** connection to GitHub and listening for jobs, no inbound
access into your network required.

Register it on a **worker node**, not the control plane, to avoid
competing with etcd/API server for resources:

```bash
# on the worker node
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-<version>.tar.gz -L <download-url-from-github>
tar xzf ./actions-runner-linux-x64-<version>.tar.gz
./config.sh --url https://github.com/<you>/<repo> --token <token-from-github>
sudo ./svc.sh install
sudo ./svc.sh start
```

Copy a working kubeconfig onto that same worker node so `kubectl`
inside the runner can actually reach the cluster:

```bash
scp ~/.kube/config <user>@<worker-ip>:~/.kube/config
```

## Stage 6 — Prepare the cluster (one-time)

**Install a StorageClass first.** A bare `kubeadm` cluster has no
default storage provisioner (cloud-managed Kubernetes gives you this
for free), so PVCs will get stuck in `Pending` without it:

```bash
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.30/deploy/local-path-storage.yaml
kubectl patch storageclass local-path -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

Then:

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

Visit `http://<any-node-ip>:30081`.

## Stage 7 — Prove the full pipeline

Change something in `frontend/src/App.jsx` or `backend/app/main.py`,
push to `main`, and watch the Actions tab run: test → build both
images → push to Docker Hub → deploy to your cluster. Refresh the
site and confirm the change is live.

**Note:** rolling updates on limited homelab hardware can take
longer than you'd expect, if `deploy` times out even though pods
end up healthy, it's likely just the default 120s rollout timeout
being too tight, not a real failure. Bump it up in the workflow file
if needed.

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
- Fully automated end-to-end pipeline, including deployment via a
  self-hosted runner

## Where to go next

- Add **centralized logging** (Loki + Grafana), by default, crashed
  container logs get garbage-collected and are lost for good
- Add **metrics-server** and basic dashboards, useful for diagnosing
  slow rollouts or resource pressure
- Swap `kubectl set image` in CI for **Argo CD** (GitOps: the cluster
  pulls changes instead of CI pushing them)
- Add an **Ingress controller** so the frontend has a real hostname
  instead of a NodePort
- Add **Prometheus + Grafana** for metrics
- Add a **HorizontalPodAutoscaler** on the backend and frontend
