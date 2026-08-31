# Web Course Dashboard

Система за управление на уеб курс с PHP REST API, single-page frontend и
отделни функционалности за студенти и преподаватели.

## Стек

- **PHP 8.3** + custom Router (без framework)
- **MariaDB 11** чрез PDO и `pdo_mysql`
- **HTML5, CSS3 и JavaScript**
- **JWT** автентикация (`firebase/php-jwt`)
- **Nginx** reverse proxy
- **Docker + Docker Compose**
- **GitLab CI/CD**

---

## Бързо стартиране

Необходими са Docker, Docker Compose v2 и свободни портове `8080` и `3306`.
От основната директория на проекта изпълнете:

```bash
docker compose up -d --build
```

| URL | Описание |
|-----|----------|
| [http://localhost:8080](http://localhost:8080) | Web Course Dashboard |
| [http://localhost:8080/api/health](http://localhost:8080/api/health) | Проверка на REST API |
| `localhost:3306` | MariaDB |

Полезни команди:

```bash
# Състояние на контейнерите
docker compose ps

# Логове
docker compose logs -f

# Спиране на проекта
docker compose down
```

## Конфигурация

Docker Compose използва стойности по подразбиране за локална разработка. За
собствени настройки създайте `.env` файл в основната директория:

```env
APP_ENV=development
MARIA_DB=webcourse
MARIA_USER=webuser
MARIA_PASSWORD=webpass
MARIA_ROOT_PASSWORD=rootpass
JWT_SECRET=change_this_to_a_long_random_string
```

## Тестови акаунти

| Email | Password | Роля |
|-------|----------|------|
| `student@uni.bg` | `password` | Студент |
| `teacher@uni.bg` | `password` | Преподавател |

## Инициализация на MariaDB

При първото стартиране MariaDB изпълнява автоматично:

1. `mariadb-init/01-schema.sql` — създава таблиците и индексите;
2. `mariadb-init/02-seed.sql` — добавя тестовите потребители и примерните данни.

SQL файловете се изпълняват само при празен MariaDB volume. За пълно нулиране
на локалната база данни използвайте:

```bash
docker compose down -v
docker compose up -d --build
```

---

## Структура на проекта

```
web-dashboard/
├── frontend/                        ← SPA потребителски интерфейс
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
│       │   └── Database.php         ← MariaDB връзка чрез PDO
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
├── mariadb-init/
│   ├── 01-schema.sql                ← структура на базата данни
│   └── 02-seed.sql                  ← начални данни
├── .env.example
├── .gitignore
├── .gitlab-ci.yml
└── docker-compose.yml
```

---

## Потребителски интерфейс

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

## API endpoints

### Auth

| Метод | URL | Описание | Auth |
|-------|-----|----------|------|
| POST | /api/auth/register | Регистрация | — |
| POST | /api/auth/login | Вход | — |
| GET  | /api/auth/me | Текущ потребител | ✅ |
| GET  | /api/users?role=student | Списък студенти / потребители | ✅ |

Примерен отговор при успешен вход:

```json
{
  "token": "eyJ...",
  "user": { "_id": "...", "name": "...", "role": "student" }
}
```
Защитените заявки трябва да съдържат:

```http
Authorization: Bearer <token>
```

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

Поддържани query параметри: `?tag=#css`, `?scope=all`, `?status=pending`,
`?search=express`, `?page=1&limit=20`.

Примерно тяло на `POST` заявка:

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

Примерно тяло при предаване на домашна работа:

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

Примерно тяло при резервиране на слот:

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

Pipeline с 2 стейджа:

1. **build** — изгражда Docker image и го запазва като artifact;
2. **deploy** — зарежда image-а и стартира услугата с Docker Compose.

Pipeline-ът се изпълнява за клоновете `main` и `dev`. Използва защитен Compose
файл за съответната среда: `docker-compose.main.yaml` или
`docker-compose.dev.yaml`.

## Сигурност

- паролите се съхраняват като bcrypt hash;
- защитените endpoints използват JWT;
- правата се контролират според ролята на потребителя;
- SQL заявките използват PDO prepared statements.
