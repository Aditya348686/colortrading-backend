# Color Trading Gaming Platform

A mobile-first React + Node.js gaming platform scaffold with Firebase Authentication, MongoDB models, JWT, Razorpay placeholders, and PWA support.

## Structure

- `frontend/` - React app for UI
- `backend/` - Express API and MongoDB models

## Quick start

### Frontend

1. `cd frontend`
2. `npm install`
3. `npm start`

### Backend

1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env`
4. Fill out `MONGO_URI`, `JWT_SECRET`, `FIREBASE_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
5. `npm start`

## Notes

- Firebase Authentication is integrated in the frontend with configuration placeholders.
- Razorpay checkout is stubbed via backend route.
- The UI is designed for mobile-first dark theme with glassmorphism effects.
