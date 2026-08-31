# Web Course Dashboard

Система за управление на уеб курс — PHP REST API backend + single-page frontend.

## Стек

- **PHP 8.3** + custom Router (без framework)
- **MongoDB 7** (чрез официалния PHP driver)
- **JWT** автентикация (`firebase/php-jwt`)
- **Nginx** reverse proxy
- **Docker + Docker Compose**
- **GitLab CI/CD**

---

## Бързо стартиране

```bash
git clone <repo>
cd web-dashboard
cp .env.example .env
docker compose up -d --build
```

| URL | Описание |
|-----|----------|
| http://localhost:8080 | Frontend (студентски dashboard) |
| http://localhost:8080/api | REST API |
| http://localhost:8081 | MongoDB UI (admin / admin123) |

**Тест акаунти:**

| Email | Password | Роля |
|-------|----------|------|
| student@uni.bg | password | Студент |
| teacher@uni.bg | password | Преподавател |

---

## Структура на проекта

```
web-dashboard/
├── frontend/                        ← Student SPA
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── backend/
│   ├── Dockerfile
│   ├── composer.json
│   ├── public/
│   │   └── index.php                ← API entry point
│   └── src/
│       ├── Config/
│       │   └── Database.php         ← MongoDB connection
│       ├── Controllers/
│       │   ├── BaseController.php
│       │   ├── AuthController.php
│       │   ├── DashboardController.php
│       │   ├── TopicsController.php
│       │   ├── ReportsController.php
│       │   ├── HomeworkController.php
│       │   └── PresentationsController.php
│       ├── Middleware/
│       │   └── AuthMiddleware.php   ← JWT
│       └── Routes/
│           └── Router.php
├── docker/
│   └── nginx.conf
├── mongo-init/
│   └── seed.js                      ← начални данни
├── .env.example
├── .gitignore
├── .gitlab-ci.yml
└── docker-compose.yml
```

---

## Frontend — Студентски Dashboard

Single-page приложение с 6 таба:

| Таб | Описание |
|-----|----------|
| **Моите реферати** | Списък на собствените реферати. Добавяне, редакция, изтриване. Предлагане на тема (без срок). Мулти-селект филтриране по хеш-тагове. |
| **Всички реферати** | Всички реферати в курса. Групиране по хеш-таг. Филтриране по таг (server-side). |
| **Представяне на реферат** | Сесии с налични слотове. Резервиране на слот с тема. |
| **Представяне на проект** | Свободни слотове за представяне. Записване с тема. |
| **Запазени дати** | Собствените резервации и резултати от преподавателя. Отказване на резервация. |
| **Домашни & Срокове** | Домашни задачи групирани по срок (просрочени / тази седмица / предстоящи / предадени). Предаване на домашно. Мулти-селект филтриране по хеш-тагове. Кликване на таг навигира към **Всички реферати** с активен филтър. |

---

## API Endpoints

### Auth

| Метод | URL | Описание | Auth |
|-------|-----|----------|------|
| POST | /api/auth/register | Регистрация | — |
| POST | /api/auth/login | Вход | — |
| GET  | /api/auth/me | Текущ потребител | ✅ |
| GET  | /api/users?role=student | Списък студенти / потребители | ✅ |

**Login response:**
```json
{
  "token": "eyJ...",
  "user": { "_id": "...", "name": "...", "role": "student" }
}
```
Всички следващи заявки: `Authorization: Bearer <token>`

---

### Реферати

| Метод | URL | Роля |
|-------|-----|------|
| GET    | /api/reports | student (own reports by default) / teacher (all reports) |
| GET    | /api/reports?scope=all | student (all reports) / teacher (all reports) |
| GET    | /api/reports/tags | всички хеш-тагове |
| GET    | /api/reports/{id} | student (own report) / teacher |
| POST   | /api/reports | student / teacher |
| PUT    | /api/reports/{id} | student (own report) / teacher |
| DELETE | /api/reports/{id} | student (own report) / teacher |

**Query params:** `?tag=#css`, `?scope=all`, `?status=pending`, `?search=express`, `?page=1&limit=20`

**POST body:**
```json
{
  "title": "Node.js въведение",
  "keywords": ["#node", "#backend"],
  "resources": ["https://nodejs.org/docs"],
  "deadline": "2025-06-04",
  "notes": "Допълнителни бележки"
}
```

За предложена тема (без срок):
```json
{
  "title": "Предложена тема",
  "keywords": ["#idea"],
  "status": "suggested"
}
```

Статуси: `pending` | `in_progress` | `submitted` | `graded` | `suggested`

---

### Домашни

| Метод | URL | Роля |
|-------|-----|------|
| GET    | /api/homework | student + teacher |
| POST   | /api/homework | teacher |
| PUT    | /api/homework/{id} | teacher |
| DELETE | /api/homework/{id} | teacher |
| POST   | /api/homework/{id}/submit | student |
| GET    | /api/homework/{id}/submissions | teacher |
| PUT    | /api/homework/{id}/grade/{userId} | teacher |

**Submit body:**
```json
{
  "content": "Описание на решението",
  "link": "https://github.com/ivan/hw8"
}
```

---

### Презентации

| Метод | URL | Роля |
|-------|-----|------|
| GET    | /api/presentations/sessions | всички |
| POST   | /api/presentations/sessions | teacher |
| POST   | /api/presentations/sessions/{id}/slots | teacher |
| DELETE | /api/presentations/sessions/{id} | teacher |
| GET    | /api/presentations/mine | student |
| POST   | /api/presentations/slots/{slotId}/book | student |
| DELETE | /api/presentations/slots/{slotId}/cancel | student |
| DELETE | /api/presentations/slots/{slotId} | teacher |
| PUT    | /api/presentations/slots/{slotId}/status | teacher |

**Book slot:**
```json
{ "topic": "REST API дизайн" }
```

Статуси на слот: `free` | `booked` | `done` | `absent`

---

### Теми

| Метод | URL | Роля |
|-------|-----|------|
| GET    | /api/topics | всички |
| GET    | /api/topics/{id} | всички |
| POST   | /api/topics | teacher |
| PUT    | /api/topics/{id} | teacher |
| DELETE | /api/topics/{id} | teacher |

---

## GitLab CI/CD

Pipeline с 4 стейджа:
1. **lint** — PHP syntax check
2. **test** — unit тестове (с MongoDB service)
3. **build** — Docker image → GitLab Registry
4. **deploy** — staging (auto на `develop`) / production (manual на `main`)

Необходими CI/CD variables:
- `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`
- `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY`
