<?php

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use PDO;

class DashboardController extends BaseController
{
    // GET /api/dashboard
    public function index(array $params): void
    {
        $payload = AuthMiddleware::require();
        $userId  = $payload['sub'];

        if ($payload['role'] === 'student') {
            $this->studentDashboard($userId);
        } else {
            $this->teacherDashboard();
        }
    }

    // Small helper: run a COUNT(*) query and return the int.
    private function count(string $sql, array $args = []): int
    {
        $stmt = $this->db()->prepare($sql);
        $stmt->execute($args);
        return (int) $stmt->fetchColumn();
    }

    private function studentDashboard(string $userId): void
    {
        $db  = $this->db();
        $now = date('Y-m-d H:i:s');

        // Reports stats
        $totalReports     = $this->count('SELECT COUNT(*) FROM reports WHERE user_id = ?', [$userId]);
        $submittedReports = $this->count('SELECT COUNT(*) FROM reports WHERE user_id = ? AND status = "submitted"', [$userId]);
        $gradedReports    = $this->count('SELECT COUNT(*) FROM reports WHERE user_id = ? AND status = "graded"', [$userId]);

        // Homework stats
        $totalHw  = $this->count('SELECT COUNT(*) FROM homework');
        $doneSubs = $this->count('SELECT COUNT(*) FROM homework_submissions WHERE user_id = ?', [$userId]);

        $stmt = $db->prepare('SELECT COALESCE(SUM(points), 0) FROM homework_submissions WHERE user_id = ?');
        $stmt->execute([$userId]);
        $points = (int) $stmt->fetchColumn();

        $maxPts = (int) $db->query('SELECT COALESCE(SUM(max_points), 0) FROM homework')->fetchColumn();

        // Next presentation (earliest booked slot for this student)
        $stmt = $db->prepare(
            'SELECT * FROM presentation_slots
             WHERE user_id = ? AND status = "booked" ORDER BY `time` ASC LIMIT 1'
        );
        $stmt->execute([$userId]);
        $nextSlotRow = $stmt->fetch();
        $nextSlot = $nextSlotRow
            ? $this->shape($nextSlotRow, ['team_member_ids', 'team_member_names'])
            : null;

        // Upcoming deadlines (next 30 days)
        $upcoming = [];
        $soon = date('Y-m-d H:i:s', time() + 30 * 86400);

        $stmt = $db->prepare(
            'SELECT title, deadline, status FROM reports
             WHERE user_id = ? AND deadline >= ? AND deadline <= ?
             ORDER BY deadline ASC LIMIT 5'
        );
        $stmt->execute([$userId, $now, $soon]);
        foreach ($stmt->fetchAll() as $r) {
            $upcoming[] = [
                'type'     => 'report',
                'title'    => $r['title'],
                'deadline' => date('Y-m-d', strtotime($r['deadline'])),
                'status'   => $r['status'],
            ];
        }

        $stmt = $db->prepare(
            'SELECT id, title, deadline FROM homework
             WHERE deadline >= ? AND deadline <= ? ORDER BY deadline ASC LIMIT 5'
        );
        $stmt->execute([$now, $soon]);
        $hwRows = $stmt->fetchAll();

        $subCheck = $db->prepare(
            'SELECT id FROM homework_submissions WHERE homework_id = ? AND user_id = ?'
        );
        foreach ($hwRows as $hw) {
            $subCheck->execute([(string) $hw['id'], $userId]);
            if (!$subCheck->fetch()) {
                $upcoming[] = [
                    'type'     => 'homework',
                    'title'    => $hw['title'],
                    'deadline' => date('Y-m-d', strtotime($hw['deadline'])),
                    'status'   => 'pending',
                ];
            }
        }

        usort($upcoming, fn($a, $b) => strcmp($a['deadline'], $b['deadline']));

        // Topics progress
        $topicsProgress = [];
        $rows = $db->query('SELECT title, status FROM topics ORDER BY number ASC')->fetchAll();
        foreach ($rows as $t) {
            $topicsProgress[] = [
                'title'  => $t['title'],
                'status' => $t['status'] ?? 'upcoming',
            ];
        }

        // Grade calculation (simple avg of graded reports)
        $stmt = $db->prepare(
            'SELECT AVG(grade) FROM reports WHERE user_id = ? AND status = "graded" AND grade IS NOT NULL'
        );
        $stmt->execute([$userId]);
        $avg = $stmt->fetchColumn();
        $grade = $avg !== null ? round((float) $avg, 2) : null;

        $this->json([
            'grade'            => $grade,
            'reports'          => ['total' => $totalReports, 'submitted' => $submittedReports, 'graded' => $gradedReports],
            'homework'         => ['total' => $totalHw, 'done' => $doneSubs, 'points' => $points, 'max_points' => $maxPts],
            'next_presentation'=> $nextSlot,
            'upcoming'         => array_slice($upcoming, 0, 6),
            'topics_progress'  => $topicsProgress,
        ]);
    }

    private function teacherDashboard(): void
    {
        $totalStudents  = $this->count('SELECT COUNT(*) FROM users WHERE role = "student"');
        $totalReports   = $this->count('SELECT COUNT(*) FROM reports');
        $pendingGrading = $this->count('SELECT COUNT(*) FROM reports WHERE status = "submitted"');
        $totalHw        = $this->count('SELECT COUNT(*) FROM homework');
        $hwSubmissions  = $this->count('SELECT COUNT(*) FROM homework_submissions');
        $ungradedSubs   = $this->count('SELECT COUNT(*) FROM homework_submissions WHERE status = "submitted"');
        $upcomingPres   = $this->count('SELECT COUNT(*) FROM presentation_slots WHERE status = "booked"');

        $this->json([
            'students'               => $totalStudents,
            'reports'                => ['total' => $totalReports, 'pending_grading' => $pendingGrading],
            'homework'               => ['total' => $totalHw, 'submissions' => $hwSubmissions, 'ungraded' => $ungradedSubs],
            'upcoming_presentations' => $upcomingPres,
        ]);
    }
}
