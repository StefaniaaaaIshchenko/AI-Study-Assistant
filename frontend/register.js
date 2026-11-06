
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("register-form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Отримуємо значення полів
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm-password").value;

        // Перевіряємо підтвердження пароля
        if (password !== confirmPassword) {
            alert("Паролі не збігаються!");
            return;
        }

        if (password.length < 8) {
            alert("Пароль повинен містити мінімум 8 символів!");
            return;
        }

        try {
            // Відправляємо дані на PHP-сервер
            const response = await fetch("../backend/register.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert("Реєстрація успішна!");

                form.reset();

                // Переходимо на сторінку входу
                window.location.href = "login.html";
            } else {
                alert(result.message || "Не вдалося зареєструватися.");
            }

        } catch (error) {
            console.error("Помилка:", error);
            alert("Не вдалося зв'язатися із сервером. Перевір підключення.");
        }
    });
});

