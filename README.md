# FastAPI + Next.js + MongoDB CRUD Project

This project has a FastAPI backend, a Next.js frontend, and MongoDB as the database.

## Project Structure

```text
crud-project/
  backend/
    main.py
    database.py
    schemas.py
    models.py
    requirements.txt
    .env
    .env.example
    venv/
  frontend/
    app/
    public/
    package.json
    package-lock.json
    .env.local.example
  .vscode/
    settings.json
    tasks.json
```

## Backend Setup

From the project root:

```powershell
cd backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend URL:

```text
http://localhost:8000
```

FastAPI docs:

```text
http://localhost:8000/docs
```

## Frontend Setup

From the project root:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Frontend URL:

```text
http://localhost:3000
```

## Environment Files

Backend:

```text
backend/.env
```

Example:

```env
MONGO_URL=mongodb://localhost:27017
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
ADMIN_TOKEN_SECRET=replace-with-a-long-random-secret
ADMIN_TOKEN_EXPIRES_SECONDS=43200
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Frontend local override:

```text
frontend/.env.local
```

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Authentication Behavior

- `POST /users` stays public for signup creation.
- `GET /users`, `GET /users/tree`, `GET /dashboard/stats`, `PUT /users/{id}`, and `DELETE /users/{id}` now require admin login.
- Admin login is verified by FastAPI on the backend.
- The frontend stores the returned admin token in browser local storage and sends it with protected requests.

## VS Code Tasks

Open Command Palette and run `Tasks: Run Task`.

Available tasks:

- `Backend: install packages`
- `Backend: run FastAPI`
- `Frontend: install packages`
- `Frontend: run Next.js`

## Installed Packages

Backend packages are listed in `backend/requirements.txt`.

Frontend packages are listed in `frontend/package.json`.
