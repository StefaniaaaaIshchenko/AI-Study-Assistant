-- =============================================================
-- AI Study Assistant — структура бази даних (MySQL 8, utf8mb4)
-- Імпорт: phpMyAdmin → вкладка «Імпорт» → обрати цей файл
-- або: mysql -u root -p < database/schema.sql
-- Примітка: backend/api.php також створює ці таблиці автоматично,
-- якщо їх немає, тож імпорт потрібен лише для чистого розгортання.
-- =============================================================

CREATE DATABASE IF NOT EXISTS ai_study_assistant
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ai_study_assistant;

-- Користувачі
CREATE TABLE IF NOT EXISTS Users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(190) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL COMMENT 'bcrypt-хеш (password_hash)',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB CHARACTER SET utf8mb4;

-- Навчальні матеріали (текст, витягнутий із PDF/TXT у браузері)
CREATE TABLE IF NOT EXISTS study_materials (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  content     MEDIUMTEXT NOT NULL,
  pages       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4;

-- Колекції флеш-карток
CREATE TABLE IF NOT EXISTS collections (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(120) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4;

-- Флеш-картки (видаляються разом із колекцією)
CREATE TABLE IF NOT EXISTS flashcards (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  collection_id  INT NOT NULL,
  topic          VARCHAR(255) NOT NULL DEFAULT '',
  front          TEXT NOT NULL,
  back           TEXT NOT NULL,
  hint           TEXT NULL,
  emoji          VARCHAR(32) NULL,
  mnemonic       TEXT NULL,
  image_query    VARCHAR(120) NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4;

-- Результати тестів (для статистики прогресу)
CREATE TABLE IF NOT EXISTS quiz_results (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  topic       VARCHAR(255) NULL,
  correct     INT NOT NULL,
  total       INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4;

-- Оцінки сайту (одна на користувача)
CREATE TABLE IF NOT EXISTS ratings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  stars       TINYINT NOT NULL,
  comment     VARCHAR(500) NOT NULL DEFAULT '',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user (user_id),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4;
