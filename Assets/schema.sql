CREATE TABLE Players (
	email TEXT NOT NULL UNIQUE
	username TEXT NOT NULL UNIQUE
	hashed_password TEXT NOT NULL
	games_played INT
	wins INT
	PRIMARY KEY (username)
);