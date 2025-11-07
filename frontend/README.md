# ChatGPT Local Demo - Frontend

A modern, clean React frontend for a ChatGPT-like web application, built with Vite, React, and Tailwind CSS.

## Features

- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- 💬 **Chat Interface**: ChatGPT-like chat experience with user and bot messages
- 📁 **File Upload**: Drag-and-drop file upload for OCR processing (placeholder)
- 🔍 **Search**: Search through chats and documents (mock implementation)
- 💾 **Local Storage**: Chat persistence using localStorage
- 🎯 **State Management**: Zustand for global state management
- 🚀 **Fast Development**: Vite for lightning-fast HMR

## Project Structure

```
frontend/
├── src/
│   ├── components/      # UI components
│   │   ├── ChatBox.jsx
│   │   ├── ChatBubble.jsx
│   │   ├── FileUpload.jsx
│   │   ├── SearchBar.jsx
│   │   ├── Sidebar.jsx
│   │   └── TopBar.jsx
│   ├── pages/          # Page components
│   │   └── Home.jsx
│   ├── hooks/          # Custom React hooks
│   │   ├── useChatCache.js
│   │   └── useSearch.js
│   ├── store/          # Zustand stores
│   │   └── chatStore.js
│   ├── utils/          # Utility functions
│   │   ├── formatting.js
│   │   ├── idGenerator.js
│   │   ├── mockApi.js
│   │   └── storage.js
│   ├── data/           # Mock data
│   │   ├── mockChats.json
│   │   ├── mockOCRResults.json
│   │   └── mockResponses.json
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

### Chat Tab
- Start a new conversation by clicking "New Chat" in the sidebar
- Type messages and receive mock bot responses
- View chat history in the sidebar
- Clear or delete chats as needed

### Upload Tab
- Drag and drop files or click "Browse Files"
- Supports PDF, JPG, and PNG files
- Upload and process files (mock implementation)

### Search Tab
- Search through your chat history and uploaded documents
- Click on search results to navigate to relevant chats

## Technologies Used

- **React 18**: UI library
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **React Router DOM**: Client-side routing
- **Zustand**: Lightweight state management
- **Lucide React**: Icon library

## Mock Data

The app uses mock data for:
- Bot responses (randomized responses from a predefined set)
- OCR results (sample document data)
- Initial chat history

## Future Integration Points

The codebase is structured to easily integrate:
- **LLM API**: Replace `generateMockResponse` in `src/utils/mockApi.js`
- **OCR API**: Replace upload handler in `src/components/FileUpload.jsx`
- **Search API**: Replace search logic in `src/hooks/useSearch.js`
- **Backend API**: Add API service layer in `src/utils/api.js`

## Notes

- All chat data is stored in localStorage
- No backend is required for the current implementation
- All API calls are mocked with simulated delays
- The app is fully functional as a frontend-only demo

