<?php
// Скопіюй цей файл у config.php і впиши ключ. config.php не потрапляє в git.
return [
    "provider"   => "gemini",   // який AI використовувати: "openai", "gemini" або "groq"
    "gemini_key" => getenv("GEMINI_API_KEY") ?: "",   // безкоштовно: aistudio.google.com → Get API key
    "groq_key"   => getenv("GROQ_API_KEY") ?: "",     // безкоштовно: console.groq.com → API Keys
    "openai_key" => getenv("OPENAI_API_KEY") ?: "",   // платно: platform.openai.com
    "model"      => "gpt-4o-mini",                    // модель OpenAI
    // необов'язково: "gemini_model" => "gemini-flash-latest", "groq_model" => "llama-3.3-70b-versatile",
];
