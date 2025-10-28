# Copilot Instructions for Smart_Hardware Codebase

## Overview
This project is a full-stack web application for a smart hardware shop, with a React frontend and a Node.js/Express/MongoDB backend. The backend exposes REST APIs for user, product, order, review, payment, and notification management. The frontend is organized by feature and uses React Context for authentication and theming.

## Architecture
- **Backend** (`backend/`):
  - **Entry:** `backend/app.js` (Express app, MongoDB connection, route mounting)
  - **Routes:** `backend/Route/` (REST endpoints, e.g., `/api/users`, `/api/orders`)
  - **Controllers:** `backend/Controlers/` (business logic per resource)
  - **Models:** `backend/Model/` (Mongoose schemas)
  - **Middleware:** `backend/middleware/` (auth, permissions)
  - **Uploads:** `backend/uploads/` (static file serving for images, slips, reviews)
- **Frontend** (`frontend/`):
  - **Entry:** `frontend/src/index.js`
  - **Feature folders:** `frontend/src/components/` (e.g., `Auth/`, `Admin/`, `Order/`)
  - **Auth Context:** `frontend/src/components/context/AuthContext.js` (handles login, signup, token, theme)
  - **API URLs:** Default to `http://localhost:5000` (see `AuthContext.js`)

## Developer Workflows
- **Backend:**
  - Start: `cd backend && npm start` (uses `nodemon`)
  - Main port: `5000`
  - MongoDB: Atlas connection string in `app.js`
  - Add new endpoints: create route/controller/model, mount in `app.js`
- **Frontend:**
  - Start: `cd frontend && npm start` (CRA dev server, port `3000`)
  - Build: `npm run build`
  - Test: `npm test` (Jest, React Testing Library)
  - Auth: Use `useAuth()` from `AuthContext.js` for login, signup, etc.

## Project Conventions
- **API endpoints:**
  - RESTful, versionless, prefixed with `/api/` for most resources
  - Some routes (e.g., `/users`, `/roles`) are also available without `/api/`
- **Auth:**
  - JWT-based, token stored in localStorage/sessionStorage
  - Attach `Authorization: Bearer <token>` for protected endpoints
- **File uploads:**
  - Images and slips are uploaded to `/uploads/` and served statically
- **Roles:**
  - User roles: `admin`, `supplier`, `customer care manager`, `customer`
  - Role-based redirects after login (see `Login.js`)
- **Frontend patterns:**
  - Feature-based folder structure
  - Context for auth/theme
  - Use `fetch` for API calls (see `AuthContext.js`)

## Integration Points
- **Stripe:** Payment integration via `stripe` and `@stripe/react-stripe-js`
- **CORS:** Backend allows requests from `http://localhost:3000`
- **Environment:**
  - Frontend: `REACT_APP_API_URL` can override API base URL

## Examples
- **Add a new backend resource:** Create model, controller, route, mount in `app.js`
- **Add a new frontend page:** Add component under `src/components/Feature/`, add route in `App.js`
- **Auth usage:**
  ```js
  const { user, login, logout } = useAuth();
  ```

## Key Files
- `backend/app.js`, `frontend/src/components/context/AuthContext.js`, `frontend/src/components/Auth/Login.js`

---
_If any section is unclear or missing, please provide feedback for improvement._
