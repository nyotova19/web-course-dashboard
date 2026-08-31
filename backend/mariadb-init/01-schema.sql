-- ===========================================================================
-- Web Dashboard — MariaDB schema
-- Ported from the MongoDB collections (mongo-init/seed.js).
--
-- Design notes:
--  * Primary keys are INT AUTO_INCREMENT, exposed to the API as the string
--    "_id" (matching the old Mongo ObjectId string contract).
--  * Array fields (tags, keywords, resources, team members) are JSON columns,
--    so the frontend keeps receiving real arrays with no shape change.
--  * Reference columns (user_id, session_id, homework_id) are VARCHAR because
--    the PHP code compares them against the JWT "sub" claim as strings.
--  * "group" is a reserved word -> column is group_name (JSON key stays "group").
--  * Loaded automatically by the mariadb container on first start.
-- ===========================================================================

SET NAMES utf8mb4;

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255)        NOT NULL,
    email       VARCHAR(255)        NOT NULL UNIQUE,
    password    VARCHAR(255)        NOT NULL,
    role        ENUM('student','teacher') NOT NULL,
    group_name  VARCHAR(100)        NOT NULL DEFAULT '',
    created_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── topics ─────────────────────────────────────────────────────────────────
CREATE TABLE topics (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    number      INT                 NOT NULL DEFAULT 0,
    title       VARCHAR(255)        NOT NULL,
    description TEXT                NOT NULL,
    status      VARCHAR(20)         NOT NULL DEFAULT 'upcoming', -- upcoming|active|done
    tags        JSON                NOT NULL,
    resources   JSON                NOT NULL,
    created_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_topics_number (number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── homework ───────────────────────────────────────────────────────────────
CREATE TABLE homework (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    number      INT                 NOT NULL DEFAULT 0,
    title       VARCHAR(255)        NOT NULL,
    description TEXT                NOT NULL,
    tags        JSON                NOT NULL,
    max_points  INT                 NOT NULL DEFAULT 10,
    deadline    DATETIME            NULL,
    created_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_homework_number (number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── homework_submissions ─────────────────────────────────────────────────────
CREATE TABLE homework_submissions (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    homework_id  VARCHAR(32)        NOT NULL,
    user_id      VARCHAR(32)        NOT NULL,
    user_name    VARCHAR(255)       NOT NULL,
    content      TEXT               NULL,
    link         VARCHAR(512)       NULL,
    submitted_at DATETIME           NULL,
    late         TINYINT(1)         NOT NULL DEFAULT 0,
    status       VARCHAR(20)        NOT NULL DEFAULT 'submitted', -- submitted|graded
    points       INT                NULL,
    feedback     TEXT               NULL,
    UNIQUE KEY uniq_hw_user (homework_id, user_id),
    INDEX idx_sub_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── reports ──────────────────────────────────────────────────────────────────
CREATE TABLE reports (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     VARCHAR(32)         NOT NULL,
    user_name   VARCHAR(255)        NOT NULL,
    title       VARCHAR(255)        NOT NULL,
    keywords    JSON                NOT NULL,
    resources   JSON                NOT NULL,
    deadline    DATETIME            NULL,
    status      VARCHAR(20)         NOT NULL DEFAULT 'pending',
    grade       DECIMAL(4,2)        NULL,
    notes       TEXT                NULL,
    created_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reports_user (user_id),
    INDEX idx_reports_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── presentation_sessions ────────────────────────────────────────────────────
CREATE TABLE presentation_sessions (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    date              VARCHAR(32)   NOT NULL,          -- "YYYY-MM-DD"
    type              VARCHAR(20)   NOT NULL DEFAULT 'referat', -- referat|project
    label             VARCHAR(255)  NOT NULL DEFAULT '',
    slot_duration_min INT           NOT NULL DEFAULT 15,
    slot_count        INT           NOT NULL DEFAULT 0,
    start_time        VARCHAR(5)    NOT NULL DEFAULT '09:00',
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessions_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── presentation_slots ───────────────────────────────────────────────────────
CREATE TABLE presentation_slots (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    session_id        VARCHAR(32)   NOT NULL,
    `time`            VARCHAR(5)    NOT NULL,           -- "HH:MM"
    status            VARCHAR(20)   NOT NULL DEFAULT 'free', -- free|booked|done|absent
    user_id           VARCHAR(32)   NULL,
    user_name         VARCHAR(255)  NULL,
    topic             VARCHAR(512)  NULL,
    team_member_ids   JSON          NOT NULL,
    team_member_names JSON          NOT NULL,
    notes             TEXT          NULL,
    INDEX idx_slots_session (session_id),
    INDEX idx_slots_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
