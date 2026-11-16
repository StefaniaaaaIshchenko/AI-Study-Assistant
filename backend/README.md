# AI Study Assistant — серверна частина

REST-подібний API на PHP 8 + MySQL. Усі дії обробляє один файл `api.php`.

## Файли

| Файл | Призначення |
| --- | --- |
| `api.php` | Єдина точка входу: маршрутизація дій, авторизація, робота з БД, OpenAI |
| `database.php` | Підключення до MySQL (MAMP локально або хостинг) |
| `db_hosting.php` | Дані бази на хостингу (**не публікувати**, у `.gitignore`) |
| `config.php` | Ключ і модель OpenAI (**не публікувати**, у `.gitignore`) |
| `config.example.php` | Шаблон `config.php` без ключа |
| `openapi.yaml` | Специфікація API у форматі OpenAPI 3.0 |
| `docs.html` | Документація API у Swagger UI |

## Налаштування

1. Скопіюй `config.example.php` у `config.php` і впиши ключ:
   ```php
   return ["openai_key" => "sk-...", "model" => "gpt-4o-mini"];
   ```
   Або задай змінну середовища `OPENAI_API_KEY`.
2. База даних:
   - **локально (MAMP):** `127.0.0.1:8889`, користувач `root`, пароль `root`, база `ai_study_assistant`;
   - **хостинг:** дані в `db_hosting.php`: `return ["host", "user", "password", "database", 3306];`
3. Таблиці створюються автоматично під час першого запиту. Повна структура — у [`../database/schema.sql`](../database/schema.sql).

## Документація API (Swagger / OpenAPI)

- Специфікація: [`openapi.yaml`](openapi.yaml)
- Інтерактивна документація: http://localhost:8888/ai-study-assistant/backend/docs.html

У Swagger UI можна виконати будь-який запит кнопкою **Try it out**. Для захищених дій спочатку виконай `/login`.

## Як викликати API

Кожна дія — це `POST` із JSON-тілом. Дію можна передати у шляху або в тілі:

```bash
# у шляху
curl -X POST http://localhost:8888/ai-study-assistant/backend/api.php/login \
     -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"12345678"}'

# у тілі (так працює сайт)
curl -X POST http://localhost:8888/ai-study-assistant/backend/api.php \
     -H "Content-Type: application/json" -d '{"action":"login","email":"a@b.com","password":"12345678"}'
```

## Дії API

| Дія | Вхід | Опис |
| --- | --- | --- |
| `register` | — | Реєстрація (`name`, `email`, `password` від 8 символів) |
| `login` / `logout` | — | Вхід / вихід (PHP-сесія) |
| `me` | — | Поточний користувач |
| `ai` | так | `mode`: `explain`, `summary`, `quiz`, `plan`, `exam`, `ask`; `topic`, `level`, `material_id` |
| `flashcards` | так | Набір флеш-карток за темою або матеріалом |
| `mat_list` / `mat_save` / `mat_delete` | так | Навчальні матеріали |
| `col_list` / `col_get` / `col_save` / `col_delete` | так | Колекції флеш-карток |
| `progress_get` / `progress_save` | так | Статистика тестів |
| `rating_get` / `rating_save` | ні / так | Оцінки сайту |

Відповіді — JSON: `{"success": true, ...}` або `{"success": false, "message": "..."}`.

| Код | Значення |
| --- | --- |
| 200 / 201 | Успіх |
| 400 | Некоректні дані |
| 401 | Потрібно увійти |
| 404 | Не знайдено або належить іншому користувачу |
| 405 | Метод не POST |
| 409 | Email уже зареєстрований |
| 413 | Матеріал понад 300 000 символів |
| 429 | Забагато AI-запитів (не частіше ніж раз на 3 с) |
| 500 / 502 | Помилка сервера / OpenAI |

## Безпека

- Паролі: `password_hash` / `password_verify` (bcrypt); після входу — `session_regenerate_id`.
- Усі SQL-запити з даними користувача — підготовлені (`prepare` + `bind_param`).
- Кожен запит до матеріалів і колекцій перевіряє `user_id`, тож чужі дані недоступні.
- Ключ OpenAI зберігається лише на сервері; ліміт AI-запитів захищає баланс.
