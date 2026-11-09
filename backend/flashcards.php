<?php
session_start();
header("Content-Type: application/json; charset=UTF-8");
require_once __DIR__ . "/database.php";

// Ключ береться зі змінної середовища або з config.php (НЕ клади його у frontend і не заливай у git)
// config.php:  <?php return ["anthropic_key" => "sk-ant-..."];
const MODEL = "claude-sonnet-5-5";

function out($code, $arr) { http_response_code($code); echo json_encode($arr, JSON_UNESCAPED_UNICODE); exit; }

if ($_SERVER["REQUEST_METHOD"] !== "POST") out(405, ["success" => false, "message" => "Метод не дозволений"]);
$in = json_decode(file_get_contents("php://input"), true) ?: [];
$action = $in["action"] ?? "";
$uid = $_SESSION["user_id"] ?? null;

/* ---------- Генерація (доступна й без входу) ---------- */
if ($action === "generate") {
    $topic = trim($in["topic"] ?? "");
    $kind = in_array($in["kind"] ?? "", ["term", "word", "thesis", "formula"]) ? $in["kind"] : "auto";
    $count = max(4, min(20, (int)($in["count"] ?? 8)));
    if ($topic === "" || mb_strlen($topic) > 6000) out(400, ["success" => false, "message" => "Введи тему або текст (до 6000 символів)"]);

    $cfg = is_file(__DIR__ . "/config.php") ? require __DIR__ . "/config.php" : [];
    $key = getenv("ANTHROPIC_API_KEY") ?: ($cfg["anthropic_key"] ?? "");
    if (!$key) out(500, ["success" => false, "message" => "На сервері не налаштований API-ключ"]);

    $system = "Ти створюєш флеш-картки для навчання. Відповідай ЛИШЕ валідним JSON без markdown: "
      . '{"title":"коротка назва набору","cards":[{"type":"term|word|thesis|formula","front":"...","sub":"транскрипція/категорія або порожньо","back":"...","mnemonic":"коротка яскрава асоціація для запам\'ятовування","emoji":"1-2 емодзі, що асоціюються з поняттям"}]}. '
      . "Правила: мова карток — українська (для іноземних слів front — слово мовою оригіналу, sub — транскрипція, back — переклад і приклад речення). "
      . "term: front — поняття, back — чітке визначення в 1–2 реченнях. thesis: front — питання, back — теза. "
      . "formula: front — формула (простим текстом, напр. v = s / t), back — що означають змінні й коли застосовують. "
      . "Якщо тип auto — обери найкращий для теми. Не вигадуй фактів.";
    $user = "Тема/матеріал: $topic\nТип: $kind\nКількість карток: $count";

    $ch = curl_init("https://api.anthropic.com/v1/messages");
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => ["content-type: application/json", "x-api-key: $key", "anthropic-version: 2023-06-01"],
        CURLOPT_POSTFIELDS => json_encode(["model" => MODEL, "max_tokens" => 4000, "system" => $system,
            "messages" => [["role" => "user", "content" => $user]]], JSON_UNESCAPED_UNICODE),
    ]);
    $res = curl_exec($ch); $http = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $text = json_decode($res, true)["content"][0]["text"] ?? "";
    $text = trim(preg_replace('/^```(?:json)?|```$/m', "", $text));
    $data = json_decode($text, true);
    if ($http !== 200 || !isset($data["cards"]) || !is_array($data["cards"])) out(502, ["success" => false, "message" => "Не вдалося створити картки, спробуй ще раз"]);

    $cards = [];
    foreach ($data["cards"] as $c) {
        if (empty($c["front"]) || empty($c["back"])) continue;
        $t = in_array($c["type"] ?? "", ["term", "word", "thesis", "formula"]) ? $c["type"] : "term";
        $cards[] = ["type" => $t, "front" => (string)$c["front"], "sub" => (string)($c["sub"] ?? ""), "back" => (string)$c["back"],
                    "mnemonic" => (string)($c["mnemonic"] ?? ""), "emoji" => mb_substr((string)($c["emoji"] ?? ""), 0, 8), "image_url" => ""];
    }
    out(200, ["success" => true, "title" => (string)($data["title"] ?? $topic), "cards" => $cards]);
}

/* ---------- Далі потрібен вхід ---------- */
if (!$uid) out(401, ["success" => false, "message" => "Увійди в акаунт, щоб користуватися колекціями"]);

if ($action === "collections") {
    $st = $conn->prepare("SELECT c.id, c.name, COUNT(f.id) AS cards FROM collections c LEFT JOIN flashcards f ON f.collection_id = c.id WHERE c.user_id = ? GROUP BY c.id ORDER BY c.created_at DESC");
    $st->bind_param("i", $uid); $st->execute();
    out(200, ["success" => true, "collections" => $st->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === "save") {
    $cards = $in["cards"] ?? [];
    if (!is_array($cards) || !$cards || count($cards) > 50) out(400, ["success" => false, "message" => "Немає карток для збереження"]);
    $cid = (int)($in["collection_id"] ?? 0);
    $new = mb_substr(trim($in["new_name"] ?? ""), 0, 80);

    if ($cid) {
        $st = $conn->prepare("SELECT id, name FROM collections WHERE id = ? AND user_id = ?");
        $st->bind_param("ii", $cid, $uid); $st->execute();
        $col = $st->get_result()->fetch_assoc();
        if (!$col) out(404, ["success" => false, "message" => "Колекцію не знайдено"]);
    } elseif ($new !== "") {
        $st = $conn->prepare("INSERT INTO collections (user_id, name) VALUES (?, ?)");
        $st->bind_param("is", $uid, $new);
        if (!$st->execute()) out(409, ["success" => false, "message" => "Колекція з такою назвою вже є"]);
        $col = ["id" => $st->insert_id, "name" => $new];
    } else out(400, ["success" => false, "message" => "Обери колекцію або введи назву"]);

    $st = $conn->prepare("INSERT INTO flashcards (collection_id, type, front, sub, back, mnemonic, emoji, image_url) VALUES (?,?,?,?,?,?,?,?)");
    $n = 0;
    foreach ($cards as $c) {
        $t = in_array($c["type"] ?? "", ["term", "word", "thesis", "formula"]) ? $c["type"] : "term";
        $f = (string)($c["front"] ?? ""); $s = (string)($c["sub"] ?? ""); $b = (string)($c["back"] ?? "");
        $m = (string)($c["mnemonic"] ?? ""); $e = mb_substr((string)($c["emoji"] ?? ""), 0, 8); $u = (string)($c["image_url"] ?? "");
        if ($f === "" || $b === "") continue;
        $st->bind_param("isssssss", $col["id"], $t, $f, $s, $b, $m, $e, $u);
        if ($st->execute()) $n++;
    }
    out(200, ["success" => true, "saved" => $n, "collection" => $col["name"]]);
}

if ($action === "cards") {
    $cid = (int)($in["collection_id"] ?? 0);
    $st = $conn->prepare("SELECT name FROM collections WHERE id = ? AND user_id = ?");
    $st->bind_param("ii", $cid, $uid); $st->execute();
    $col = $st->get_result()->fetch_assoc();
    if (!$col) out(404, ["success" => false, "message" => "Колекцію не знайдено"]);
    $st = $conn->prepare("SELECT type, front, sub, back, mnemonic, emoji, image_url FROM flashcards WHERE collection_id = ? ORDER BY id");
    $st->bind_param("i", $cid); $st->execute();
    out(200, ["success" => true, "name" => $col["name"], "cards" => $st->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === "delete_collection") {
    $cid = (int)($in["collection_id"] ?? 0);
    $st = $conn->prepare("DELETE FROM collections WHERE id = ? AND user_id = ?");
    $st->bind_param("ii", $cid, $uid); $st->execute();
    out(200, ["success" => true]);
}

out(400, ["success" => false, "message" => "Невідома дія"]);
