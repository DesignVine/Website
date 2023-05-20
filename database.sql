CREATE DATABASE designvine;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    firstname VARCHAR(200) NOT NULL,
    lastname VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    password VARCHAR(200) NOT NULL,
    UNIQUE (email)
);

CREATE TABLE projects (
    project_id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGSERIAL NOT NULL,
    firstname VARCHAR(200) NOT NULL,
    lastname VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    description VARCHAR(200),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE messages (
    message_id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGSERIAL NOT NULL,
    project_id BIGSERIAL NOT NULL,
    message TEXT,
    img varchar(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);
CREATE TABLE user_info (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGINT NOT NULL,
    profile_picture VARCHAR(200),
    twitter_link VARCHAR(200),
    facebook_link VARCHAR(200),
    instagram_link VARCHAR(200),
    phone_number VARCHAR(20),
    business_description VARCHAR(200),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
