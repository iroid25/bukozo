# Electron Desktop Authentication Implementation Prompt

Use this prompt with an AI coding assistant (like Antigravity or similar) to implement the authentication bridge for the Electron version of the Bosco Sacco application.

---

## 🤖 AI Instruction Prompt

**Role**: You are a Senior Security & Desktop Engineer specializing in Electron and Next.js integrations.

**Context**: 
We have a robust Sacco Management System built with **Next.js (App Router)**, **NextAuth.js**, **Prisma**, and **PostgreSQL**. We are now wrapping this application in an **Electron** shell for desktop users (Tellers/Managers). We need to implement a secure, seamless authentication flow that allows the desktop app to "remember" the user safely.

**Objective**:
Implement a "Station-Based" or "Persistent Token" authentication flow for the Electron app.

### Tasks to Perform:

1. **Authentication Bridge Strategy**:
   - Recommend and implement the best approach for Electron (e.g., intercepting NextAuth sessions or implementing a custom `API_KEY` / `DeviceToken` system).
   - If using API Keys, create a new table `DesktopStation` in `schema.prisma` to track authorized desktop installations.

2. **Main Process Configuration (`main.js` / `main.ts`)**:
   - Set up `safeStorage` (Electron built-in) to encrypt and store the authentication token/cookie locally on the user's machine.
   - Implement an IPC bridge to handle "Login" and "Logout" events between the Web view and the Desktop shell.

3. **API Integration**:
   - Update `middleware.ts` or create a new internal API route `/api/v1/auth/desktop-verify` that validates the desktop token/API key.
   - Ensure these requests are still subject to existing role-based access control (RBAC).

4. **Security Hardening**:
   - Disable `nodeIntegration` in the renderer for untrusted content.
   - Implement `ContextBridge` for all IPC communication.
   - Set up a Content Security Policy (CSP) that allows only our Next.js backend.

### Technical Guidance for the AI:

- **NextAuth Integration**: If we want to reuse the web session, help me implement `session.setCookies` in the Electron main process after a successful web login.
- **API Key Route**: If we go the API key route, generate a `UUID` v4 for the `stationId` and a hashed `apiKey`.
- **User Experience**: The user should only log in once. Upon reopening the app, it should silently verify the token and go straight to the dashboard.

---

## 🛠️ Implementation Guidance & Best Practices

### 1. Why use `safeStorage`?
Electron's `safeStorage` API allows you to encrypt strings using the native OS password manager (Keychain on macOS, DPAPI on Windows, Secret Service on Linux). **Never store raw JWTs or passwords in localStorage!**

### 2. Handling the "Login" Callback
When the user logs in via the Next.js web form inside Electron:
1. Intercept the `set-cookie` header from the response.
2. Store the session token in the encrypted local store.
3. On app boot, re-inject the cookie into the Electron session before loading the URL.

### 3. API Key Generation (Optional but Recommended)
For deep integration (like printing or hardware access), an API key per station is better:
- **Table**: `DesktopStation` (id, name, branchId, secretHash, isActive).
- **Header**: `x-sacco-api-key`.

### 4. Code Snippet Reference (IPC Bridge)
```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAuth', {
  saveToken: (token) => ipcRenderer.invoke('save-token', token),
  getToken: () => ipcRenderer.invoke('get-token'),
  clearAuth: () => ipcRenderer.send('clear-auth')
});
```

---
**Next Steps**: 
Please review this prompt. Once approved, I can help you generate the specific `schema.prisma` changes or the `main.ts` logic for Electron.
