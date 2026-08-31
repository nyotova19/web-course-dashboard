<?php

namespace App\Controllers;

use App\Middleware\AuthMiddleware;

class ReportsController extends BaseController
{
    private const JSON_COLS = ['keywords', 'resources'];

    // GET /api/reports
    public function index(array $params): void
    {
        $payload = AuthMiddleware::require();

        $where = [];
        $args  = [];

        // Students see only their own reports (unless ?scope=all is passed)
        if ($payload['role'] === 'student' && ($_GET['scope'] ?? 'own') !== 'all') {
            $where[] = 'user_id = ?';
            $args[]  = $payload['sub'];
        }

        // Filter by hashtag
        if (!empty($_GET['tag'])) {
            $where[] = 'JSON_CONTAINS(keywords, ?)';
            $args[]  = json_encode('#' . ltrim($_GET['tag'], '#'));
        }

        // Filter by status
        if (!empty($_GET['status'])) {
            $where[] = 'status = ?';
            $args[]  = $_GET['status'];
        }

        // Search (title OR keyword match)
        if (!empty($_GET['search'])) {
            $where[] = '(title LIKE ? OR JSON_CONTAINS(keywords, ?))';
            $args[]  = '%' . $_GET['search'] . '%';
            $args[]  = json_encode('#' . ltrim($_GET['search'], '#'));
        }

        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        // Pagination
        $page  = max(1, (int) ($_GET['page'] ?? 1));
        $limit = min(50, (int) ($_GET['limit'] ?? 20));
        $skip  = ($page - 1) * $limit;

        $countStmt = $this->db()->prepare('SELECT COUNT(*) FROM reports' . $whereSql);
        $countStmt->execute($args);
        $total = (int) $countStmt->fetchColumn();

        // LIMIT/OFFSET are integers we control — safe to interpolate.
        $sql = 'SELECT * FROM reports' . $whereSql
             . ' ORDER BY deadline ASC LIMIT ' . (int) $limit . ' OFFSET ' . (int) $skip;
        $stmt = $this->db()->prepare($sql);
        $stmt->execute($args);

        $this->json([
            'data'       => $this->shapeMany($stmt->fetchAll(), self::JSON_COLS),
            'total'      => $total,
            'page'       => $page,
            'totalPages' => $limit > 0 ? (int) ceil($total / $limit) : 0,
        ]);
    }

    // GET /api/reports/{id}
    public function show(array $params): void
    {
        AuthMiddleware::require();

        $stmt = $this->db()->prepare('SELECT * FROM reports WHERE id = ?');
        $stmt->execute([$this->objectId($params['id'])]);
        $doc = $stmt->fetch();

        if (!$doc) {
            $this->json(['error' => 'Report not found'], 404);
            return;
        }
        $this->json($this->shape($doc, self::JSON_COLS));
    }

    // POST /api/reports
    public function store(array $params): void
    {
        $payload = AuthMiddleware::require();
        $body    = $this->body();

        $requestedStatus = $body['status'] ?? 'pending';
        $isSuggested = ($requestedStatus === 'suggested');
        $required = $isSuggested ? ['title'] : ['title', 'deadline'];

        foreach ($required as $f) {
            if (empty($body[$f])) {
                $this->json(['error' => "Field '$f' required"], 422);
                return;
            }
        }

        $keywords = array_map(function ($kw) {
            $kw = trim(strtolower($kw));
            return str_starts_with($kw, '#') ? $kw : '#' . $kw;
        }, $body['keywords'] ?? []);

        $allowedStatuses = ['pending', 'suggested'];
        $status = ($payload['role'] === 'student' && in_array($requestedStatus, $allowedStatuses))
            ? $requestedStatus
            : 'pending';

        $deadline = !empty($body['deadline'])
            ? date('Y-m-d H:i:s', strtotime($body['deadline']))
            : null;

        $stmt = $this->db()->prepare(
            'INSERT INTO reports (user_id, user_name, title, keywords, resources, deadline, status, grade, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)'
        );
        $stmt->execute([
            $payload['sub'],
            $payload['name'],
            trim($body['title']),
            json_encode($keywords, JSON_UNESCAPED_UNICODE),
            json_encode($body['resources'] ?? [], JSON_UNESCAPED_UNICODE),
            $deadline,
            $status,
            $body['notes'] ?? '',
        ]);
        $id = (int) $this->db()->lastInsertId();

        $stmt = $this->db()->prepare('SELECT * FROM reports WHERE id = ?');
        $stmt->execute([$id]);
        $this->json($this->shape($stmt->fetch(), self::JSON_COLS), 201);
    }

    // PUT /api/reports/{id}
    public function update(array $params): void
    {
        $payload = AuthMiddleware::require();
        $body    = $this->body();

        $id = $this->objectId($params['id']);
        $stmt = $this->db()->prepare('SELECT * FROM reports WHERE id = ?');
        $stmt->execute([$id]);
        $doc = $stmt->fetch();
        if (!$doc) {
            $this->json(['error' => 'Report not found'], 404);
            return;
        }

        // Students can only edit their own; teachers can edit all
        if ($payload['role'] === 'student' && $doc['user_id'] !== $payload['sub']) {
            $this->json(['error' => 'Forbidden'], 403);
            return;
        }

        $set  = [];
        $args = [];
        if (isset($body['title']))     { $set[] = 'title = ?';  $args[] = trim($body['title']); }
        if (isset($body['keywords'])) {
            $keywords = array_map(function ($kw) {
                $kw = trim(strtolower($kw));
                return str_starts_with($kw, '#') ? $kw : '#' . $kw;
            }, $body['keywords']);
            $set[]  = 'keywords = ?';
            $args[] = json_encode($keywords, JSON_UNESCAPED_UNICODE);
        }
        if (isset($body['resources'])) { $set[] = 'resources = ?'; $args[] = json_encode($body['resources'], JSON_UNESCAPED_UNICODE); }
        if (isset($body['notes']))     { $set[] = 'notes = ?';     $args[] = $body['notes']; }
        if (isset($body['status']))    { $set[] = 'status = ?';    $args[] = $body['status']; }
        if (isset($body['deadline']))  { $set[] = 'deadline = ?';  $args[] = date('Y-m-d H:i:s', strtotime($body['deadline'])); }

        // Only teachers can set grade
        if ($payload['role'] === 'teacher' && isset($body['grade'])) {
            $set[]  = 'grade = ?';
            $args[] = (float) $body['grade'];
        }

        if ($set) {
            $args[] = $id;
            $stmt = $this->db()->prepare('UPDATE reports SET ' . implode(', ', $set) . ' WHERE id = ?');
            $stmt->execute($args);
        }

        $stmt = $this->db()->prepare('SELECT * FROM reports WHERE id = ?');
        $stmt->execute([$id]);
        $this->json($this->shape($stmt->fetch(), self::JSON_COLS));
    }

    // DELETE /api/reports/{id}
    public function destroy(array $params): void
    {
        $payload = AuthMiddleware::require();

        $id = $this->objectId($params['id']);
        $stmt = $this->db()->prepare('SELECT * FROM reports WHERE id = ?');
        $stmt->execute([$id]);
        $doc = $stmt->fetch();

        if (!$doc) {
            $this->json(['error' => 'Report not found'], 404);
            return;
        }

        if ($payload['role'] === 'student' && $doc['user_id'] !== $payload['sub']) {
            $this->json(['error' => 'Forbidden'], 403);
            return;
        }

        $stmt = $this->db()->prepare('DELETE FROM reports WHERE id = ?');
        $stmt->execute([$id]);
        $this->json(['message' => 'Report deleted']);
    }

    // GET /api/reports/tags  — list all unique hashtags
    public function tags(array $params): void
    {
        AuthMiddleware::require();

        // Unnest the keywords JSON arrays into rows, then DISTINCT.
        $sql = "SELECT DISTINCT jt.kw AS kw
                FROM reports,
                     JSON_TABLE(reports.keywords, '$[*]' COLUMNS (kw VARCHAR(255) PATH '$')) AS jt
                WHERE jt.kw IS NOT NULL";
        $rows = $this->db()->query($sql)->fetchAll();
        $tags = array_map(fn($r) => $r['kw'], $rows);
        $this->json(array_values($tags));
    }
}
