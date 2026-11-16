<?php
// Скопіюй цей файл у config.php і впиши свій ключ (або задай змінну середовища OPENAI_API_KEY).
// config.php не потрапляє в git.
return ["openai_key" => getenv("OPENAI_API_KEY") ?: "",
"model" => "gpt-4o-mini"];
