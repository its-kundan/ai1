# Premium UI Components Documentation

## Overview

This document describes the premium UI components created for the ChatGPT Local Demo application, including the Features Dropdown, Enhanced Chat Input, and Dark Theme Toggle.

## Components

### 1. FeaturesDropdown

**Location:** `src/components/FeaturesDropdown.jsx`

**Description:** A premium dropdown component with glassmorphism effects that allows users to enable/disable features for the current chat session.

**Features:**
- 5 feature toggles: OCR, Search, CDR, IPDR, Bank statement
- Glassmorphism styling with backdrop blur
- Keyboard navigation (Arrow keys, Enter, Escape)
- ARIA attributes for accessibility
- Toast notifications on feature toggle
- Select all / Deselect all functionality
- Responsive design (mobile-friendly)

**Props:**
```jsx
<FeaturesDropdown
  features={{ ocr: boolean, search: boolean, cdr: boolean, ipdr: boolean, bank: boolean }}
  onFeatureChange={(features) => void}
  placement="bottom-right" | "top-right"
/>
```

**Default Features:**
- OCR: `true` (enabled by default)
- Search: `true` (enabled by default)
- CDR: `false`
- IPDR: `false`
- Bank: `false`

**Keyboard Navigation:**
- `Tab` - Focus trigger button
- `Enter/Space` - Open/close dropdown
- `ArrowDown/ArrowUp` - Navigate items
- `Enter` - Toggle selected feature
- `Escape` - Close dropdown

**Accessibility:**
- `aria-haspopup="menu"`
- `aria-expanded` state
- `role="menu"` and `role="menuitemcheckbox"`
- `aria-checked` for toggle states
- Focus management

---

### 2. ChatInput

**Location:** `src/components/ChatInput.jsx`

**Description:** Enhanced chat input component with file upload, drag-and-drop, file chips, OCR progress indicators, and integrated Features dropdown.

**Features:**
- File upload (PDF, PNG, JPG)
- Drag-and-drop support
- File chips with type badges
- OCR progress indicators
- Auto-run OCR when enabled
- Features dropdown integration
- Responsive layout (mobile/desktop)

**Props:**
```jsx
<ChatInput
  value={string}
  onChange={(value) => void}
  onSubmit={(message, files) => void}
  onUpload={(file) => { document_id, filepath }}
  onRunOCR={(documentId) => void}
  features={{ ocr: boolean, search: boolean, cdr: boolean, ipdr: boolean, bank: boolean }}
  onFeatureChange={(features) => void}
  disabled={boolean}
/>
```

**File Upload Flow:**
1. User selects/drops file
2. File chip appears with upload progress
3. If OCR enabled, automatically runs OCR after upload
4. Shows OCR progress and results
5. Displays extracted fields preview

**Responsive Behavior:**
- Desktop: Features dropdown inside input (right side)
- Mobile: Features dropdown above input area

---

### 3. TopBar (Updated)

**Location:** `src/components/TopBar.jsx`

**Description:** Top navigation bar with dark theme toggle and settings icon.

**Features:**
- Dark/Light theme toggle with smooth animation
- Theme persistence (localStorage)
- System preference detection
- Accessible toggle button

**Theme Toggle:**
- Animated sliding toggle
- Sun/Moon icons
- Persists preference across sessions
- Respects system `prefers-color-scheme`

---

## Theme System

### Theme Store

**Location:** `src/store/themeStore.js`

Zustand store for theme management:
```jsx
const { theme, toggleTheme, setTheme } = useThemeStore()
```

### Theme Utilities

**Location:** `src/utils/theme.js`

Functions:
- `getStoredTheme()` - Get theme from localStorage or system preference
- `setTheme(theme)` - Set and persist theme
- `initTheme()` - Initialize theme on app load

### Design Tokens

**Location:** `src/index.css`

CSS custom properties for light/dark themes:
- Color variables (bg, text, border, accent)
- Shadow tokens
- Border radius tokens
- Smooth transitions

---

## Accessibility Features

### Keyboard Navigation
- Full keyboard support for all interactive elements
- Focus management in dropdowns
- Tab order follows visual hierarchy
- Escape key closes modals/dropdowns

### Screen Reader Support
- ARIA labels on all buttons
- ARIA roles (menu, menuitemcheckbox)
- ARIA states (expanded, checked)
- Live regions for status updates
- Semantic HTML structure

### Visual Accessibility
- WCAG AA contrast ratios
- Focus indicators (2px outline)
- High contrast mode support
- Reduced motion support (via CSS)

---

## Responsive Design

### Breakpoints
- Mobile: `< 640px` (sm)
- Tablet: `640px - 1024px`
- Desktop: `> 1024px`

### Mobile Adaptations
- Features dropdown moves outside input
- Full-width feature toggles on mobile
- Touch-friendly button sizes (min 44x44px)
- Optimized spacing for small screens

---

## Integration Hooks

### Feature State Management

Features are stored in localStorage and synced with component state:

```jsx
// Load from localStorage
const [features, setFeatures] = useState({
  ocr: true,
  search: true,
  cdr: false,
  ipdr: false,
  bank: false
})

// Save to localStorage
localStorage.setItem('chatgpt-local-features', JSON.stringify(features))
```

### Event Callbacks

**onFeatureChange:**
```jsx
onFeatureChange={(features) => {
  // features: { ocr: boolean, search: boolean, cdr: boolean, ipdr: boolean, bank: boolean }
  console.log('Features updated:', features)
}}
```

**onUpload:**
```jsx
onUpload={(file, response) => {
  // file: File object
  // response: { document_id: string, filepath: string }
  console.log('File uploaded:', file.name, response)
}}
```

**onRunOCR:**
```jsx
onRunOCR={(documentId) => {
  // documentId: string
  console.log('Running OCR for:', documentId)
  // Call your OCR API here
}}
```

---

## Styling Guidelines

### Color Palette
- **Accent:** Cyan/Teal (#06b6d4)
- **Light Theme:** White, soft grays
- **Dark Theme:** Deep slate, charcoal

### Spacing
- Generous padding (16-24px)
- Consistent gaps (8px, 12px, 16px)

### Border Radius
- Cards: `rounded-2xl` (1rem)
- Buttons: `rounded-xl` (0.75rem)
- Inputs: `rounded-2xl` (1rem)

### Shadows
- Soft shadows (2-4px blur)
- Layered shadows for depth
- Dark mode: Increased opacity

### Animations
- Duration: 150-300ms
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
- GPU-friendly (transform, opacity)

---

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support

**Required Features:**
- CSS Grid
- Flexbox
- CSS Custom Properties
- `backdrop-filter` (for glassmorphism)

---

## Performance Considerations

- Lazy loading of dropdown content
- GPU-accelerated animations
- Minimal re-renders (React.memo where appropriate)
- Efficient event handlers (useCallback)

---

## Future Enhancements

- [ ] Add more feature types
- [ ] Batch OCR processing
- [ ] File preview modal
- [ ] Advanced search filters
- [ ] Feature presets/profiles
- [ ] Export/import feature configurations

