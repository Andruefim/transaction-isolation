## Description

A NestJS lab project for discovering how different **transaction isolation levels** work with MySQL. The app exposes endpoints to run isolation scenarios (e.g. dirty read) and compare behavior across `READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ`, and `SERIALIZABLE`.

## MySQL setup (Windows)

1. Ensure MySQL is installed and the server is running (e.g. port 3306).
2. Create a database and (optionally) a dedicated user:

```sql
CREATE DATABASE transaction_isolation_lab;
-- Optional: CREATE USER 'lab'@'localhost' IDENTIFIED BY 'your_password'; GRANT ALL ON transaction_isolation_lab.* TO 'lab'@'localhost';
```

3. Copy environment variables and set your connection details:

```bash
cp .env.example .env
```

Edit `.env` and set:

- `DB_HOST` – usually `localhost`
- `DB_PORT` – usually `3306`
- `DB_USERNAME` – your MySQL user (e.g. `root` or `lab`)
- `DB_PASSWORD` – password (leave empty if none)
- `DB_DATABASE` – `transaction_isolation_lab`
- `PORT` – optional; app default is 3000

**Note:** TypeORM is configured with `synchronize: true` for this lab so the demo table is created/updated automatically. Do not use this in production.

## Transaction isolation endpoints

After starting the app (e.g. `npm run start:dev`):

| Method | URL | Description |
|--------|-----|-------------|
| `POST` | `/transaction-isolation/reset` | Reset demo data (two accounts: Account A 1000, Account B 500). |
| `GET`  | `/transaction-isolation/scenarios/dirty-read?isolation=READ_UNCOMMITTED` | Run the dirty-read scenario with the given isolation level. |
| `GET`  | `/transaction-isolation/scenarios/:name?isolation=...` | Run any scenario by name; `isolation` can be `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`. |

Example: with `READ UNCOMMITTED`, Transaction B can see the uncommitted update from Transaction A (dirty read). With `READ COMMITTED` or stricter, B sees the previous committed value.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
