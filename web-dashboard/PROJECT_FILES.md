# Project files reference — Web Course Dashboard

This document lists the main files and folders in the project and describes their purpose.

## Top-level

- **`docker-compose.yml`**: Defines the multi-container setup used in development: a PHP service built from `backend/`, an `nginx` service serving the frontend and proxying to PHP-FPM, a `mongo` service (with `mongo-init/seed.js` mounted to initialize data) and `mongo-express` for a web UI. Exposes ports `8080` (frontend) and `8081` (mongo-express). Environment variables for DB and JWT are set here.
- **`README.md`**: Project overview, quick start instructions, API summary and endpoints, test accounts and project structure.
- **`.env.example`**: Example environment variables used by the backend: `APP_ENV`, `MONGO_URI`, `MONGO_DB`, `JWT_SECRET`.
- **`.gitlab-ci.yml`**: CI pipeline configuration for lint/test/build/deploy stages. Shows how images are built and pushed and which variables the CI expects.
- **`.gitignore`**: Files and folders excluded from version control (notably `backend/vendor/` and `.env`).

## Docker config

- **`docker/nginx.conf`**: Nginx virtual host used inside the `nginx` container. Serves static frontend files from `/var/www/frontend` and proxies `/api/` requests to PHP-FPM at `php:9000`. Adds permissive CORS headers used during development.

## Mongo initialization

- **`mongo-init/seed.js`**: JavaScript seed script executed by the official MongoDB image on first container start. Creates indexes, inserts two test users (`teacher@uni.bg`, `student@uni.bg`), topics, homework records, reports, presentation sessions and slots. Note: seeds run only when the `mongo_data` volume is empty.

## Frontend (SPA)

- **`frontend/index.html`**: Single-page application shell (Bulgarian UI). Contains markup for login screen, dashboard, tab panels, and loads `js/app.js`.
- **`frontend/js/app.js`**: Main frontend logic. Provides:
  - `Config`, `State` objects and `Api` helpers for communicating with `/api` endpoints.
  - Modal and toast utilities, tag-input widget, client-side routing and tab modules.
  - Tab implementations (reports, sessions, homework, etc.) and UI rendering.
  - Uses JWT token stored in `State.token` and attaches `Authorization: Bearer <token>` to API requests.
- **`frontend/css/style.css`**: Visual styles for the SPA: layout, components, badges, forms, tables, and responsive rules.

## Backend (PHP)

Structure: `backend/` contains the PHP project. Backend is a small custom REST API (no framework) that uses PSR-4 autoloading (`App\` → `src/`). Key files:

- **`backend/Dockerfile`**: Builds the PHP-FPM image using `php:8.3-fpm-alpine`, installs the MongoDB PHP extension via PECL, and installs Composer. Copies the project into `/var/www/html` and runs `composer install` (ignoring ext-mongodb platform requirement in the container during image build).
- **`backend/composer.json`**: PHP dependencies and autoload config. Requires `mongodb/mongodb`, `firebase/php-jwt` and `vlucas/phpdotenv`.
- **`backend/public/index.php`**: API entry point. Bootstraps Composer autoload, loads `.env` (if present), registers routes with the `Router`, and dispatches requests. Also defines a simple `/api/health` route.

### Config

- **`backend/src/Config/Database.php`**: MongoDB connection helper. Reads `MONGO_URI` and `MONGO_DB` from environment variables and exposes a singleton `Database::get()` returning a `MongoDB\\Database` instance.

### Routing

- **`backend/src/Routes/Router.php`**: Minimal router implementation. Register routes via `add(method, pattern, handler)` where pattern supports `{param}` placeholders. Converts patterns to regex, matches requests and dispatches to controller methods or closures.

### Middleware

- **`backend/src/Middleware/AuthMiddleware.php`**: JWT helpers and guards. Exposes:
  - `require()` — validates `Authorization: Bearer <token>` header and returns decoded payload.
  - `requireRole($role)` — ensures the current user has the given role (or is `teacher`).
  - `generate($payload)` — creates JWT tokens using `JWT_SECRET` from env.

### Controllers

- **`backend/src/Controllers/BaseController.php`**: Shared helpers for controllers: `json()` response helper, `body()` to parse JSON request body, `objectId()` to safely create `MongoDB\\BSON\\ObjectId`, and helpers to convert BSON documents to PHP arrays and format dates.
- **`backend/src/Controllers/AuthController.php`**: Handles authentication endpoints:
  - `POST /api/auth/register` — register new user (student or teacher), hash password, insert user, return JWT + user object.
  - `POST /api/auth/login` — validate credentials and return JWT + user object.
  - `GET /api/auth/me` — return current user information from token.
- **`backend/src/Controllers/DashboardController.php`**: `GET /api/dashboard` — returns aggregated stats. Behavior differs for `student` (personal stats: reports, homework progress, upcoming deadlines, next presentation) and `teacher` (course-wide stats).
- **`backend/src/Controllers/TopicsController.php`**: CRUD for topics (`/api/topics`). Teachers can create/update/delete; all authenticated users can list and view topics.
- **`backend/src/Controllers/ReportsController.php`**: CRUD + listing for reports (`/api/reports`). Supports filtering by tag, status, search, pagination. Students see only their own reports by default; `?scope=all` returns all if permitted. Teachers can grade and edit any report.
- **`backend/src/Controllers/HomeworkController.php`**: Homework definitions and submissions (`/api/homework`). Teachers manage homework; students can submit and view their submission status. Grading endpoints available for teachers.
- **`backend/src/Controllers/PresentationsController.php`**: Manages presentation sessions and slots (`/api/presentations/*`). Teachers create sessions and auto-generate slots; students can book/cancel slots. Teachers can update slot status.

## Dependencies / Vendor

- **`backend/vendor/`**: Composer-installed packages. Not documented file-by-file — standard Composer layout. Excluded from git and large; see `backend/composer.json` for dependency list.

## Notes & usage

- Running the project (development):
  ```powershell
  cp .env.example .env
  docker compose up -d --build
  ```
- Access points:
  - Frontend: http://localhost:8080
  - API health: http://localhost:8080/api/health
  - Mongo UI (mongo-express): http://localhost:8081  (user: `admin` / pass: `admin123`)
- The seed script runs only on first Mongo startup. To re-run it, remove the `mongo_data` volume and start containers again (warning: this deletes DB data):
  ```powershell
  docker compose down -v
  docker compose up -d --build
  ```

---

If you want, I can:
- Add this file to the repository (already created), or move it to `docs/`.
- Generate a per-file deeper analysis (e.g. explain each controller method line-by-line).

File created: `PROJECT_FILES.md`
