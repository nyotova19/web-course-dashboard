# API

## Адреси

При Docker Compose:

```text
http://localhost:8080/api
```

При локален Kubernetes port-forward:

```text
http://localhost:8081/api
```

## Формат

Заявките и отговорите използват JSON:

```http
Content-Type: application/json
```

Защитените endpoints изискват JWT:

```http
Authorization: Bearer <token>
```

## Health check

| Метод | Endpoint | Authentication |
|-------|----------|----------------|
| GET | `/api/health` | Не |

Примерен отговор:

```json
{
  "status": "ok",
  "time": "2026-09-01 18:00:00"
}
```

## Вход и регистрация

| Метод | Endpoint | Описание | Authentication |
|-------|----------|----------|----------------|
| POST | `/api/auth/register` | Регистрация | Не |
| POST | `/api/auth/login` | Вход | Не |
| GET | `/api/auth/me` | Текущ потребител | Да |
| GET | `/api/users` | Списък на потребители | Да |

### Login заявка

```json
{
  "email": "student@uni.bg",
  "password": "student123"
}
```

### Login отговор

```json
{
  "token": "eyJ...",
  "user": {
    "_id": "2",
    "name": "Иван Петров",
    "email": "student@uni.bg",
    "role": "student"
  }
}
```

## Dashboard

| Метод | Endpoint | Описание | Authentication |
|-------|----------|----------|----------------|
| GET | `/api/dashboard` | Статистика според ролята | Да |

Студентът получава лични статистики, а преподавателят — обобщена информация
за курса.

## Теми

| Метод | Endpoint | Роля |
|-------|----------|------|
| GET | `/api/topics` | student / teacher |
| GET | `/api/topics/{id}` | student / teacher |
| POST | `/api/topics` | teacher |
| PUT | `/api/topics/{id}` | teacher |
| DELETE | `/api/topics/{id}` | teacher |

Поддържани query параметри:

```text
?tag=php
?status=active
?search=security
```

## Реферати

| Метод | Endpoint | Роля |
|-------|----------|------|
| GET | `/api/reports` | student / teacher |
| GET | `/api/reports/tags` | student / teacher |
| GET | `/api/reports/{id}` | student / teacher |
| POST | `/api/reports` | student / teacher |
| PUT | `/api/reports/{id}` | owner / teacher |
| DELETE | `/api/reports/{id}` | owner / teacher |

Поддържани query параметри:

```text
?scope=all
?tag=#php
?status=pending
?search=REST
?page=1&limit=20
```

Примерна заявка:

```json
{
  "title": "REST API дизайн",
  "keywords": ["#php", "#api"],
  "resources": ["https://www.php.net/"],
  "deadline": "2026-09-20",
  "status": "pending",
  "notes": "Примерен реферат"
}
```

Поддържани статуси:

```text
pending
in_progress
submitted
graded
suggested
```

## Домашни работи

| Метод | Endpoint | Роля |
|-------|----------|------|
| GET | `/api/homework` | student / teacher |
| POST | `/api/homework` | teacher |
| PUT | `/api/homework/{id}` | teacher |
| DELETE | `/api/homework/{id}` | teacher |
| POST | `/api/homework/{id}/submit` | student |
| GET | `/api/homework/{id}/submissions` | teacher |
| PUT | `/api/homework/{id}/grade/{userId}` | teacher |

Примерно предаване:

```json
{
  "content": "Описание на решението",
  "link": "https://github.com/example/homework"
}
```

## Презентации

| Метод | Endpoint | Роля |
|-------|----------|------|
| GET | `/api/presentations/sessions` | student / teacher |
| POST | `/api/presentations/sessions` | teacher |
| POST | `/api/presentations/sessions/{id}/slots` | teacher |
| DELETE | `/api/presentations/sessions/{id}` | teacher |
| GET | `/api/presentations/mine` | student |
| POST | `/api/presentations/slots/{slotId}/book` | student |
| DELETE | `/api/presentations/slots/{slotId}/cancel` | student |
| DELETE | `/api/presentations/slots/{slotId}` | teacher |
| PUT | `/api/presentations/slots/{slotId}/status` | teacher |

Примерно резервиране на слот:

```json
{
  "topic": "Kubernetes deployment"
}
```

Статуси на слот:

```text
free
booked
done
absent
```

## HTTP статуси

| Код | Значение |
|-----|----------|
| 200 | Успешна заявка |
| 201 | Успешно създаден ресурс |
| 400 | Невалидна заявка |
| 401 | Липсващ или невалиден JWT |
| 403 | Недостатъчни права |
| 404 | Ресурсът не е намерен |
| 409 | Конфликт със съществуващи данни |
| 422 | Липсващо или невалидно поле |
| 500 | Вътрешна server грешка |

## Тестови потребители

| Email | Парола | Роля |
|-------|--------|------|
| `student@uni.bg` | `student123` | student |
| `teacher@uni.bg` | `teacher123` | teacher |