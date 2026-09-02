# DevOps процес

Web Course Dashboard използва автоматизиран процес от създаването на промяна
до проверката ѝ в Kubernetes. Основната конфигурация е в
`.github/workflows/ci.yml`.

## Phases of SDLC

Работата по проекта е разделена на отделни задачи. Всяка по-голяма промяна се
разработва във feature branch, проверява се локално и след това се изпраща в
GitHub.

```text
Issue
  -> feature branch
  -> разработка
  -> тестове
  -> push
  -> GitHub Actions
  -> Pull Request
  -> merge
```

След успешните проверки промените се сливат в `develop`. Завършената версия се
слива в `main` и е маркирана с tag `v1.0.0`.

## Collaborate

GitHub Issues се използват за описване на задачите, а Pull Requests — за
преглед и сливане на промените. Във всеки Pull Request се виждат както
променените файлове, така и резултатът от GitHub Actions.

## Source control

Кодът и конфигурацията се съхраняват в GitHub:

```text
https://github.com/nyotova19/web-course-dashboard
```

Repository-то съдържа приложението, тестовете, pipeline конфигурацията,
Docker файловете, Kubernetes manifests, SQL файловете и документацията.

Локалните `.env` и `k8s/secret.yaml` са изключени чрез `.gitignore`.

## Branching strategies

Използвани са следните branches:

- `main` — завършената версия;
- `develop` — общ branch за интеграция;
- `feature/*` — разработка на нова част;
- `fix/*` — поправка.

По време на проекта са използвани:

```text
feature/github-actions
feature/automated-tests
feature/security-scanning
feature/kubernetes-deployment
feature/documentation
```

Така всяка част от DevOps процеса е разработена и проверена отделно.

## Building Pipelines

GitHub Actions workflow-ът се стартира при:

- push към `main`;
- push към `develop`;
- push към `feature/**`;
- push към `fix/**`;
- Pull Request към `main` или `develop`;
- ръчно стартиране с `workflow_dispatch`.

Jobs са свързани в следния ред:

```text
validate ─┐
test ─────┼─> Docker build and Trivy scan ─> Kubernetes deployment
sast ─────┘
```

Docker image се изгражда, след като validation, PHPUnit и Semgrep приключат
успешно.

## Continuous Integration

### Validate and scan PHP

Първият job изпълнява:

```text
composer validate
composer install
php -l
composer audit
docker compose config --quiet
```

Така се проверяват Composer конфигурацията, PHP синтаксисът, използваните
dependencies и Docker Compose файлът.

### Run unit tests

PHPUnit изпълнява тестовете от:

```text
backend/tests/RouterTest.php
backend/tests/JwtTest.php
```

Тестовете проверяват router логиката и работата с JWT. Текущият резултат е:

```text
4 tests, 10 assertions
```

### SAST with Semgrep

Semgrep анализира PHP файловете в:

```text
backend/src
backend/public
```

Използваната команда е:

```text
semgrep scan --config auto --error backend/src backend/public
```

При security finding job-ът приключва с грешка и Docker build не се стартира.

## Continuous Delivery

След успешните CI проверки pipeline-ът:

1. изгражда application Docker image;
2. сканира image-а с Trivy;
3. създава Kind Kubernetes cluster;
4. зарежда application image-а в cluster-а;
5. валидира Kubernetes конфигурацията;
6. създава временни Secrets;
7. прилага Kustomize конфигурацията;
8. изчаква MariaDB StatefulSet и application Deployment;
9. извиква `/api/health`.

Deployment job-ът проверява, че изграденото приложение може да бъде стартирано
с Kubernetes конфигурацията от repository-то.

## Security

В проекта са използвани няколко проверки:

- Composer Audit за PHP dependencies;
- Semgrep за статичен анализ на PHP кода;
- Trivy за Docker image;
- JWT за authentication;
- bcrypt за паролите;
- роли за студент и преподавател;
- PDO prepared statements за SQL заявките;
- Kubernetes Secret за чувствителните настройки.

### SAST deep dive

При първото изпълнение Semgrep откри проблем в pagination заявката в
`ReportsController.php`. Стойностите за `LIMIT` и `OFFSET` участваха в
създаването на SQL текста.

Заявката беше променена да използва placeholders:

```sql
LIMIT ? OFFSET ?
```

Стойностите се подават отделно като цели числа:

```php
$stmt->bindValue($position, $value, PDO::PARAM_INT);
```

По този начин query параметрите се обработват като стойности, а не като част
от SQL заявката.

Semgrep отчете и `tainted-callable` finding при PDO `prepare()`. Data flow-ът
беше проверен и за конкретното правило е добавен rule-specific `nosemgrep`.
Останалите Semgrep правила продължават да се изпълняват.

След поправката SAST job-ът премина успешно, без да бъде изключван scanner-ът.

### Dependency scanning

Composer Audit откри advisory за използваната версия на `firebase/php-jwt`.
Пакетът беше обновен, а актуалната версия беше записана в `composer.lock`.

### Container scanning

След Docker build Trivy проверява operating system и library пакетите за
`HIGH` и `CRITICAL` уязвимости.

```text
vulnerability types: os, library
severity: HIGH, CRITICAL
exit code: 1
```

При такава находка Kubernetes deployment не се стартира.

### Secrets

В repository-то има само примерни конфигурации:

```text
.env.example
k8s/secret.example.yaml
```

При локално стартиране се създават `.env` и `k8s/secret.yaml`. В GitHub
Actions database паролите и JWT secret се генерират с `openssl rand`.

## Docker

Docker Compose стартира:

- PHP-FPM;
- Nginx;
- MariaDB.

Nginx обслужва frontend файловете и изпраща `/api` заявките към PHP-FPM.
MariaDB използва named volume за данните.

`backend/Dockerfile` създава application image, който съдържа:

- PHP 8.3;
- PHP-FPM;
- Nginx;
- Supervisor;
- REST API;
- frontend файловете;
- Composer dependencies.

## Kubernetes

Kubernetes ресурсите са в `k8s/` и се прилагат чрез `kustomization.yaml`.

Използвани са:

- namespace `web-course`;
- ConfigMap;
- Secret;
- MariaDB StatefulSet;
- PersistentVolumeClaim;
- application Deployment;
- два ClusterIP Services;
- startup, readiness и liveness probes;
- resource requests и limits.

Application Deployment стартира две реплики.

```yaml
replicas: 2
```

Rolling update конфигурацията е:

```yaml
maxUnavailable: 0
maxSurge: 1
```

При update Kubernetes стартира нов pod и изчаква readiness probe, преди да
спре старата реплика.

Приложението може да бъде мащабирано с:

```powershell
kubectl -n web-course scale deployment/web-course-dashboard --replicas=3
```

## Infrastructure as code

Конфигурацията на средата е част от repository-то:

| Файл | Съдържание |
|---|---|
| `.github/workflows/ci.yml` | GitHub Actions pipeline |
| `backend/Dockerfile` | Application image |
| `docker-compose.yml` | Локална среда |
| `k8s/*.yaml` | Kubernetes ресурси |
| `kustomization.yaml` | Общо Kubernetes deployment описание |
| `mariadb-init/*.sql` | Database структура и начални данни |

Docker и Kubernetes средите се създават от тези файлове.

## Database changes

Database структурата и тестовите данни са разделени в два файла:

```text
mariadb-init/01-schema.sql
mariadb-init/02-seed.sql
```

`01-schema.sql` създава таблиците. `02-seed.sql` добавя потребители и примерни
данни за теми, домашни работи, реферати и презентации.

Файловете се изпълняват по име при първото стартиране на MariaDB върху празен
volume.

## T-shaped / E-shaped solution

Хоризонталната част обхваща целия път на промяната:

```text
Git -> CI -> tests -> security scanning -> Docker -> Kubernetes
```