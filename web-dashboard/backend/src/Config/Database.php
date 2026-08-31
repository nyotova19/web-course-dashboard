<?php

namespace App\Config;

use PDO;

class Database
{
    private static ?PDO $instance = null;

    // Returns a shared PDO connection to MariaDB, built from MARIA_URI:
    //   mysql://user:pass@host:port/dbname
    public static function get(): PDO
    {
        if (self::$instance === null) {
            $uri = $_ENV['MARIA_URI'] ?? getenv('MARIA_URI') ?: '';

            $parts = parse_url($uri);
            $host = $parts['host'] ?? '127.0.0.1';
            $port = $parts['port'] ?? 3306;
            $user = isset($parts['user']) ? rawurldecode($parts['user']) : 'root';
            $pass = isset($parts['pass']) ? rawurldecode($parts['pass']) : '';
            // Path is "/dbname"; fall back to MARIA_DB if the URI omits it.
            $db   = isset($parts['path']) ? ltrim($parts['path'], '/') : '';
            if ($db === '') {
                $db = $_ENV['MARIA_DB'] ?? getenv('MARIA_DB') ?: 'webcourse';
            }

            $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
            self::$instance = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }

        return self::$instance;
    }
}
