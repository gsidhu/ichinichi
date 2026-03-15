# Ichinichi

A minimalist daily notes application designed to help you build and maintain a consistent writing habit. Simple, local-first, and distraction-free.

<img width="1564" height="1061" alt="Image" src="https://github.com/user-attachments/assets/c7ce4046-7f63-46e9-aeb6-4d2bd7d67194" />

## Why Ichinichi?

いちにち (_ichi nichi_) means _one day_ in Japanese.

### 📝 **Minimalist Design for Consistency**

- **One Note Per Day**: No complexity, no distractions—just write
- **Read-Only Past**: Protect your streak by preventing edits to previous days
- **Future Dates Disabled**: Focus on today, not tomorrow
- **Empty Note Auto-Delete**: If you write nothing, nothing is saved—keeping your calendar clean

### 🎯 **Exceptional User Experience**

- **Instant Start**: Write immediately—no account required
- **Year-at-a-Glance**: Visual calendar shows your writing streak at a glance
- **Local-First**: Fast performance with local SQLite storage
- **Responsive Design**: Beautiful on desktop, tablet, and mobile
- **Keyboard Navigation**: Escape to close, arrows to navigate

## Features

- **Local Storage**: Notes live in a local SQLite database for maximum privacy and speed
- **Visual Indicators**: Days with notes show a small dot indicator
- **Auto-Save with Status**: Your work is saved automatically as you type, with a "Last saved at" indicator
- **Inline Images**: Paste or drag images directly into your notes

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **SQLite (better-sqlite3)** - Local persistence
- **Express** - Backend API
- **CSS Custom Properties** - Theming system

## Getting Started

### Prerequisites

- Node.js 18+ or higher
- npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ichinichi.git
cd ichinichi
```

2. Install dependencies for both frontend and backend:

```bash
npm install
cd server
npm install
cd ..
```

3. Start the application:

**Start the backend server:**
```bash
node server/index.js
```

**In a new terminal, start the frontend:**
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
src/
├── components/          # React components (Calendar, NoteEditor, etc.)
├── controllers/         # View models and orchestration
├── hooks/              # Custom React hooks (state, repository access)
├── storage/            # Data layer (SQLite API adapters)
└── stores/             # Zustand state management
server/
└── index.js            # SQLite backend API
```

## Development

### Code Style

This project uses:

- ESLint for code linting
- TypeScript strict mode
- Consistent code formatting

Run the linter:

```bash
npm run lint
```

## License

MIT License - feel free to use this project however you'd like.

---

Made with care by katspaugh
