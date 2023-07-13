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
    caption TEXT, -- new field for captions
    img_order INT, -- new field for order
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);
