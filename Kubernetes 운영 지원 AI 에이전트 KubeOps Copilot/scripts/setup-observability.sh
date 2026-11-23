#!/usr/bin/env bash
# 기존 kind와 Prometheus에 Grafana 및 수동 동기화 Argo CD를 추가한다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
k=(kubectl --context kind-kubeops)
h=(helm --kube-context kind-kubeops)
"${k[@]}" -n monitoring get svc prometheus-server >/dev/null
"${k[@]}" -n demo get deployment api web >/dev/null

"${k[@]}" -n monitoring create configmap kubeops-grafana-dashboard \
  --from-file=demo-api.json=k8s/monitoring/demo-api.json --dry-run=client -o yaml | "${k[@]}" -n monitoring apply -f -

"${h[@]}" upgrade --install grafana grafana --repo https://grafana-community.github.io/helm-charts \
  --version 14.5.0 -n monitoring -f k8s/monitoring/grafana-values.yaml --wait --timeout 18m
"${h[@]}" upgrade --install argocd argo-cd --repo https://argoproj.github.io/argo-helm \
  --version 10.18.1 -n argocd --create-namespace -f k8s/argocd/values.yaml --wait --timeout 18m

key="${KUBEOPS_ARGO_DEPLOY_KEY:-$ROOT/.kube/argocd-gitlab-demo-readonly}"
if [[ -r "$key" ]]; then
  "${k[@]}" -n argocd create secret generic kubeops-demo-gitlab-repository \
    --from-literal=type=git --from-literal=project=kubeops-demo \
    --from-literal=url=ssh://git@gitlab.com/example-group/kubeops-copilot.git \
    --from-file="sshPrivateKey=$key" --dry-run=client -o yaml |
    kubectl label --local -f - argocd.argoproj.io/secret-type=repository -o yaml |
    "${k[@]}" -n argocd apply --server-side --field-manager=kubeops-setup -f -
elif [[ -n "${KUBEOPS_ARGO_DEPLOY_KEY:-}" ]]; then
  echo '지정한 읽기 전용 개인 키를 열 수 없습니다.' >&2
  exit 1
else
  echo '비공개 저장소용 Deploy key는 운영 가이드에 따라 연결하세요.' >&2
fi
"${k[@]}" apply -f k8s/argocd/demo.yaml
"${k[@]}" apply -f k8s/argocd/viewer-rbac.yaml
