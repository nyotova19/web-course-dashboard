<?php

namespace App\Controllers;

use App\Middleware\AuthMiddleware;

class HomeworkController extends BaseController
{
    private const HW_JSON   = ['tags'];

    // ── HOMEWORK DEFINITIONS (teacher manages) ─────────────────────────────

    // GET /api/homework
    public function index(array $params): void
    {
        $payload = AuthMiddleware::require();

        $where = [];
        $args  = [];
        if (!empty($_GET['tag'])) {
            $where[] = 'JSON_CONTAINS(tags, ?)';
            $args[]  = json_encode('#' . ltrim($_GET['tag'], '#'));
        }

        $sql = 'SELECT * FROM homework';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY number ASC';

        $stmt = $this->db()->prepare($sql);
        $stmt->execute($args);
        $hwList = $this->shapeMany($stmt->fetchAll(), self::HW_JSON);

        // For students, attach their own submission status
        if ($payload['role'] === 'student') {
            foreach ($hwList as &$hw) {
                $sub = $this->db()->prepare(
                    'SELECT * FROM homework_submissions WHERE homework_id = ? AND user_id = ?'
                );
                $sub->execute([$hw['_id'], $payload['sub']]);
                $row = $sub->fetch();
                $hw['my_submission'] = $row ? $this->shape($row) : null;
            }
        }

        $this->json($hwList);
    }

    // POST /api/homework  (teacher only)
    public function store(array $params): void
    {
        AuthMiddleware::requireRole('teacher');
        $body = $this->body();

        foreach (['title', 'deadline', 'max_points'] as $f) {
            if (empty($body[$f])) {
                $this->json(['error' => "Field '$f' required"], 422);
                return;
            }
        }

        $tags = array_map(function ($t) {
            $t = trim(strtolower($t));
            return str_starts_with($t, '#') ? $t : '#' . $t;
        }, $body['tags'] ?? []);

        $stmt = $this->db()->prepare(
            'INSERT INTO homework (number, title, description, tags, max_points, deadline)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            (int) ($body['number'] ?? 0),
            trim($body['title']),
            $body['description'] ?? '',
            json_encode($tags, JSON_UNESCAPED_UNICODE),
            (int) $body['max_points'],
            date('Y-m-d H:i:s', strtotime($body['deadline'])),
        ]);
        $id = (int) $this->db()->lastInsertId();

        $stmt = $this->db()->prepare('SELECT * FROM homework WHERE id = ?');
        $stmt->execute([$id]);
        $this->json($this->shape($stmt->fetch(), self::HW_JSON), 201);
    }

    // PUT /api/homework/{id}  (teacher only)
    public function update(array $params): void
    {
        AuthMiddleware::requireRole('teacher');
        $body = $this->body();

        $set  = [];
        $args = [];
        if (isset($body['title']))       { $set[] = 'title = ?';       $args[] = trim($body['title']); }
        if (isset($body['description'])) { $set[] = 'description = ?'; $args[] = $body['description']; }
        if (isset($body['max_points']))  { $set[] = 'max_points = ?';  $args[] = (int) $body['max_points']; }
        if (isset($body['deadline']))    { $set[] = 'deadline = ?';    $args[] = date('Y-m-d H:i:s', strtotime($body['deadline'])); }
        if (isset($body['tags'])) {
            $tags = array_map(fn($t) => '#' . ltrim(strtolower($t), '#'), $body['tags']);
            $set[]  = 'tags = ?';
            $args[] = json_encode($tags, JSON_UNESCAPED_UNICODE);
        }

        $id = $this->objectId($params['id']);
        if ($set) {
            $args[] = $id;
            $stmt = $this->db()->prepare('UPDATE homework SET ' . implode(', ', $set) . ' WHERE id = ?');
            $stmt->execute($args);
        }

        $stmt = $this->db()->prepare('SELECT * FROM homework WHERE id = ?');
        $stmt->execute([$id]);
        $this->json($this->shape($stmt->fetch(), self::HW_JSON));
    }

    // DELETE /api/homework/{id}  (teacher only)
    public function destroy(array $params): void
    {
        AuthMiddleware::requireRole('teacher');

        $stmt = $this->db()->prepare('DELETE FROM homework WHERE id = ?');
        $stmt->execute([$this->objectId($params['id'])]);

        $stmt = $this->db()->prepare('DELETE FROM homework_submissions WHERE homework_id = ?');
        $stmt->execute([$params['id']]);

        $this->json(['message' => 'Homework deleted']);
    }

    // ── SUBMISSIONS (student submits, teacher grades) ──────────────────────

    // POST /api/homework/{id}/submit
    public function submit(array $params): void
    {
        $payload = AuthMiddleware::require();
        $body    = $this->body();

        $stmt = $this->db()->prepare('SELECT * FROM homework WHERE id = ?');
        $stmt->execute([$this->objectId($params['id'])]);
        $hw = $stmt->fetch();
        if (!$hw) {
            $this->json(['error' => 'Homework not found'], 404);
            return;
        }

        $now  = date('Y-m-d H:i:s');
        $late = ($hw['deadline'] !== null && $now > $hw['deadline']) ? 1 : 0;

        // Upsert submission — relies on UNIQUE(homework_id, user_id).
        $stmt = $this->db()->prepare(
            'INSERT INTO homework_submissions
                (homework_id, user_id, user_name, content, link, submitted_at, late, status, points, feedback)
             VALUES (?, ?, ?, ?, ?, ?, ?, "submitted", NULL, NULL)
             ON DUPLICATE KEY UPDATE
                user_name = VALUES(user_name),
                content   = VALUES(content),
                link      = VALUES(link),
                submitted_at = VALUES(submitted_at),
                late      = VALUES(late),
                status    = "submitted",
                points    = NULL,
                feedback  = NULL'
        );
        $stmt->execute([
            $params['id'],
            $payload['sub'],
            $payload['name'],
            $body['content'] ?? '',
            $body['link'] ?? '',
            $now,
            $late,
        ]);

        $this->json(['message' => 'Submitted', 'late' => (bool) $late]);
    }

    // PUT /api/homework/{id}/grade/{userId}  (teacher only)
    public function grade(array $params): void
    {
        AuthMiddleware::requireRole('teacher');
        $body = $this->body();

        if (!isset($body['points'])) {
            $this->json(['error' => 'Points required'], 422);
            return;
        }

        $stmt = $this->db()->prepare(
            'UPDATE homework_submissions
                SET points = ?, feedback = ?, status = "graded"
             WHERE homework_id = ? AND user_id = ?'
        );
        $stmt->execute([
            (int) $body['points'],
            $body['feedback'] ?? '',
            $params['id'],
            $params['userId'],
        ]);

        $this->json(['message' => 'Graded successfully']);
    }

    // GET /api/homework/{id}/submissions  (teacher only)
    public function submissions(array $params): void
    {
        AuthMiddleware::requireRole('teacher');

        $stmt = $this->db()->prepare(
            'SELECT * FROM homework_submissions WHERE homework_id = ? ORDER BY submitted_at DESC'
        );
        $stmt->execute([$params['id']]);
        $this->json($this->shapeMany($stmt->fetchAll()));
    }
}
