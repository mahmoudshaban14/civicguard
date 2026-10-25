# CivicGuard 🛡️

CivicGuard is a real-time community incident reporting and civic safety platform. It enables citizens to report local civic issues (such as road hazards, fallen trees, damaged streetlights, graffiti, or security incidents) with photo evidence, geolocation, and AI-powered categorisation, while giving municipal authorities an admin dashboard to review, track, and resolve incidents.

---

## 🏗️ Repository Architecture

This repository contains:

- **Mobile Client (`/`)**: React Native & Expo mobile application for iOS, Android, and Web.
- **Admin Dashboard (`/admin-dashboard`)**: Vite + React web portal for municipal staff to manage and resolve reported incidents.
- **Backend & Database (`/supabase`)**: Supabase PostgreSQL migrations, Row-Level Security (RLS) policies, and storage configurations.

---

## 🚀 Tech Stack

### Mobile Application
- **Framework**: [Expo](https://expo.dev/) (SDK 57) & [React Native](https://reactnative.dev/) (v0.86)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Styling**: [Uniwind](https://github.com/uniwind) / Tailwind CSS (v4)
- **State Management**: React Context & Hooks + Zustand
- **Storage & Auth**: [Supabase](https://supabase.com/) (`@supabase/supabase-js`) & AsyncStorage
- **Maps**: `react-native-maps` / `pigeon-maps` (Web)

### Admin Dashboard
- **Framework**: [React](https://react.dev/) 19 & [Vite](https://vitejs.dev/)
- **Backend SDK**: `@supabase/supabase-js`

### Backend
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage (`report-images` private bucket)
- **Auth**: Supabase Auth (Email / Password with RLS)

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) `>= 20.19.4`
- [npm](https://www.npmjs.com/)
- Expo Go on iOS or Android (optional, for physical device testing)

---

### Running the Mobile App

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Launch on platforms:**
   - Press `a` for Android Emulator
   - Press `i` for iOS Simulator
   - Press `w` for Web preview
   - Scan the terminal QR code with Expo Go to run on a physical device.

---

### Running the Admin Dashboard

1. **Navigate to the dashboard directory:**
   ```bash
   cd admin-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create an `.env` file in `admin-dashboard`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the Vite dev server:**
   ```bash
   npm run dev
   ```

---

### Database Migrations (Supabase)

Database migrations are located in [`supabase/migrations/`](./supabase/migrations).

If using the Supabase CLI:
```bash
supabase db push
```

---

## 📜 Available Scripts (Mobile App)

| Command | Description |
| :--- | :--- |
| `npm start` | Start the Expo development server |
| `npm run android` | Run the app on an Android device or emulator |
| `npm run ios` | Run the app on an iOS simulator |
| `npm run export:web` | Export static web assets |
| `npm run build:pwa` | Export web assets and generate Workbox PWA service worker |
| `npm run lint` | Run Oxlint linter with type-checking |
| `npm run lint:css` | Validate CSS tokens and Tailwind styling |
| `npm run format` | Auto-format codebase using `oxfmt` |
