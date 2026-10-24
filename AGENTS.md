# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Strict App and Web Project Isolation

Enforce strict separation between APP MODE (`src/platforms/ios/`, `src/platforms/android/`, `src/screens/mobile/`, `src/components/mobile/`) and WEB MODE (`src/screens/web/`, `src/components/web/`, `src/pages/index.web.js`).
- Only ONE project mode active at a time.
- When working on the app, protect the website.
- When working on the website, protect the app.
- Never modify inactive project files or shared files without explicit user authorization.
- Always conclude with the Section 8 isolation reporting format.
- Refer to [.agents/skills/strict-app-web-isolation/SKILL.md](file:///c:/Users/Jherico%20S.%20Maurin/Desktop/Moto/.agents/skills/strict-app-web-isolation/SKILL.md) for full guidelines.

