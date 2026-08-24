# MotoTrack - Pure JSX Platform-Specific Architecture

MotoTrack is built with React Native and Expo using **platform-specific extensions** (`*.web.jsx` for Web and `*.jsx` for Mobile). There are no HTML files—the entire application is pure JSX with independent designs for each platform.

---

## 📁 Project Structure

```
Moto/
├── package.json               # Expo scripts ('start', 'web', 'android', 'ios')
├── app.json                   # Expo v54 configuration
├── App.js / index.js          # Root entries pointing to ./src/app/index
│
└── src/                       # 🚀 UNIFIED PURE-JSX CODEBASE
    ├── app/
    │   └── index.jsx          # App router & context provider shell
    │
    ├── pages/                 # 📄 PLATFORM-SPECIFIC PAGES
    │   ├── ShopPage.jsx       # 📱 Mobile Storefront
    │   ├── ShopPage.web.jsx   # 💻 Web Desktop Storefront
    │   ├── LoginPage.jsx      # 📱 Mobile Auth
    │   ├── LoginPage.web.jsx  # 💻 Web Dual-Panel Sliding Auth
    │   ├── SignUpPage.jsx     # 📱 Mobile Sign Up
    │   ├── SignUpPage.web.jsx # 💻 Web Dual-Panel Sign Up
    │   ├── GaragePage.jsx     # 📱 Mobile Garage
    │   ├── GaragePage.web.jsx # 💻 Web Desktop Pitstop Studio
    │   ├── OrderPage.jsx      # 📱 Mobile Orders
    │   ├── OrderPage.web.jsx  # 💻 Web Desktop Order Ledger
    │   ├── WishlistPage.jsx   # 📱 Mobile Wishlist
    │   ├── WishlistPage.web.jsx # 💻 Web Desktop Wishlist Grid
    │   ├── AdminDashboard.jsx # 📱 Mobile Admin
    │   ├── AdminDashboard.web.jsx # 💻 Web Desktop Backoffice Sidebar
    │   └── index.js           # Re-exports: Metro resolves *.web.jsx or *.jsx automatically
    │
    ├── components/            # Modals, icons, common & shop components
    ├── context/               # AuthContext, CartContext, WishlistContext
    ├── services/              # Supabase client, storage adapter, service APIs
    ├── data/                  # motorParts.js catalog
    └── styles/                # StyleSheets
```

---

## 🚀 Running the Project

### 💻 Web (Desktop Browser)
```bash
npm run web
# Runs: expo start --web (automatically loads *.web.jsx files)
```

### 📱 Mobile (Android / iOS / Expo Go)
```bash
npm start
# or: npm run android
# or: npm run ios
```
