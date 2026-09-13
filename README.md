# FROSTLINK — New Chat App

A brand-new real-time messaging app inspired only *lightly* by the supplied FROSTLINK screenshot. The implementation is original and designed around the requested feature set.

## Stack
- Frontend: React + Vite, deploy to Vercel
- Backend: Express + Socket.IO, deploy to Render
- Auth/database/storage: Supabase + Google OAuth
- Styling: original glass UI with selectable backgrounds

## Run locally
1. `cd frontend && npm install && npm run dev`
2. `cd backend && npm install && npm run dev`
3. Create Supabase project, enable Google under Authentication → Providers.
4. Run `supabase/schema.sql` in Supabase SQL Editor.
5. Copy `.env.example` files to `.env` and fill values.

Frontend env:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

Backend env:
- `PORT`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GIPHY_API_KEY` (optional)

## Deployment
- Vercel: root directory `frontend`, build `npm run build`, output `dist`.
- Render: root directory `backend`, build `npm install`, start `npm start`.
- Put the production URLs in the corresponding env variables.

## Important
This is a production-oriented foundation, not a fake static mock. File uploads use Supabase Storage, auth is Supabase Google OAuth, realtime chat uses Socket.IO, and the database uses conversation/member/message tables.
