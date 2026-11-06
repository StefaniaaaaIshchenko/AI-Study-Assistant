
<?php

session_start();

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/database.php";

// Дозволяємо тільки POST-запити
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Метод не дозволений"
    ]);
    exit;
}

// Отримуємо JSON від frontend
$data = json_decode(file_get_contents("php://input"), true);

$email = trim($data["email"] ?? "");
$password = $data["password"] ?? "";

// Перевіряємо заповнення полів
if ($email === "" || $password === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Заповніть усі поля"
    ]);
    exit;
}

// Перевіряємо формат email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Некоректна електронна пошта"
    ]);
    exit;
}

// Шукаємо користувача в базі даних
$stmt = $conn->prepare(
    "SELECT id, name, email, password FROM Users WHERE email = ?"
);

$stmt->bind_param("s", $email);
$stmt->execute();

$result = $stmt->get_result();
$user = $result->fetch_assoc();

// Перевіряємо існування користувача та пароль
if (!$user || !password_verify($password, $user["password"])) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Неправильна електронна пошта або пароль"
    ]);

    $stmt->close();
    $conn->close();
    exit;
}

// Створюємо сесію користувача
session_regenerate_id(true);

$_SESSION["user_id"] = $user["id"];
$_SESSION["user_name"] = $user["name"];
$_SESSION["user_email"] = $user["email"];

// Успішний вхід
http_response_code(200);

echo json_encode([
    "success" => true,
    "message" => "Вхід успішний",
    "user" => [
        "id" => $user["id"],
        "name" => $user["name"],
        "email" => $user["email"]
    ]
]);

$stmt->close();
$conn->close();

?>
