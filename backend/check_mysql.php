
<?php

$host = "127.0.0.1";
$username = "root";
$password = "root";
$port = 8889;

// Підключаємося до MySQL БЕЗ вибору бази даних
$conn = new mysqli($host, $username, $password, "", $port);

if ($conn->connect_error) {
    die("Помилка підключення: " . $conn->connect_error);
}

echo "<h2>PHP успішно підключився до MySQL!</h2>";

echo "<h3>Бази даних, які бачить PHP:</h3>";

$result = $conn->query("SHOW DATABASES");

while ($row = $result->fetch_array()) {
    echo htmlspecialchars($row[0]) . "<br>";
}

$conn->close();

?>
