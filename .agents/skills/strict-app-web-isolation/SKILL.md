---
name: strict-app-web-isolation
description: >-
  Enforces strict separation between the mobile application (iOS/Android) codebase
  and the website/web application codebase in MotoTrack. Use on every task to ensure
  only one project (APP MODE or WEB MODE) is modified at a time, protecting the
  inactive project from unauthorized changes, refactoring, or collateral modifications.
---

# Skill: Strict App and Web Project Isolation

## Purpose
Enforce strict separation between the application's codebase and the website's codebase. The AI must work exclusively on the project explicitly selected by the user and must never modify the other project.

---

## 1. Core Rule: One Active Project at a Time

There are two project types in MotoTrack:

- **APP MODE:** Work exclusively on the mobile application (iOS / Android / Native mobile screens & components).
- **WEB MODE:** Work exclusively on the website or web application (Desktop Web screens, web components, web admin/rider interfaces).

Only one mode may be active at a time.

Never modify files belonging to the inactive project, even if changing them appears convenient or necessary for implementation.

---

## 2. When Working on the App (APP MODE)

When the user requests an application feature, bug fix, UI improvement, refactoring, or other app-related task:

- **Target Directories:**
  - `src/platforms/ios/**`
  - `src/platforms/android/**`
  - `src/screens/mobile/**`
  - `src/components/mobile/**`
- Modify only files belonging to the target app.
- Do not modify website source code (`src/screens/web/**`, `src/components/web/**`), web assets, web configurations, web routes (`src/pages/index.web.js`), or unrelated frontend components.
- Do not modify shared files that may affect the website without explicit authorization.
- Do not create website code to solve an app-only problem.
- Keep all changes scoped to the application.

**Protection rule:** The website's files must remain unchanged during APP MODE.

---

## 3. When Working on the Website (WEB MODE)

When the user requests a website feature, bug fix, UI improvement, refactoring, or other website-related task:

- **Target Directories:**
  - `src/screens/web/**`
  - `src/components/web/**`
  - `src/pages/index.web.js`
- Modify only files belonging to the target website.
- Do not modify mobile application code (`src/platforms/ios/**`, `src/platforms/android/**`, `src/screens/mobile/**`), mobile-specific components (`src/components/mobile/**`), app configurations, or unrelated application files.
- Do not change shared files that may affect the application without explicit authorization.
- Do not modify application logic to solve a website-only problem.
- Keep all changes scoped to the website.

**Protection rule:** The application's files must remain unchanged during WEB MODE.

---

## 4. Identify the Correct Project Before Editing

Before every task:

1. Determine whether the user is working on the app or the website.
2. Identify the correct project root directory / path prefix.
3. Inspect the directory structure and relevant files.
4. Establish which files are in scope and which are protected:
   - **App-only scope:** `src/platforms/ios/`, `src/platforms/android/`, `src/screens/mobile/`, `src/components/mobile/`
   - **Web-only scope:** `src/screens/web/`, `src/components/web/`, `src/pages/index.web.js`
   - **Shared modules (Require caution):** `src/screens/shared/`, `src/components/common/`, `src/components/admin/`, `src/components/shop/`, `src/services/`, `src/context/`, `src/lib/`, `src/platform/selectScreen.js`, `App.js`
5. Make changes only after the project scope is clear.

If the request is ambiguous, stop and ask the user which project they want to modify.

---

## 5. Handle Shared Code Carefully

MotoTrack contains shared API clients, Supabase services, authentication modules, database configurations, state providers, and shared screen wrappers.

- Never assume shared code is safe to edit.
- Determine which projects depend on the file before changing it.
- Prefer a project-specific solution that does not affect the inactive project.
- If a shared file must change, explain the impact and obtain the user's permission first.
- Never silently modify both projects to make one feature work.

---

## 6. Prevent Unintended Changes

- Never run broad automated refactoring across both projects.
- Never delete or rename files in the inactive project.
- Never update dependencies or global configurations if doing so could unintentionally affect the inactive project.
- Do not run formatters or code-generation tools against the entire repository when they may change protected files.
- Do not overwrite existing code outside the authorized scope.
- Do not commit, push, deploy, or publish changes unless explicitly authorized.

---

## 7. Verify Project Isolation

After completing each task:

1. Review the files changed.
2. Confirm every modified file belongs to the active project.
3. Check that no protected files were modified.
4. Run appropriate tests, linters, or builds for the active project only.
5. Report any unexpected changes immediately.

When practical, use Git status and a before-and-after diff to verify the scope.

If a protected file changes unexpectedly, stop and report it. Do not automatically revert it if that could overwrite legitimate user changes.

---

## 8. Final Response Format

After each task, report:

- **Active mode:** APP MODE or WEB MODE.
- **Project modified:** The selected project's name or directory.
- **Files changed:** List of modified files.
- **Isolation check:** Whether any inactive-project files were changed.
- **Validation:** Tests or builds performed and their results.

---

## Highest-Priority Directive

ONE TASK. ONE ACTIVE PROJECT. ZERO UNAUTHORIZED CROSS-PROJECT CHANGES.

When working on the app, protect the website.

When working on the website, protect the app.

Never switch project scope or modify the inactive project unless the user explicitly authorizes that change.

If project boundaries cannot be verified, stop and ask before editing.
