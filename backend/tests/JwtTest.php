<?php

declare(strict_types=1);

namespace Tests;

use App\Middleware\AuthMiddleware;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use PHPUnit\Framework\TestCase;

final class JwtTest extends TestCase
{
    private string $secret;

    protected function setUp(): void
    {
        $this->secret = 'test-secret-with-at-least-32-characters-123';
        $_ENV['JWT_SECRET'] = $this->secret;
    }

    protected function tearDown(): void
    {
        unset($_ENV['JWT_SECRET']);
    }

    public function testGeneratesValidJwtToken(): void
    {
        $token = AuthMiddleware::generate([
            'sub' => 'student-123',
            'role' => 'student',
        ]);

        self::assertNotEmpty($token);

        $decoded = (array) JWT::decode(
            $token,
            new Key($this->secret, 'HS256')
        );

        self::assertSame('student-123', $decoded['sub']);
        self::assertSame('student', $decoded['role']);
        self::assertArrayHasKey('iat', $decoded);
        self::assertArrayHasKey('exp', $decoded);
        self::assertGreaterThan($decoded['iat'], $decoded['exp']);
    }
}