#!/usr/bin/env bash
# Copilot 전용 ServiceAccount 토큰으로 kubeconfig를 만든다.
# 에이전트는 관리자 권한이 아니라 이 파일의 제한된 권한으로만 클러스터에 접근한다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CTX="${KUBE_CONTEXT:-kind-kubeops}"
OUT="$ROOT/.kube/agent.kubeconfig"
mkdir -p "$ROOT/.kube"

TOKEN=""
for _ in $(seq 1 30); do
  TOKEN=$(kubectl --context "$CTX" -n kubeops get secret kubeops-copilot-token \
    -o jsonpath='{.data.token}' 2>/dev/null | base64 -d || true)
  [ -n "$TOKEN" ] && break
  sleep 1
done
[ -n "$TOKEN" ] || { echo "토큰을 가져오지 못했어요" >&2; exit 1; }

SERVER=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name==\"$CTX\")].cluster.server}")
CA=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name==\"$CTX\")].cluster.certificate-authority-data}")

umask 077
cat > "$OUT" <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: kubeops
    cluster:
      server: $SERVER
      certificate-authority-data: $CA
users:
  - name: kubeops-copilot
    user:
      token: $TOKEN
contexts:
  - name: kubeops-agent
    context:
      cluster: kubeops
      user: kubeops-copilot
      namespace: demo
current-context: kubeops-agent
EOF

echo "==> Copilot 권한 확인"
printf "  demo Pod 조회           : "; kubectl --kubeconfig "$OUT" auth can-i list pods -n demo || true
printf "  demo Deployment 스케일  : "; kubectl --kubeconfig "$OUT" auth can-i patch deployments/scale -n demo || true
printf "  kube-system Pod 삭제    : "; kubectl --kubeconfig "$OUT" auth can-i delete pods -n kube-system || true
printf "  Secret 조회             : "; kubectl --kubeconfig "$OUT" auth can-i get secrets -n demo || true
