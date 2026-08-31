<?php

namespace App\Controllers;

use App\Middleware\AuthMiddleware;

class PresentationsController extends BaseController
{
    private const SLOT_JSON = ['team_member_ids', 'team_member_names'];

    // ── SESSIONS (teacher creates date/time sessions) ──────────────────────

    // GET /api/presentations/sessions
    public function sessions(array $params): void
    {
        AuthMiddleware::require();

        $args = [];
        $sql  = 'SELECT * FROM presentation_sessions';
        if (!empty($_GET['type'])) {
            if ($_GET['type'] === 'referat') {
                // Legacy rows may have an empty type; treat them as referat.
                $sql .= " WHERE type = 'referat' OR type = '' OR type IS NULL";
            } else {
                $sql .= ' WHERE type = ?';
                $args[] = $_GET['type'];
            }
        }
        $sql .= ' ORDER BY date ASC';

        $stmt = $this->db()->prepare($sql);
        $stmt->execute($args);
        $sessions = $this->shapeMany($stmt->fetchAll());

        if (empty($sessions) && ($_GET['type'] ?? '') === 'project') {
            $this->createDefaultProjectSessions();
            $stmt = $this->db()->prepare("SELECT * FROM presentation_sessions WHERE type = 'project' ORDER BY date ASC");
            $stmt->execute();
            $sessions = $this->shapeMany($stmt->fetchAll());
        }

        // Attach slots to each session
        $slotStmt = $this->db()->prepare(
            'SELECT * FROM presentation_slots WHERE session_id = ? ORDER BY `time` ASC'
        );
        foreach ($sessions as &$session) {
            $slotStmt->execute([$session['_id']]);
            $session['slots'] = $this->shapeMany($slotStmt->fetchAll(), self::SLOT_JSON);
        }

        $this->json($sessions);
    }

    private function createDefaultProjectSessions(): void
    {
        $defaultDates = ['2026-06-16', '2026-06-17', '2026-06-29', '2026-06-30'];

        $sessStmt = $this->db()->prepare(
            'INSERT INTO presentation_sessions (date, type, label, slot_duration_min, slot_count, start_time)
             VALUES (?, "project", "Представяне на проект", 15, 28, "09:00")'
        );
        $slotStmt = $this->db()->prepare(
            'INSERT INTO presentation_slots
                (session_id, `time`, user_id, user_name, topic, status, team_member_ids, team_member_names, notes)
             VALUES (?, ?, NULL, NULL, NULL, "free", "[]", "[]", "")'
        );

        foreach ($defaultDates as $dateStr) {
            $sessStmt->execute([$dateStr]);
            $sessionId = (string) $this->db()->lastInsertId();

            $start = strtotime($dateStr . ' 09:00');
            for ($i = 0; $i < 28; $i++) {
                $time = date('H:i', $start + $i * 15 * 60);
                $slotStmt->execute([$sessionId, $time]);
            }
        }
    }

    // POST /api/presentations/sessions  (teacher only)
    public function createSession(array $params): void
    {
        AuthMiddleware::requireRole('teacher');
        $body = $this->body();

        foreach (['date', 'slot_duration_min', 'slot_count'] as $f) {
            if (!isset($body[$f]) || $body[$f] === '') {
                $this->json(['error' => "Field '$f' required"], 422);
                return;
            }
        }

        $date     = $body['date'];
        $type     = $body['type'] ?? 'referat';
        $label    = $body['label'] ?? $body['date'];
        $duration = (int) $body['slot_duration_min'];
        $count    = max(0, (int) $body['slot_count']);
        $startT   = $body['start_time'] ?? '09:00';

        $stmt = $this->db()->prepare(
            'INSERT INTO presentation_sessions (date, type, label, slot_duration_min, slot_count, start_time)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$date, $type, $label, $duration, $count, $startT]);
        $sessionId = (string) $this->db()->lastInsertId();

        // Auto-generate empty slots
        $slotStmt = $this->db()->prepare(
            'INSERT INTO presentation_slots
                (session_id, `time`, user_id, user_name, topic, status, team_member_ids, team_member_names, notes)
             VALUES (?, ?, NULL, NULL, NULL, "free", "[]", "[]", "")'
        );
        $start = strtotime($date . ' ' . $startT);
        for ($i = 0; $i < $count; $i++) {
            $time = date('H:i', $start + $i * $duration * 60);
            $slotStmt->execute([$sessionId, $time]);
        }

        $stmt = $this->db()->prepare('SELECT * FROM presentation_sessions WHERE id = ?');
        $stmt->execute([(int) $sessionId]);
        $this->json($this->shape($stmt->fetch()), 201);
    }

    // POST /api/presentations/sessions/{id}/slots  (teacher only)
    public function createSlot(array $params): void
    {
        AuthMiddleware::requireRole('teacher');
        $body = $this->body();

        if (empty($body['time'])) {
            $this->json(['error' => "Field 'time' required"], 422);
            return;
        }

        $stmt = $this->db()->prepare('SELECT id FROM presentation_sessions WHERE id = ?');
        $stmt->execute([$this->objectId($params['id'])]);
        if (!$stmt->fetch()) {
            $this->json(['error' => 'Session not found'], 404);
            return;
        }

        $stmt = $this->db()->prepare(
            'INSERT INTO presentation_slots
                (session_id, `time`, user_id, user_name, topic, status, team_member_ids, team_member_names, notes)
             VALUES (?, ?, NULL, NULL, NULL, "free", "[]", "[]", "")'
        );
        $stmt->execute([$params['id'], $body['time']]);
        $id = (int) $this->db()->lastInsertId();

        $stmt = $this->db()->prepare('SELECT * FROM presentation_slots WHERE id = ?');
        $stmt->execute([$id]);
        $this->json($this->shape($stmt->fetch(), self::SLOT_JSON), 201);
    }

    // DELETE /api/presentations/sessions/{id}  (teacher only)
    public function destroySession(array $params): void
    {
        AuthMiddleware::requireRole('teacher');

        // Prevent deletion if any slot in this session is booked or done
        $stmt = $this->db()->prepare(
            "SELECT id FROM presentation_slots
             WHERE session_id = ? AND status IN ('booked', 'done') LIMIT 1"
        );
        $stmt->execute([$params['id']]);
        if ($stmt->fetch()) {
            $this->json(['error' => 'Cannot delete session with existing bookings'], 422);
            return;
        }

        $stmt = $this->db()->prepare('DELETE FROM presentation_sessions WHERE id = ?');
        $stmt->execute([$this->objectId($params['id'])]);
        $stmt = $this->db()->prepare('DELETE FROM presentation_slots WHERE session_id = ?');
        $stmt->execute([$params['id']]);

        $this->json(['message' => 'Session deleted']);
    }

    // ── SLOTS (students book slots) ────────────────────────────────────────

    // POST /api/presentations/slots/{slotId}/book
    public function book(array $params): void
    {
        $payload = AuthMiddleware::require();
        $body    = $this->body();

        if (empty($body['topic'])) {
            $this->json(['error' => 'Topic is required'], 422);
            return;
        }

        $teamMemberIds   = [];
        $teamMemberNames = [];
        if (!empty($body['team_member_ids'])) {
            if (!is_array($body['team_member_ids'])) {
                $this->json(['error' => 'team_member_ids must be an array'], 422);
                return;
            }

            $teamMemberIds = array_values(array_unique($body['team_member_ids']));
            if (count($teamMemberIds) > 2) {
                $this->json(['error' => 'You can invite up to 2 team members'], 422);
                return;
            }

            foreach ($teamMemberIds as $memberId) {
                $stmt = $this->db()->prepare("SELECT name FROM users WHERE id = ? AND role = 'student'");
                $stmt->execute([$this->objectId((string) $memberId)]);
                $user = $stmt->fetch();
                if (!$user) {
                    $this->json(['error' => 'Invalid team member selection'], 422);
                    return;
                }
                $teamMemberNames[] = $user['name'];
            }
        }

        $stmt = $this->db()->prepare('SELECT * FROM presentation_slots WHERE id = ?');
        $stmt->execute([$this->objectId($params['slotId'])]);
        $slot = $stmt->fetch();
        if (!$slot) {
            $this->json(['error' => 'Slot not found'], 404);
            return;
        }

        if ($slot['status'] !== 'free') {
            $this->json(['error' => 'Slot already booked'], 409);
            return;
        }

        // Check if student already has a booking in this session
        $stmt = $this->db()->prepare(
            'SELECT id FROM presentation_slots WHERE session_id = ? AND user_id = ?'
        );
        $stmt->execute([$slot['session_id'], $payload['sub']]);
        if ($stmt->fetch()) {
            $this->json(['error' => 'You already have a slot in this session'], 409);
            return;
        }

        // Conditional update preserves the original race protection: only one
        // request can flip a 'free' slot to 'booked'.
        $stmt = $this->db()->prepare(
            'UPDATE presentation_slots
                SET user_id = ?, user_name = ?, topic = ?, status = "booked",
                    team_member_ids = ?, team_member_names = ?
             WHERE id = ? AND status = "free"'
        );
        $stmt->execute([
            $payload['sub'],
            $payload['name'],
            $body['topic'],
            json_encode($teamMemberIds, JSON_UNESCAPED_UNICODE),
            json_encode($teamMemberNames, JSON_UNESCAPED_UNICODE),
            $this->objectId($params['slotId']),
        ]);

        if ($stmt->rowCount() === 0) {
            $this->json(['error' => 'Slot already booked'], 409);
            return;
        }

        $this->json(['message' => 'Slot booked successfully']);
    }

    // DELETE /api/presentations/slots/{slotId}  (teacher only)
    public function deleteSlot(array $params): void
    {
        AuthMiddleware::requireRole('teacher');

        $stmt = $this->db()->prepare('SELECT * FROM presentation_slots WHERE id = ?');
        $stmt->execute([$this->objectId($params['slotId'])]);
        $slot = $stmt->fetch();
        if (!$slot) {
            $this->json(['error' => 'Slot not found'], 404);
            return;
        }

        // Only allow deletion of free slots
        if (!empty($slot['status']) && $slot['status'] !== 'free') {
            $this->json(['error' => 'Cannot delete a reserved slot'], 422);
            return;
        }

        $stmt = $this->db()->prepare('DELETE FROM presentation_slots WHERE id = ?');
        $stmt->execute([$this->objectId($params['slotId'])]);
        $this->json(['message' => 'Slot deleted']);
    }

    // DELETE /api/presentations/slots/{slotId}/cancel
    public function cancel(array $params): void
    {
        $payload = AuthMiddleware::require();

        $stmt = $this->db()->prepare('SELECT * FROM presentation_slots WHERE id = ?');
        $stmt->execute([$this->objectId($params['slotId'])]);
        $slot = $stmt->fetch();
        if (!$slot) {
            $this->json(['error' => 'Slot not found'], 404);
            return;
        }

        // Students can only cancel their own; teachers can cancel any
        if ($payload['role'] === 'student' && $slot['user_id'] !== $payload['sub']) {
            $this->json(['error' => 'Forbidden'], 403);
            return;
        }

        $stmt = $this->db()->prepare(
            'UPDATE presentation_slots
                SET user_id = NULL, user_name = NULL, topic = NULL, status = "free",
                    team_member_ids = "[]", team_member_names = "[]"
             WHERE id = ?'
        );
        $stmt->execute([$this->objectId($params['slotId'])]);

        $this->json(['message' => 'Slot cancelled']);
    }

    // PUT /api/presentations/slots/{slotId}/status  (teacher: mark done/absent)
    public function updateStatus(array $params): void
    {
        AuthMiddleware::requireRole('teacher');
        $body = $this->body();

        if (empty($body['status'])) {
            $this->json(['error' => 'Status required'], 422);
            return;
        }

        $stmt = $this->db()->prepare(
            'UPDATE presentation_slots SET status = ?, notes = ? WHERE id = ?'
        );
        $stmt->execute([
            $body['status'],
            $body['notes'] ?? '',
            $this->objectId($params['slotId']),
        ]);

        $this->json(['message' => 'Status updated']);
    }

    // GET /api/presentations/mine  — student's own bookings
    public function mine(array $params): void
    {
        $payload = AuthMiddleware::require();

        // Own slots, or slots where the student is listed as a team member.
        $stmt = $this->db()->prepare(
            'SELECT * FROM presentation_slots
             WHERE user_id = ? OR JSON_CONTAINS(team_member_ids, ?)
             ORDER BY `time` ASC'
        );
        $stmt->execute([$payload['sub'], json_encode($payload['sub'])]);
        $this->json($this->shapeMany($stmt->fetchAll(), self::SLOT_JSON));
    }
}
