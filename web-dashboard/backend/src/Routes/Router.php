<?php

namespace App\Routes;

class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable|array $handler): void
    {
        $this->routes[] = [
            'method'  => strtoupper($method),
            'pattern' => $this->toRegex($pattern),
            'handler' => $handler,
            'params'  => $this->extractParamNames($pattern),
        ];
    }

    public function dispatch(string $method, string $uri): void
    {
        // Handle preflight CORS
        if ($method === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        $uri = strtok($uri, '?');

        foreach ($this->routes as $route) {
            if ($route['method'] !== strtoupper($method)) continue;

            if (preg_match($route['pattern'], $uri, $matches)) {
                $params = [];
                foreach ($route['params'] as $i => $name) {
                    $params[$name] = $matches[$i + 1] ?? null;
                }

                $handler = $route['handler'];
                if (is_array($handler)) {
                    [$class, $method] = $handler;
                    $obj = new $class();
                    $obj->$method($params);
                } else {
                    $handler($params);
                }
                return;
            }
        }

        http_response_code(404);
        echo json_encode(['error' => 'Route not found']);
    }

    private function toRegex(string $pattern): string
    {
        $regex = preg_replace('/\{(\w+)\}/', '([^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }

    private function extractParamNames(string $pattern): array
    {
        preg_match_all('/\{(\w+)\}/', $pattern, $m);
        return $m[1];
    }
}
