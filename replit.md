# AI Resume Builder

A full-stack AI-powered resume builder that lets users create, manage, and download professional resumes using multiple templates, with AI-assisted content generation.

## Architecture

- **Frontend**: React 19 + Vite + Tailwind CSS 4, running on port 5000
- **Backend**: Node.js + Express 5, running on port 3000
- **Database**: MongoDB (via Mongoose)
- **AI**: Grok API (OpenAI-compatible) for resume content generation
- **Storage**: ImageKit for profile image uploads
- **Auth**: JWT-based authentication with bcrypt password hashing

## Project Layout

```
client/         React frontend (Vite)
  src/
    app/        Redux store + auth slice
    components/ Reusable UI (home sections, resume templates)
    configs/    Axios API client (uses VITE_BASE_URL)
    pages/      Dashboard, Login, Register, ResumeBuilder, etc.

server/         Node.js backend (Express)
  configs/      DB, AI (Grok), ImageKit, Multer configs
  controllers/  resumeController, userController, aiController
  middlewares/  authMiddleware (JWT)
  models/       User, Resume (Mongoose schemas)
  routes/       /api/users, /api/resumes, /api/ai
  server.js     Entry point
```

## Environment Variables / Secrets

All secrets are stored in Replit Secrets:

| Secret | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit URL endpoint |
| `GROK_API_KEY` | Grok AI API key |
| `GROK_API_URL` | Grok AI base URL |

Non-sensitive env vars (in Replit environment):
| Variable | Value |
|---|---|
| `VITE_BASE_URL` | `http://localhost:3000` (dev) |

## Workflows

- **Start application** — `cd client && npm run dev` → port 5000 (webview)
- **Backend Server** — `cd server && node server.js` → port 3000 (console)

## Deployment

Configured for autoscale deployment:
- **Build**: installs deps + builds React app (`client/dist`)
- **Run**: starts the Node.js backend on port 3000

> Note: For production, the backend should serve the built frontend static files, or a reverse proxy / CDN should be configured to serve `client/dist`.
