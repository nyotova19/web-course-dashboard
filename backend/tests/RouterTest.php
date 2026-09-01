<?php

declare(strict_types=1);

namespace Tests;

use App\Routes\Router;
use PHPUnit\Framework\TestCase;

final class RouterTest extends TestCase
{
    public function testDispatchesStaticRoute(): void
    {
        $router = new Router();
        $called = false;

        $router->add('GET', '/api/health', function (array $params) use (&$called): void {
            $called = true;
            self::assertSame([], $params);
        });

        $router->dispatch('GET', '/api/health');

        self::assertTrue($called);
    }

    public function testExtractsRouteParameter(): void
    {
        $router = new Router();
        $capturedId = null;

        $router->add('GET', '/api/reports/{id}', function (array $params) use (&$capturedId): void {
            $capturedId = $params['id'];
        });

        $router->dispatch('GET', '/api/reports/42');

        self::assertSame('42', $capturedId);
    }

    public function testIgnoresQueryStringWhenMatching(): void
    {
        $router = new Router();
        $called = false;

        $router->add('GET', '/api/reports', function (array $params) use (&$called): void {
            $called = true;
        });

        $router->dispatch('GET', '/api/reports?page=2&limit=10');

        self::assertTrue($called);
    }
}