-- ===========================================================================
-- Web Dashboard — seed data
-- Ported from mongo-init/seed.js. Runs after 01-schema.sql on first start.
--
-- ID note: AUTO_INCREMENT assigns teacher=1, student=2. The student's reports
-- and bookings reference user_id '2' (string, matching the JWT "sub" contract).
-- Project sessions are intentionally NOT seeded here — PresentationsController
-- auto-generates them on first request (createDefaultProjectSessions()).
-- ===========================================================================

SET NAMES utf8mb4;

-- ── Users ───────────────────────────────────────────────────────────────────
-- Both passwords are the bcrypt hash of the originals:
--   teacher@uni.bg / teacher123      student@uni.bg / student123
INSERT INTO users (id, name, email, password, role, group_name) VALUES
(1, 'Проф. Иванов', 'teacher@uni.bg', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher', 'all'),
(2, 'Иван Петров',  'student@uni.bg', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'Група 3');

-- ── Topics ────────────────────────────────────────────────────────────────────
INSERT INTO topics (number, title, description, status, tags, resources) VALUES
(1, 'HTML5 & Семантичен маркъп', 'Структура на уеб документи, семантични тагове, форми и достъпност.', 'done',     '["#html","#семантика","#a11y"]', '["https://developer.mozilla.org/en-US/docs/Web/HTML"]'),
(2, 'CSS3 & Flexbox / Grid',     'Модерни методи за оформление, responsive дизайн, CSS анимации.',        'done',     '["#css","#flexbox","#grid"]',    '["https://css-tricks.com/snippets/css/a-guide-to-flexbox/"]'),
(3, 'JavaScript — Основи',       'Типове данни, функции, DOM манипулация, събития и асинхронност.',       'done',     '["#js","#dom","#async"]',        '["https://javascript.info"]'),
(4, 'Node.js & Express',         'Сървърна страна с JS, routing, middleware, работа с файлова система.',  'active',   '["#node","#express","#backend"]','["https://expressjs.com"]'),
(5, 'REST API дизайн',           'HTTP методи, статус кодове, JSON, автентикация и документация с Swagger.','upcoming', '["#rest","#api","#http"]',       '[]'),
(6, 'MongoDB & Mongoose',        'NoSQL бази данни, схеми, CRUD операции, релации между документи.',      'upcoming', '["#mongodb","#nosql","#mongoose"]','[]');

-- ── Homework ──────────────────────────────────────────────────────────────────
INSERT INTO homework (number, title, description, tags, max_points, deadline) VALUES
(1, 'ДЗ #1 — Първа уеб страница',        'Създайте семантична HTML страница по зададена тема.', '["#html"]', 10, '2025-03-28 00:00:00'),
(2, 'ДЗ #2 — HTML семантична страница',  'Добавете семантични тагове и метаданни.',             '["#html"]', 10, '2025-04-10 00:00:00'),
(3, 'ДЗ #3 — Flexbox лайаут',            'Реализирайте responsive layout с Flexbox.',           '["#css"]',  10, '2025-04-25 00:00:00'),
(8, 'ДЗ #8 — CSS Grid responsive layout','Изградете grid лайаут с поне 3 breakpoint-а.',        '["#css"]',  10, '2025-06-05 00:00:00');

-- ── Reports (belong to the seeded student, user_id = '2') ────────────────────
INSERT INTO reports (user_id, user_name, title, keywords, resources, deadline, status, grade, notes) VALUES
('2', 'Иван Петров', 'HTML5 семантични елементи и достъпност',            '["#html","#семантика","#a11y"]',   '["https://developer.mozilla.org/en-US/docs/Web/HTML/Element"]', '2025-04-15 00:00:00', 'submitted',   NULL, 'Реферат по тема 1'),
('2', 'Иван Петров', 'CSS Flexbox — наръчник с примери',                  '["#css","#flexbox","#layout"]',    '["https://css-tricks.com/snippets/css/a-guide-to-flexbox/"]',   '2025-05-01 00:00:00', 'graded',      5.75, 'Много добра работа'),
('2', 'Иван Петров', 'JavaScript асинхронност — Promises и async/await',  '["#js","#async","#promises"]',     '["https://javascript.info/async"]',                            '2025-05-20 00:00:00', 'in_progress', NULL, ''),
('2', 'Иван Петров', 'REST API с Node.js и Express',                      '["#node","#rest","#api","#express"]','["https://expressjs.com/en/guide/routing.html"]',             '2025-06-10 00:00:00', 'pending',     NULL, ''),
('2', 'Иван Петров', 'MongoDB схеми и агрегации',                         '["#mongodb","#nosql"]',            '[]',                                                           NULL,                  'suggested',   NULL, 'Предложена тема за разглеждане');

-- ── Presentation sessions (referat) ──────────────────────────────────────────
INSERT INTO presentation_sessions (id, date, type, label, slot_duration_min, slot_count, start_time) VALUES
(1, '2025-06-20', 'referat', 'Защита — HTML & CSS',         15, 4, '10:00'),
(2, '2025-06-27', 'referat', 'Защита — JavaScript & Node.js', 15, 4, '10:00');

-- ── Presentation slots ───────────────────────────────────────────────────────
INSERT INTO presentation_slots (session_id, `time`, status, user_id, user_name, topic, team_member_ids, team_member_names, notes) VALUES
('1', '10:00', 'booked', '2',      'Иван Петров',     'CSS Flexbox наръчник', '[]', '[]', ''),
('1', '10:15', 'free',   NULL,     NULL,              NULL,                   '[]', '[]', ''),
('1', '10:30', 'booked', 'other1', 'Мария Георгиева', 'HTML семантика',       '[]', '[]', ''),
('1', '10:45', 'free',   NULL,     NULL,              NULL,                   '[]', '[]', ''),
('2', '10:00', 'free',   NULL,     NULL,              NULL,                   '[]', '[]', ''),
('2', '10:15', 'free',   NULL,     NULL,              NULL,                   '[]', '[]', ''),
('2', '10:30', 'free',   NULL,     NULL,              NULL,                   '[]', '[]', ''),
('2', '10:45', 'booked', 'other2', 'Петър Димитров',  'async/await в JS',     '[]', '[]', '');
