-- CareerPath AI - MySQL 8 schema (generated from backend/models.py)
CREATE DATABASE IF NOT EXISTS careerpath_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE careerpath_ai;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `careers`;
CREATE TABLE careers (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	title VARCHAR(120) NOT NULL, 
	description TEXT NOT NULL, 
	opportunities TEXT, 
	education_required JSON, 
	education_related JSON, 
	interest_keywords JSON, 
	work_environments JSON, 
	learning_path JSON, 
	is_active BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `courses`;
CREATE TABLE courses (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	title VARCHAR(200) NOT NULL, 
	platform VARCHAR(80) NOT NULL, 
	skill_category VARCHAR(60) NOT NULL, 
	level VARCHAR(20) NOT NULL, 
	description TEXT, 
	url VARCHAR(500) NOT NULL, 
	resource_type VARCHAR(20) NOT NULL, 
	skills JSON, 
	is_active BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_course_level CHECK (level IN ('beginner','intermediate','advanced'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_courses_category ON courses (skill_category);
CREATE INDEX ix_courses_level ON courses (level);

DROP TABLE IF EXISTS `skills`;
CREATE TABLE skills (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(80) NOT NULL, 
	category VARCHAR(60) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_skills_category ON skills (category);

DROP TABLE IF EXISTS `users`;
CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	full_name VARCHAR(120) NOT NULL, 
	`role` VARCHAR(20) NOT NULL, 
	is_active BOOL NOT NULL, 
	last_login DATETIME, 
	reset_token_hash VARCHAR(64), 
	reset_expires DATETIME, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_users_role CHECK (role IN ('student','admin')), 
	UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_users_role ON users (`role`);

DROP TABLE IF EXISTS `assessments`;
CREATE TABLE assessments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_assessments_user_created ON assessments (user_id, created_at);

DROP TABLE IF EXISTS `career_skills`;
CREATE TABLE career_skills (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	career_id INTEGER NOT NULL, 
	skill_id INTEGER NOT NULL, 
	required_level SMALLINT NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_career_skill UNIQUE (career_id, skill_id), 
	CONSTRAINT ck_career_skill_level CHECK (required_level BETWEEN 1 AND 3), 
	FOREIGN KEY(career_id) REFERENCES careers (id) ON DELETE CASCADE, 
	FOREIGN KEY(skill_id) REFERENCES skills (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_career_skills_skill ON career_skills (skill_id);

DROP TABLE IF EXISTS `chat_history`;
CREATE TABLE chat_history (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	`role` VARCHAR(10) NOT NULL, 
	message TEXT NOT NULL, 
	sources JSON, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_chat_role CHECK (role IN ('user','assistant')), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_chat_user_session ON chat_history (user_id, session_id, created_at);

DROP TABLE IF EXISTS `learning_roadmaps`;
CREATE TABLE learning_roadmaps (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	career_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_roadmap_user_career UNIQUE (user_id, career_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(career_id) REFERENCES careers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `resume_analysis`;
CREATE TABLE resume_analysis (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	target_career_id INTEGER, 
	original_filename VARCHAR(255), 
	page_count SMALLINT, 
	result JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(target_career_id) REFERENCES careers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_resume_user ON resume_analysis (user_id, created_at);

DROP TABLE IF EXISTS `saved_careers`;
CREATE TABLE saved_careers (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	career_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_saved_career UNIQUE (user_id, career_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(career_id) REFERENCES careers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `student_profiles`;
CREATE TABLE student_profiles (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	education_level VARCHAR(60), 
	degree VARCHAR(120), 
	department VARCHAR(120), 
	graduation_year INTEGER, 
	interests JSON, 
	favourite_subjects JSON, 
	work_environment VARCHAR(60), 
	career_goals TEXT, 
	learning_preference VARCHAR(60), 
	bio TEXT, 
	updated_at DATETIME, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `student_skills`;
CREATE TABLE student_skills (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	skill_id INTEGER NOT NULL, 
	level SMALLINT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_student_skill UNIQUE (user_id, skill_id), 
	CONSTRAINT ck_student_skill_level CHECK (level BETWEEN 1 AND 3), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(skill_id) REFERENCES skills (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `assessment_answers`;
CREATE TABLE assessment_answers (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	assessment_id INTEGER NOT NULL, 
	question_key VARCHAR(60) NOT NULL, 
	answer JSON, 
	PRIMARY KEY (id), 
	FOREIGN KEY(assessment_id) REFERENCES assessments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_answers_assessment ON assessment_answers (assessment_id);

DROP TABLE IF EXISTS `recommendations`;
CREATE TABLE recommendations (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	assessment_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	career_id INTEGER NOT NULL, 
	`rank` SMALLINT NOT NULL, 
	score NUMERIC(5, 2) NOT NULL, 
	breakdown JSON, 
	explanation JSON, 
	missing_skills JSON, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(assessment_id) REFERENCES assessments (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(career_id) REFERENCES careers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX ix_recs_assessment ON recommendations (assessment_id);
CREATE INDEX ix_recs_career ON recommendations (career_id);
CREATE INDEX ix_recs_user ON recommendations (user_id);

DROP TABLE IF EXISTS `roadmap_progress`;
CREATE TABLE roadmap_progress (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	roadmap_id INTEGER NOT NULL, 
	item_key VARCHAR(60) NOT NULL, 
	completed BOOL NOT NULL, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_progress_item UNIQUE (roadmap_id, item_key), 
	FOREIGN KEY(roadmap_id) REFERENCES learning_roadmaps (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
