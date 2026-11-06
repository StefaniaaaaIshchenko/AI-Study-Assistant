
<?php

// Підключаємо файл з налаштуваннями бази даних
require_once "database.php";

echo "<h2>Підключення до бази даних успішне!</h2>";

// Перевіряємо наявність таблиць
$result = $conn->query("SHOW TABLES");

if ($result) {
    echo "<h3>Таблиці в базі даних:</h3>";

    while ($row = $result->fetch_array()) {
        echo $row[0] . "<br>";
    }
} else {
    echo "Помилка отримання таблиць: " . $conn->error;
}

// Закриваємо підключення
$conn->close();

?>
