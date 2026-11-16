# AI Study Assistant — клієнтська частина

Інтерфейс додатку, який працює в браузері. Написаний на чистих HTML, CSS і JavaScript, без фреймворків і збірки.

## Сторінки та файли

| Файл | Призначення |
| --- | --- |
| `index.html` | Головна сторінка: матеріали, AI-помічник, тест, план навчання, прогрес, оцінка сайту |
| `App.js` | Логіка головної сторінки: вхід/вихід, матеріали, AI-запити, тест, прогрес, оцінки |
| `intro.js` | Вступне відео, яке перемотується скролом |
| `style.css` | Стилі головної сторінки (темна тема, адаптивна верстка) |
| `login.html`, `login.js` | Сторінка входу |
| `register.html`, `register.js` | Сторінка реєстрації |
| `auth.css` | Стилі сторінок входу та реєстрації |
| `flashcards.html`, `flashcards.js`, `flashcards.css` | Флеш-картки: карусель, перевертання, колекції |

## Як клієнт працює з сервером

Усі запити йдуть на `../backend/api.php` методом `POST` з JSON-тілом:

```js
fetch("../backend/api.php", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",            // надсилає cookie PHP-сесії
  body: JSON.stringify({ action: "login", email, password })
});
```

Опис усіх дій — у [`../backend/README.md`](../backend/README.md) та в Swagger: `backend/docs.html`.

## Зовнішні бібліотеки та сервіси

- **PDF.js** (cdnjs) — витягує текст із PDF прямо в браузері; підвантажується лише під час завантаження файлу.
- **Wikipedia REST API** — фото для флеш-карток.
- **Google Fonts** — шрифти Manrope та Unbounded.

## Запуск

Окремого запуску не потрібно: клієнт віддає Apache з MAMP разом із сервером.
Відкрий http://localhost:8888/ai-study-assistant/frontend/index.html

## Безпека

- Дані від сервера виводяться через `textContent` і `createElement` (без `innerHTML`) — захист від XSS.
- API-ключ OpenAI у клієнті відсутній: усі AI-запити йдуть через сервер.
