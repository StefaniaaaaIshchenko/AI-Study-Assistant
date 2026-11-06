
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        try {
            const response = await fetch("../backend/login.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert("Вітаємо, " + result.user.name + "!");

                // Перехід до головного меню
                window.location.href = "index.html";
            } else {
                alert(result.message || "Помилка входу");
            }

        } catch (error) {
            console.error("Помилка входу:", error);
            alert("Не вдалося зв'язатися із сервером");
        }
    });
});
