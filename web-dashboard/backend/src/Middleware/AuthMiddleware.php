<?php

namespace App\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class AuthMiddleware
{
    public static function require(): array
    {
        $headers = getallheaders();
        $auth    = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (!str_starts_with($auth, 'Bearer ')) {
            http_response_code(401);
            echo json_encode(['error' => 'Missing or invalid Authorization header']);
            exit;
        }

        $token = substr($auth, 7);
        $secret = $_ENV['JWT_SECRET'] ?? 'changeme';

        try {
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
            return (array) $decoded;
        } catch (Exception $e) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired token']);
            exit;
        }
    }

    public static function requireRole(string $role): array
    {
        $payload = self::require();
        if (($payload['role'] ?? '') !== $role && ($payload['role'] ?? '') !== 'teacher') {
            http_response_code(403);
            echo json_encode(['error' => 'Insufficient permissions']);
            exit;
        }
        return $payload;
    }

    public static function generate(array $payload): string
    {
        $secret = $_ENV['JWT_SECRET'] ?? 'changeme';
        $payload['iat'] = time();
        $payload['exp'] = time() + 60 * 60 * 24 * 7; // 7 days
        return JWT::encode($payload, $secret, 'HS256');
    }
}
