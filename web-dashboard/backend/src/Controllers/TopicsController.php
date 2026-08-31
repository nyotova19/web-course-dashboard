<?php

namespace App\Controllers;

use App\Middleware\AuthMiddleware;

class TopicsController extends BaseController
{
    private const JSON_COLS = ['tags', 'resources'];

    // GET /api/topics
    public function index(array $params): void
    {
        AuthMiddleware::require();

        $where = [];
        $args  = [];

        if (!empty($_GET['tag'])) {
            $where[] = 'JSON_CONTAINS(tags, ?)';
            $args[]  = json_encode(strtolower($_GET['tag']));
        }
        if (!empty($_GET['status'])) {
            $where[] = 'status = ?';
            $args[]  = $_GET['status'];
        }
        if (!empty($_GET['search'])) {
            $where[] = '(title LIKE ? OR description LIKE ?)';
            $args[]  = '%' . $_GET['search'] . '%';
            $args[]  = '%' . $_GET['search'] . '%';
        }

        $sql = 'SELECT * FROM topics';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY number ASC';

        $stmt = $this->db()->prepare($sql);
        $stmt->execute($args);
        $this->json($this->shapeMany($stmt->fetchAll(), self::JSON_COLS));
    }

    // GET /api/topics/{id}
    public function show(array $params): void
    {
        AuthMiddleware::require();

        $id = $this->objectId($params['id']);
        $stmt = $this->db()->prepare('SELECT * FROM topics WHERE id = ?');
        $stmt->execute([$id]);
        $doc = $stmt->fetch();

        if (!$doc) {
            $this->json(['error' => 'Topic not found'], 404);
            return;
        }
        $this->json($this->shape($doc, self::JSON_COLS));
    }

    // POST /api/topics  (teacher only)
    public function store(array $params): void
    {
        AuthMiddleware::requireRole('teacher');
        $body = $this->body();

        foreach (['title', 'description', 'number'] as $f) {
            if (empty($body[$f])) {
                $this->json(['error' => "Field '$f' required"], 422);
                return;
            }
        }

        $tags = array_map('strtolower', $body['tags'] ?? []);
        $resources = $body['resources'] ?? [];
        $status = $body['status'] ?? 'upcoming';

        $stmt = $this->db()->prepare(
            'INSERT INTO topics (number, title, description, tags, status, resources)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            (int) $body['number'],
            trim($body['title']),
            trim($body['description']),
            json_encode($tags, JSON_UNESCAPED_UNICODE),
            $status,
            json_encode($resources, JSON_UNESCAPED_UNICODE),
        ]);
        $id = (int) $this->db()->lastInsertId();

        $stmt = $this->db()->prepare('SELECT * FROM topics WHERE id = ?');
        $stmt->execute([$id]);
        $this->json($this->shape($stmt->fetch(), self::JSON_COLS), 201);
    }

    // PUT /api/topics/{id}  (teacher only)
    public function update(array $params): void
    {
        AuthMiddleware::requireRole('teacher');
        $body = $this->body();

        $set  = [];
        $args = [];
        if (isset($body['title']))       { $set[] = 'title = ?';       $args[] = trim($body['title']); }
        if (isset($body['description'])) { $set[] = 'description = ?'; $args[] = trim($body['description']); }
        if (isset($body['status']))      { $set[] = 'status = ?';      $args[] = $body['status']; }
        if (isset($body['tags'])) {
            $set[]  = 'tags = ?';
            $args[] = json_encode(array_map('strtolower', $body['tags']), JSON_UNESCAPED_UNICODE);
        }
        if (isset($body['resources'])) {
            $set[]  = 'resources = ?';
            $args[] = json_encode($body['resources'], JSON_UNESCAPED_UNICODE);
        }

        if (!$set) {
            $this->json(['error' => 'Nothing to update'], 422);
            return;
        }

        $id = $this->objectId($params['id']);
        $args[] = $id;
        $stmt = $this->db()->prepare('UPDATE topics SET ' . implode(', ', $set) . ' WHERE id = ?');
        $stmt->execute($args);

        if ($stmt->rowCount() === 0) {
            // rowCount 0 can mean "no change" too; verify existence.
            $check = $this->db()->prepare('SELECT id FROM topics WHERE id = ?');
            $check->execute([$id]);
            if (!$check->fetch()) {
                $this->json(['error' => 'Topic not found'], 404);
                return;
            }
        }

        $stmt = $this->db()->prepare('SELECT * FROM topics WHERE id = ?');
        $stmt->execute([$id]);
        $this->json($this->shape($stmt->fetch(), self::JSON_COLS));
    }

    // DELETE /api/topics/{id}  (teacher only)
    public function destroy(array $params): void
    {
        AuthMiddleware::requireRole('teacher');

        $stmt = $this->db()->prepare('DELETE FROM topics WHERE id = ?');
        $stmt->execute([$this->objectId($params['id'])]);

        if ($stmt->rowCount() === 0) {
            $this->json(['error' => 'Topic not found'], 404);
            return;
        }
        $this->json(['message' => 'Topic deleted']);
    }
}
