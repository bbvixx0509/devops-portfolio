# DevOps 포트폴리오

강원대학교 AI소프트웨어학과 지민구입니다.  
배포 파이프라인, 쿠버네티스 운영, 인프라 코드처럼 **개발자가 서비스를 안전하고 빠르게 내보내도록 돕는 일**에 관심이 있습니다. 팀 프로젝트에서 개발과 클라우드를 함께 맡으면서 운영 쪽에 비중을 두었고, 지켜야 할 규칙을 사람의 기억 대신 파이프라인과 코드에 넣는 작업을 해 왔습니다.

이 저장소에는 그 작업이 담긴 프로젝트 세 개를 모았습니다.

- **FoodiGuard**: 마이그레이션이 성공해야만 배포를 갱신하는 Jenkins 파이프라인을 구성했습니다. main에 합친 코드가 배포되지 않던 원인을 팀원과 함께 폴링 로그로 추적했고, 비밀값이 빌드 로그에 남지 않는지 확인하는 회귀 테스트 10개를 파이프라인에 넣었습니다.
- **FoodiGuard**: GKE에서 API 파드를 강제로 삭제하는 장애 실험으로 약 4초 정지를 확인해 기록했고, 이 결과가 API 복제본 2개 이상과 PodDisruptionBudget 적용으로 이어졌습니다. 콘솔에서 따로 관리하던 알림 정책은 Terraform 코드로 옮겼습니다.
- **NoDo**: 설정이 정해진 자원 경계와 다르면 서버가 시작하지 않게 했고, 인턴 이후 이 검사를 [Go CLI(`nodoctl`)](./Google%20Cloud%20기반%20수업%20운영%20플랫폼%20NoDo/tools/nodoctl)로 옮겨 배포 전에 실행하게 했습니다. 24개 설정 상황에서 백엔드와 판정이 같은지 테스트로 확인합니다.
- **KubeOps Copilot**: kind로 노드 3대짜리 로컬 클러스터를 코드로 구성하고 Helm으로 Prometheus를 설치했습니다. 운영 에이전트는 전용 ServiceAccount와 RBAC로 읽기와 `demo` 네임스페이스의 패치·스케일만 할 수 있게 제한했습니다. 이후 팀원과 함께, GitLab CI에서 테스트를 통과한 커밋만 `deploy` 브랜치로 올리고 Argo CD로 배포하는 구성을 더했습니다.

## 분야별로 보기

| 분야 | 한 일 | 프로젝트 | 확인할 곳 |
| --- | --- | --- | --- |
| CI/CD 파이프라인 | 마이그레이션 성공을 배포 조건으로 넣음, 폴링 문제 추적, Secret 로그 보호 회귀 테스트 | FoodiGuard | `Jenkinsfile`, `infra/tests/`, `docs/operations-rollout-2026-09-08.md` |
| GitOps 배포 | 테스트를 통과한 커밋만 `deploy` 브랜치로 올리고 Argo CD로 Sync (팀원과 함께) | KubeOps Copilot | `.gitlab-ci.yml`, `k8s/argocd/` |
| CLI 도구 개발 (Go) | 배포 전 설정 검사 CLI, 종료 코드로 파이프라인 단계에 연결 | NoDo | `tools/nodoctl/` |
| 쿠버네티스 운영 | GKE 배포 설정(HPA, PDB, Job, CronJob), Workload Identity, 장애 실험 | FoodiGuard | `k8s/`, `docs/sre-validation.md` |
| 쿠버네티스 환경 구성 | kind 클러스터, Helm, 전용 ServiceAccount와 RBAC, 장애 재현 시나리오 | KubeOps Copilot | `k8s/`, `scripts/`, `scenarios/` |
| 인프라 코드 | 알림 정책과 대시보드를 Terraform으로 관리, 프로젝트 의존 값 변수 분리 | FoodiGuard | `infra/gcp/terraform/` |
| 배포·운영 규칙 검사 | 설정이 경계와 다르면 시작 차단, 허용 목록·승인·RBAC로 조치 제한 | NoDo, KubeOps Copilot | `backend/app/core/config.py`, `kubeops_copilot/actions.py` |
| 관측성·검증 | Prometheus 메트릭과 알림, 부하 테스트, 평가 스크립트 | FoodiGuard, NoDo, KubeOps Copilot | `docs/observability.md`, `eval/` |
| 기술 문서 | 장애 실험, 성능 측정, 배포 과정, 자원 경계를 문서로 기록 | 세 프로젝트 | 각 프로젝트의 `docs/` |

## 프로젝트

### [GKE 기반 건강식 장바구니 분석 서비스 FoodiGuard](./GKE%20기반%20건강식%20장바구니%20분석%20서비스%20FoodiGuard)

식품 79,041건을 기반으로 영양·원재료·알레르기 분석과 대체식품 추천을 제공하는 모바일 서비스를 GKE와 Cloud SQL에 배포한 팀 프로젝트입니다.  
모바일 앱과 API는 팀원들과 함께 개발했습니다. 그중 저는 **쿠버네티스(GKE)와 GCP 플랫폼을 다루는 클라우드 운영**을 주로 맡았습니다. Jenkins 파이프라인, Terraform, Managed Prometheus 알림을 갖추고, 쓰이지 않던 인덱스를 고쳐 기본 목록 응답을 361ms에서 24ms로 줄인 과정과 부하 테스트·장애 실험 기록을 담았습니다.

### [Google Cloud 기반 수업 운영 플랫폼 NoDo](./Google%20Cloud%20기반%20수업%20운영%20플랫폼%20NoDo)

React → FastAPI(Cloud Run) → Firestore·Cloud Storage·Vertex AI 구조로 만든 AI 수업 로드맵·실시간 강의 운영 플랫폼으로, 인턴십 기간에 진행한 Google Cloud 산학 프로젝트입니다.  
팀원 1명과 백엔드·클라우드를 함께 맡았고, **자원 경계, 최소 권한, 배포 구성**을 주로 맡았습니다. 서버의 시작 검사는 배포한 뒤에야 실패를 알 수 있어서, 인턴 이후에는 같은 검사를 배포 전에 실행하는 Go CLI도 만들었습니다.

### [Kubernetes 운영 지원 AI 에이전트 KubeOps Copilot](./Kubernetes%20운영%20지원%20AI%20에이전트%20KubeOps%20Copilot)

운영자의 자연어 질문에 클러스터 상태와 지표, 런북을 근거로 원인과 조치를 제안하고, 승인된 조치만 실행한 뒤 결과를 검증하는 에이전트입니다. 강원대학교 클라우드캡스톤디자인2의 팀 프로젝트입니다.  
이 프로젝트에서는 **에이전트 백엔드와 로컬 쿠버네티스 환경**을 주로 맡아 첫 버전을 만들었고, 이후 팀원과 함께 GitLab CI와 Argo CD 연동을 더했습니다.

## 사용 기술

- 쿠버네티스: `GKE Autopilot`, `kind`, `Helm`, `HPA`, `PodDisruptionBudget`, `RBAC`
- CI/CD: `Jenkins`, `GitLab CI`, `Argo CD`, `GitHub Actions`
- 인프라 코드: `Terraform`
- 클라우드: `GCP (GKE, Cloud Run, Cloud SQL, Artifact Registry, Firestore, Cloud Storage, Cloud Monitoring)`
- 관측성: `Prometheus`, `Managed Prometheus`, `k6`
- 언어: `Go`, `Python`, `JavaScript`, `TypeScript`, `Shell`
- 서비스: `FastAPI`, `Node.js (Express)`, `React`, `React Native (Expo)`, `PostgreSQL`, `LangGraph`

## 정리 방식

- 세 프로젝트 모두 팀 프로젝트라, 각 README의 `내가 맡은 역할`에 제가 주로 맡은 영역과 팀원과 함께 한 일을 구분해 적었습니다.
- 원본은 각 팀 저장소에서 개발했고, 이 저장소에는 정리한 사본을 올렸습니다. 그래서 커밋 기록은 원본과 다릅니다.
- 클라우드 프로젝트 ID와 번호, 외부 IP, 이메일, 알림 채널·정책 ID, 팀 저장소 주소, 협력 기업의 조직 정보처럼 공개되면 안 되는 값은 예시 값으로 바꾸거나 제외했습니다. API 키와 비밀번호 같은 비밀값은 저장소에 들어 있지 않습니다.
- 다른 프로젝트는 [개발 포트폴리오 저장소](https://github.com/bbvixx0509/portfolio)에 있습니다.
