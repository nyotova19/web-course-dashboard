<?php

namespace App\Controllers;

use App\Middleware\AuthMiddleware;

class AuthController extends BaseController
{
    // POST /api/auth/register
    public function register(array $params): void
    {
        $body = $this->body();

        $required = ['name', 'email', 'password', 'role', 'group'];
        foreach ($required as $field) {
            if (empty($body[$field])) {
                $this->json(['error' => "Field '$field' is required"], 422);
                return;
            }
        }

        if (!in_array($body['role'], ['student', 'teacher'])) {
            $this->json(['error' => 'Role must be student or teacher'], 422);
            return;
        }

        if (!filter_var($body['email'], FILTER_VALIDATE_EMAIL)) {
            $this->json(['error' => 'Invalid email address'], 422);
            return;
        }

        $email = strtolower(trim($body['email']));

        $stmt = $this->db()->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            $this->json(['error' => 'Email already registered'], 409);
            return;
        }

        $name = htmlspecialchars(trim($body['name']));
        $stmt = $this->db()->prepare(
            'INSERT INTO users (name, email, password, role, group_name)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $name,
            $email,
            password_hash($body['password'], PASSWORD_BCRYPT),
            $body['role'],
            $body['group'],
        ]);
        $id = (string) $this->db()->lastInsertId();

        $token = AuthMiddleware::generate([
            'sub'   => $id,
            'name'  => $name,
            'email' => $email,
            'role'  => $body['role'],
            'group' => $body['group'],
        ]);

        $this->json([
            'token' => $token,
            'user'  => [
                '_id'   => $id,
                'name'  => $name,
                'email' => $email,
                'role'  => $body['role'],
                'group' => $body['group'],
            ],
        ], 201);
    }

    // POST /api/auth/login
    public function login(array $params): void
    {
        $body = $this->body();

        if (empty($body['email']) || empty($body['password'])) {
            $this->json(['error' => 'Email and password required'], 422);
            return;
        }

        $stmt = $this->db()->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([strtolower(trim($body['email']))]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($body['password'], $user['password'])) {
            $this->json(['error' => 'Invalid credentials'], 401);
            return;
        }

        $id = (string) $user['id'];
        $token = AuthMiddleware::generate([
            'sub'   => $id,
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role'],
            'group' => $user['group_name'],
        ]);

        $this->json([
            'token' => $token,
            'user'  => [
                '_id'   => $id,
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role'],
                'group' => $user['group_name'],
            ],
        ]);
    }

    // GET /api/auth/me
    public function me(array $params): void
    {
        $payload = AuthMiddleware::require();

        $stmt = $this->db()->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([(int) $payload['sub']]);
        $user = $stmt->fetch();

        if (!$user) {
            $this->json(['error' => 'User not found'], 404);
            return;
        }

        $arr = $this->shape($user);
        unset($arr['password']);
        $this->json($arr);
    }

    // GET /api/users?role=student
    public function users(array $params): void
    {
        AuthMiddleware::require();
        $role = $_GET['role'] ?? null;

        if ($role) {
            $stmt = $this->db()->prepare('SELECT * FROM users WHERE role = ? ORDER BY name ASC');
            $stmt->execute([$role]);
        } else {
            $stmt = $this->db()->query('SELECT * FROM users ORDER BY name ASC');
        }

        $users = $this->shapeMany($stmt->fetchAll());
        foreach ($users as &$u) {
            unset($u['password']);
        }
        $this->json($users);
    }
}
