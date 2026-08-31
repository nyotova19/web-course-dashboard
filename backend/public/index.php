<?php

declare(strict_types=1);

// ── Bootstrap ───────────────────────────────────────────────────────────────
require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use App\Routes\Router;
use App\Controllers\{
    AuthController,
    TopicsController,
    ReportsController,
    HomeworkController,
    PresentationsController,
    DashboardController
};

// Load .env if present (local/dev). In container deployments the configuration
// usually comes from real environment variables injected by docker-compose/HSS.
// Use the "safe" loader so a missing/partial .env never aborts the request.
if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv::createUnsafeImmutable(__DIR__ . '/..');
    $dotenv->safeLoad();
}

// Hydrate $_ENV from the process environment. PHP's default variables_order
// ("GPCS") omits "E", so env vars injected by docker/HSS are NOT placed in
// $_ENV. Without this, MARIA_URI/JWT_SECRET fall back to dev defaults
// and every DB-backed request returns 500.
$envGet = function (string $key) {
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return $_ENV[$key];
    }
    $val = getenv($key);
    if ($val === false && isset($_SERVER[$key])) {
        $val = $_SERVER[$key];
    }
    return ($val !== false && $val !== '') ? $val : null;
};

foreach ([
    'APP_ENV', 'BASE_PATH', 'MARIA_URI', 'MARIA_DB', 'JWT_SECRET',
] as $__key) {
    $__val = $envGet($__key);
    if ($__val !== null) {
        $_ENV[$__key] = $__val;
    }
}

// HSS injects MariaDB credentials as MARIADB_* (a connection string plus
// discrete parts), but the app reads MARIA_URI. Bridge them: prefer the
// platform's connection string, else assemble one from the parts.
if (($_ENV['MARIA_URI'] ?? '') === '') {
    $hssConn = $envGet('MARIADB_CONNECTION_STRING');
    if ($hssConn !== null) {
        $_ENV['MARIA_URI'] = $hssConn;
    } else {
        $h = $envGet('MARIADB_HOST');
        $u = $envGet('MARIADB_USER');
        $p = $envGet('MARIADB_PASSWORD');
        $d = $envGet('MARIADB_DATABASE');
        $port = $envGet('MARIADB_PORT') ?? '3306';
        if ($h && $u && $d) {
            $_ENV['MARIA_URI'] = sprintf(
                'mysql://%s:%s@%s:%s/%s',
                rawurlencode($u), rawurlencode((string) $p), $h, $port, $d
            );
        }
    }
}
if (($_ENV['MARIA_DB'] ?? '') === '') {
    $d = $envGet('MARIADB_DATABASE');
    if ($d !== null) {
        $_ENV['MARIA_DB'] = $d;
    }
}

// ── Headers ──────────────────────────────────────────────────────────────────
// header('Access-Control-Allow-Origin: *');
// header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
// header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Router ───────────────────────────────────────────────────────────────────
$router = new Router();
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$basePath = rtrim($_ENV['BASE_PATH'] ?? '', '/');
if ($basePath !== '' && str_starts_with($uri, $basePath)) {
    $uri = substr($uri, strlen($basePath));
    if ($uri === '') {
        $uri = '/';
    }
}
// ── Auth Routes ───────────────────────────────────────────────────────────────
$router->add('POST', '/api/auth/register', [AuthController::class, 'register']);
$router->add('POST', '/api/auth/login',    [AuthController::class, 'login']);
$router->add('GET',  '/api/auth/me',       [AuthController::class, 'me']);
$router->add('GET',  '/api/users',         [AuthController::class, 'users']);

// ── Dashboard ─────────────────────────────────────────────────────────────────
$router->add('GET', '/api/dashboard', [DashboardController::class, 'index']);

// ── Topics ────────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/topics',       [TopicsController::class, 'index']);
$router->add('POST',   '/api/topics',       [TopicsController::class, 'store']);
$router->add('GET',    '/api/topics/{id}',  [TopicsController::class, 'show']);
$router->add('PUT',    '/api/topics/{id}',  [TopicsController::class, 'update']);
$router->add('DELETE', '/api/topics/{id}',  [TopicsController::class, 'destroy']);

// ── Reports ───────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/reports/tags',  [ReportsController::class, 'tags']);
$router->add('GET',    '/api/reports',       [ReportsController::class, 'index']);
$router->add('POST',   '/api/reports',       [ReportsController::class, 'store']);
$router->add('GET',    '/api/reports/{id}',  [ReportsController::class, 'show']);
$router->add('PUT',    '/api/reports/{id}',  [ReportsController::class, 'update']);
$router->add('DELETE', '/api/reports/{id}',  [ReportsController::class, 'destroy']);

// ── Homework ──────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/homework',                              [HomeworkController::class, 'index']);
$router->add('POST',   '/api/homework',                              [HomeworkController::class, 'store']);
$router->add('PUT',    '/api/homework/{id}',                         [HomeworkController::class, 'update']);
$router->add('DELETE', '/api/homework/{id}',                         [HomeworkController::class, 'destroy']);
$router->add('POST',   '/api/homework/{id}/submit',                  [HomeworkController::class, 'submit']);
$router->add('GET',    '/api/homework/{id}/submissions',             [HomeworkController::class, 'submissions']);
$router->add('PUT',    '/api/homework/{id}/grade/{userId}',          [HomeworkController::class, 'grade']);

// ── Presentations ─────────────────────────────────────────────────────────────
$router->add('GET',    '/api/presentations/sessions',                [PresentationsController::class, 'sessions']);
$router->add('POST',   '/api/presentations/sessions',                [PresentationsController::class, 'createSession']);
$router->add('POST',   '/api/presentations/sessions/{id}/slots',     [PresentationsController::class, 'createSlot']);
$router->add('DELETE', '/api/presentations/sessions/{id}',           [PresentationsController::class, 'destroySession']);
$router->add('GET',    '/api/presentations/mine',                    [PresentationsController::class, 'mine']);
$router->add('POST',   '/api/presentations/slots/{slotId}/book',     [PresentationsController::class, 'book']);
$router->add('DELETE', '/api/presentations/slots/{slotId}/cancel',   [PresentationsController::class, 'cancel']);
// Teacher: delete an empty slot
$router->add('DELETE', '/api/presentations/slots/{slotId}',          [PresentationsController::class, 'deleteSlot']);
$router->add('PUT',    '/api/presentations/slots/{slotId}/status',   [PresentationsController::class, 'updateStatus']);

// ── Health check ──────────────────────────────────────────────────────────────
$router->add('GET', '/api/health', function ($p) {
    echo json_encode(['status' => 'ok', 'time' => date('Y-m-d H:i:s')]);
});

// ── Dispatch ──────────────────────────────────────────────────────────────────
try {
    $router->dispatch($method, $uri);
} catch (\Throwable $e) {
    http_response_code(500);
    $isDev = ($_ENV['APP_ENV'] ?? '') === 'development';
    echo json_encode([
        'error'   => 'Internal Server Error',
        'message' => $isDev ? $e->getMessage() : 'Something went wrong',
        'trace'   => $isDev ? $e->getTraceAsString() : null,
    ]);
}
