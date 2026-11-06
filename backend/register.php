
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/database.php";

// Дозволяємо тільки POST-запити
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Метод не дозволений"]);
    exit;
}

// Отримуємо дані від frontend
$data = json_decode(file_get_contents("php://input"), true);

$name = trim($data["name"] ?? "");
$email = trim($data["email"] ?? "");
$password = $data["password"] ?? "";

// Перевіряємо заповнення полів
if ($name === "" || $email === "" || $password === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Заповніть усі поля"]);
    exit;
}

// Перевіряємо email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Некоректна електронна пошта"]);
    exit;
}

// Перевіряємо довжину пароля
if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Пароль має містити мінімум 8 символів"]);
    exit;
}

// Перевіряємо, чи існує користувач
$stmt = $conn->prepare("SELECT id FROM Users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows > 0) {
    http_response_code(409);
    echo json_encode(["success" => false, "message" => "Ця електронна пошта вже зареєстрована"]);
    $stmt->close();
    exit;
}

$stmt->close();

// Хешуємо пароль
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Додаємо користувача до бази
$stmt = $conn->prepare(
    "INSERT INTO Users (name, email, password) VALUES (?, ?, ?)"
);

$stmt->bind_param("sss", $name, $email, $hashedPassword);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Реєстрація успішна",
        "user_id" => $stmt->insert_id
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Помилка під час реєстрації"
    ]);
}

$stmt->close();
$conn->close();
