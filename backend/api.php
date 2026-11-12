<?php
// Єдина точка входу для всього нового функціоналу: POST JSON {"action": "...", ...}
session_start();
header("Content-Type: application/json; charset=UTF-8");

function out($code, $arr) { http_response_code($code); echo json_encode($arr, JSON_UNESCAPED_UNICODE); exit; }
set_exception_handler(function ($e) { error_log($e); out(500, ["success" => false, "message" => "Помилка сервера. Спробуй ще раз."]); });
require_once __DIR__ . "/database.php";   // створює $conn
function login_required() {
    if (empty($_SESSION["user_id"])) out(401, ["success" => false, "message" => "Увійди в акаунт, щоб користуватися цією функцією"]);
    return (int)$_SESSION["user_id"];
}
function throttle() {   // захист ключа: не частіше ніж раз на 3 секунди
    $now = microtime(true);
    if (isset($_SESSION["last_ai"]) && $now - $_SESSION["last_ai"] < 3) out(429, ["success" => false, "message" => "Зачекай кілька секунд і спробуй ще раз"]);
    $_SESSION["last_ai"] = $now;
}
function openai($system, $user, $json = false, $max = 2500) {
    $cfg = require __DIR__ . "/config.php";
    if (empty($cfg["openai_key"])) out(500, ["success" => false, "message" => "На сервері не налаштований API-ключ"]);
    $payload = ["model" => $cfg["model"], "max_completion_tokens" => $max,
        "messages" => [["role" => "system", "content" => $system], ["role" => "user", "content" => $user]]];
    if ($json) $payload["response_format"] = ["type" => "json_object"];
    $ch = curl_init("https://api.openai.com/v1/chat/completions");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 90,
        CURLOPT_HTTPHEADER => ["Content-Type: application/json", "Authorization: Bearer " . $cfg["openai_key"]],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
    $raw = curl_exec($ch); $st = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    if ($raw === false || $st !== 200) { error_log("OpenAI $st: " . substr((string)$raw, 0, 300)); out(502, ["success" => false, "message" => "AI зараз недоступний. Спробуй ще раз."]); }
    return json_decode($raw, true)["choices"][0]["message"]["content"] ?? "";
}

// Таблиці створюються автоматично (один раз за сесію)
if (empty($_SESSION["schema_ok"])) {
    foreach ([
        "CREATE TABLE IF NOT EXISTS Users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) CHARACTER SET utf8mb4",
        "CREATE TABLE IF NOT EXISTS collections (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, name VARCHAR(120) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX (user_id)) CHARACTER SET utf8mb4",
        "CREATE TABLE IF NOT EXISTS flashcards (id INT AUTO_INCREMENT PRIMARY KEY, collection_id INT NOT NULL, topic VARCHAR(255) NOT NULL, front TEXT NOT NULL, back TEXT NOT NULL, hint TEXT NULL, emoji VARCHAR(32) NULL, mnemonic TEXT NULL, image_query VARCHAR(120) NULL, FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE) CHARACTER SET utf8mb4",
        "CREATE TABLE IF NOT EXISTS quiz_results (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, topic VARCHAR(255) NULL, correct INT NOT NULL, total INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX (user_id)) CHARACTER SET utf8mb4",
        "CREATE TABLE IF NOT EXISTS ratings (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, stars TINYINT NOT NULL, comment VARCHAR(500) NOT NULL DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_user (user_id)) CHARACTER SET utf8mb4",
    ] as $sql) $conn->query($sql);
    $_SESSION["schema_ok"] = true;
}

$in = json_decode(file_get_contents("php://input"), true) ?: [];
$action = $in["action"] ?? "";
if ($_SERVER["REQUEST_METHOD"] !== "POST") out(405, ["success" => false, "message" => "Метод не дозволений"]);

switch ($action) {

case "register": {
    $name = mb_substr(trim($in["name"] ?? ""), 0, 100); $email = trim($in["email"] ?? ""); $pass = (string)($in["password"] ?? "");
    if ($name === "" || $email === "" || $pass === "") out(400, ["success" => false, "message" => "Заповніть усі поля"]);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) out(400, ["success" => false, "message" => "Некоректна електронна пошта"]);
    if (strlen($pass) < 8) out(400, ["success" => false, "message" => "Пароль має містити мінімум 8 символів"]);
    $st = $conn->prepare("SELECT id FROM Users WHERE email = ?");
    $st->bind_param("s", $email); $st->execute();
    if ($st->get_result()->num_rows > 0) out(409, ["success" => false, "message" => "Ця електронна пошта вже зареєстрована"]);
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $st = $conn->prepare("INSERT INTO Users (name, email, password) VALUES (?,?,?)");
    $st->bind_param("sss", $name, $email, $hash); $st->execute();
    out(201, ["success" => true, "message" => "Реєстрація успішна", "user_id" => $st->insert_id]);
}

case "login": {
    $email = trim($in["email"] ?? ""); $pass = (string)($in["password"] ?? "");
    if ($email === "" || $pass === "") out(400, ["success" => false, "message" => "Заповніть усі поля"]);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) out(400, ["success" => false, "message" => "Некоректна електронна пошта"]);
    $st = $conn->prepare("SELECT id, name, email, password FROM Users WHERE email = ?");
    $st->bind_param("s", $email); $st->execute();
    $u = $st->get_result()->fetch_assoc();
    if (!$u || !password_verify($pass, $u["password"])) out(401, ["success" => false, "message" => "Неправильна електронна пошта або пароль"]);
    session_regenerate_id(true);
    $_SESSION["user_id"] = (int)$u["id"]; $_SESSION["user_name"] = $u["name"]; $_SESSION["user_email"] = $u["email"];
    out(200, ["success" => true, "message" => "Вхід успішний", "user" => ["id" => (int)$u["id"], "name" => $u["name"], "email" => $u["email"]]]);
}

case "me":
    if (empty($_SESSION["user_id"])) out(200, ["logged_in" => false]);
    out(200, ["logged_in" => true, "user" => ["id" => $_SESSION["user_id"], "name" => $_SESSION["user_name"], "email" => $_SESSION["user_email"]]]);

case "logout":
    $_SESSION = []; session_destroy();
    out(200, ["success" => true]);

case "ai": {   // explain | summary | quiz | plan | exam | ask
    login_required(); throttle();
    $mode = $in["mode"] ?? ""; $topic = trim($in["topic"] ?? "");
    $level = ["beginner" => "початковий", "medium" => "середній", "advanced" => "просунутий"][$in["level"] ?? ""] ?? "середній";
    if ($topic === "" || mb_strlen($topic) > 1500) out(400, ["success" => false, "message" => "Впиши тему або запитання"]);
    $base = "Ти AI-репетитор для студентів. Відповідай українською, чітко й структуровано, без вступів. Рівень складності: $level.";
    $prompts = [
        "explain" => "$base Поясни тему простими словами з прикладами та аналогіями.",
        "summary" => "$base Зроби стислий конспект теми: ключові поняття, тези, формули (якщо є), короткий підсумок.",
        "plan"    => "$base Склади персональний план навчання на 2 тижні по днях для предметів/теми користувача: цілі, що вивчати, скільки часу, як перевіряти себе.",
        "exam"    => "$base Підготуй користувача до іспиту: найімовірніші питання, ключові відповіді, типові помилки, порядок повторення за 3 дні.",
        "ask"     => "$base Дай точну відповідь на запитання користувача й за потреби короткий приклад.",
    ];
    if ($mode === "quiz") {
        $sys = "$base Створи тест із 5 питань за темою. Відповідай ЛИШЕ JSON: {\"questions\":[{\"q\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct\":0,\"explanation\":\"...\"}]}, де correct — індекс правильного варіанта (0-3).";
        $d = json_decode(openai($sys, "Тема: $topic", true, 3000), true);
        $qs = array_values(array_filter($d["questions"] ?? [], fn($x) => !empty($x["q"]) && count($x["options"] ?? []) === 4 && isset($x["correct"]) && $x["correct"] >= 0 && $x["correct"] <= 3));
        if (!$qs) out(502, ["success" => false, "message" => "Не вдалося створити тест. Спробуй ще раз."]);
        out(200, ["success" => true, "questions" => $qs]);
    }
    if (!isset($prompts[$mode])) out(400, ["success" => false, "message" => "Невідома дія"]);
    out(200, ["success" => true, "text" => trim(openai($prompts[$mode], $topic, false, 2000))]);
}

case "flashcards": {
    login_required(); throttle();
    $topic = trim($in["topic"] ?? "");
    $level = in_array($in["level"] ?? "", ["beginner", "medium", "advanced"]) ? $in["level"] : "medium";
    $count = max(4, min(16, (int)($in["count"] ?? 10)));
    if ($topic === "" || mb_strlen($topic) > 500) out(400, ["success" => false, "message" => "Вкажи тему на головній сторінці"]);
    $sys = <<<TXT
Ти створюєш навчальні флеш-картки. Відповідай ЛИШЕ валідним JSON-об'єктом.
Формат: {"title":"коротка назва набору","cards":[{"front":"...","back":"...","hint":"...","emoji":"1-3 емодзі","mnemonic":"...","image_query":"..."}]}
Правила:
- Підбери тип карток під тему: визначення/терміни; слова іноземної мови (front — слово, back — переклад українською + приклад речення); формули (front — назва, back — формула та пояснення змінних); тези/дати/факти.
- Пиши українською, крім слів іноземної мови.
- mnemonic — яскрава, смішна або візуальна асоціація для запам'ятовування (1-2 речення).
- emoji — сцена-асоціація з емодзі.
- image_query — англійська назва конкретного реального предмета/поняття для фото у Вікіпедії (напр. "Mitochondrion"); порожній рядок, якщо картинка не допоможе (формули, абстракції).
- hint — коротка підказка без розкриття відповіді.
TXT;
    $d = json_decode(openai($sys, "Тема: $topic\nРівень: $level\nКількість карток: $count", true, 4000), true);
    if (!$d || empty($d["cards"]) || !is_array($d["cards"])) out(502, ["success" => false, "message" => "Не вдалося розібрати відповідь AI. Спробуй ще раз."]);
    $cards = [];
    foreach ($d["cards"] as $c) {
        if (empty($c["front"]) || empty($c["back"])) continue;
        $cards[] = ["front" => (string)$c["front"], "back" => (string)$c["back"], "hint" => (string)($c["hint"] ?? ""),
            "emoji" => (string)($c["emoji"] ?? ""), "mnemonic" => (string)($c["mnemonic"] ?? ""), "image_query" => (string)($c["image_query"] ?? "")];
    }
    out(200, ["success" => true, "title" => (string)($d["title"] ?? $topic), "cards" => $cards]);
}

case "col_list": {
    $uid = login_required();
    $st = $conn->prepare("SELECT c.id, c.name, COUNT(f.id) AS cards FROM collections c LEFT JOIN flashcards f ON f.collection_id = c.id WHERE c.user_id = ? GROUP BY c.id ORDER BY c.created_at DESC");
    $st->bind_param("i", $uid); $st->execute();
    out(200, ["success" => true, "collections" => $st->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

case "col_get": {
    $uid = login_required(); $cid = (int)($in["collection_id"] ?? 0);
    $st = $conn->prepare("SELECT name FROM collections WHERE id = ? AND user_id = ?");
    $st->bind_param("ii", $cid, $uid); $st->execute();
    $col = $st->get_result()->fetch_assoc();
    if (!$col) out(404, ["success" => false, "message" => "Колекцію не знайдено"]);
    $st = $conn->prepare("SELECT front, back, hint, emoji, mnemonic, image_query FROM flashcards WHERE collection_id = ? ORDER BY id");
    $st->bind_param("i", $cid); $st->execute();
    out(200, ["success" => true, "title" => $col["name"], "cards" => $st->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

case "col_save": {
    $uid = login_required();
    $cards = $in["cards"] ?? []; $topic = mb_substr(trim($in["topic"] ?? ""), 0, 255);
    $cid = (int)($in["collection_id"] ?? 0); $newName = mb_substr(trim($in["new_name"] ?? ""), 0, 120);
    if (!is_array($cards) || !$cards || count($cards) > 50) out(400, ["success" => false, "message" => "Немає карток для збереження"]);
    if ($cid === 0) {
        if ($newName === "") out(400, ["success" => false, "message" => "Введи назву колекції"]);
        $st = $conn->prepare("INSERT INTO collections (user_id, name) VALUES (?, ?)");
        $st->bind_param("is", $uid, $newName); $st->execute(); $cid = $st->insert_id;
    } else {
        $st = $conn->prepare("SELECT id FROM collections WHERE id = ? AND user_id = ?");
        $st->bind_param("ii", $cid, $uid); $st->execute();
        if (!$st->get_result()->fetch_assoc()) out(404, ["success" => false, "message" => "Колекцію не знайдено"]);
    }
    $st = $conn->prepare("INSERT INTO flashcards (collection_id, topic, front, back, hint, emoji, mnemonic, image_query) VALUES (?,?,?,?,?,?,?,?)");
    foreach ($cards as $c) {
        $f = (string)($c["front"] ?? ""); $b = (string)($c["back"] ?? ""); $h = (string)($c["hint"] ?? "");
        $e = (string)($c["emoji"] ?? ""); $m = (string)($c["mnemonic"] ?? ""); $q = (string)($c["image_query"] ?? "");
        if ($f === "" || $b === "") continue;
        $st->bind_param("isssssss", $cid, $topic, $f, $b, $h, $e, $m, $q); $st->execute();
    }
    out(200, ["success" => true, "collection_id" => $cid]);
}

case "col_delete": {
    $uid = login_required(); $cid = (int)($in["collection_id"] ?? 0);
    $st = $conn->prepare("DELETE FROM collections WHERE id = ? AND user_id = ?");
    $st->bind_param("ii", $cid, $uid); $st->execute();
    out(200, ["success" => true]);
}

case "progress_save":
case "progress_get": {
    $uid = login_required();
    if ($action === "progress_save") {
        $total = (int)($in["total"] ?? 0); $correct = (int)($in["correct"] ?? 0);
        if ($total < 1 || $total > 50 || $correct < 0 || $correct > $total) out(400, ["success" => false, "message" => "Некоректний результат"]);
        $topic = mb_substr(trim($in["topic"] ?? ""), 0, 255);
        $st = $conn->prepare("INSERT INTO quiz_results (user_id, topic, correct, total) VALUES (?,?,?,?)");
        $st->bind_param("isii", $uid, $topic, $correct, $total); $st->execute();
    }
    $st = $conn->prepare("SELECT COUNT(*) AS tests, COALESCE(AVG(correct / total * 100), 0) AS avg FROM quiz_results WHERE user_id = ?");
    $st->bind_param("i", $uid); $st->execute(); $r = $st->get_result()->fetch_assoc();
    out(200, ["success" => true, "tests" => (int)$r["tests"], "average" => (int)round($r["avg"])]);
}

case "rating_save":
case "rating_get": {
    if ($action === "rating_save") {
        $uid = login_required();
        $stars = (int)($in["stars"] ?? 0); $comment = mb_substr(trim($in["comment"] ?? ""), 0, 500);
        if ($stars < 1 || $stars > 5) out(400, ["success" => false, "message" => "Обери оцінку від 1 до 5"]);
        $st = $conn->prepare("INSERT INTO ratings (user_id, stars, comment) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stars = VALUES(stars), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP");
        $st->bind_param("iis", $uid, $stars, $comment); $st->execute();
    }
    $s = $conn->query("SELECT COUNT(*) AS n, COALESCE(AVG(stars), 0) AS avg FROM ratings")->fetch_assoc();
    $recent = $conn->query("SELECT u.name, r.stars, r.comment FROM ratings r JOIN Users u ON u.id = r.user_id WHERE r.comment <> '' ORDER BY r.created_at DESC LIMIT 5")->fetch_all(MYSQLI_ASSOC);
    $mine = null;
    if (!empty($_SESSION["user_id"])) {
        $st = $conn->prepare("SELECT stars, comment FROM ratings WHERE user_id = ?");
        $st->bind_param("i", $_SESSION["user_id"]); $st->execute(); $mine = $st->get_result()->fetch_assoc();
    }
    out(200, ["success" => true, "count" => (int)$s["n"], "average" => round((float)$s["avg"], 1), "recent" => $recent, "mine" => $mine]);
}

default:
    out(400, ["success" => false, "message" => "Невідома дія"]);
}
