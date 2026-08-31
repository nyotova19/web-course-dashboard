<?php

namespace App\Controllers;

use App\Config\Database;
use PDO;

abstract class BaseController
{
    protected function json(mixed $data, int $status = 200): void
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    protected function body(): array
    {
        $raw = file_get_contents('php://input');
        return json_decode($raw, true) ?? [];
    }

    protected function db(): PDO
    {
        return Database::get();
    }

    // Validates a string id as a positive integer (the SQL primary key).
    // Returns null for anything that isn't a valid id — callers treat that as
    // "not found", mirroring the old ObjectId behaviour.
    protected function objectId(string $id): ?int
    {
        return ctype_digit($id) ? (int) $id : null;
    }

    // Shapes a single DB row into the JSON contract the frontend expects:
    //   * integer "id"          -> string "_id"
    //   * "group_name"          -> "group"
    //   * JSON columns          -> decoded arrays
    // Returns [] for a missing row (matches the old docToArray(null)).
    protected function shape(mixed $row, array $jsonCols = []): array
    {
        if (!$row) return [];

        // Primary key -> string _id
        if (array_key_exists('id', $row)) {
            $row['_id'] = (string) $row['id'];
            unset($row['id']);
        }

        // Reserved-word column -> frontend key
        if (array_key_exists('group_name', $row)) {
            $row['group'] = $row['group_name'];
            unset($row['group_name']);
        }

        // Decode JSON array columns
        foreach ($jsonCols as $col) {
            if (array_key_exists($col, $row)) {
                $decoded = $row[$col] === null ? [] : json_decode($row[$col], true);
                $row[$col] = is_array($decoded) ? $decoded : [];
            }
        }

        return $row;
    }

    // Shapes a list of rows.
    protected function shapeMany(array $rows, array $jsonCols = []): array
    {
        return array_map(fn($r) => $this->shape($r, $jsonCols), $rows);
    }
}
