# NFC Kiosk Mode — Complete Implementation Guide

This guide documents exactly how the **puku-kiosk** (Kimai Kiosk) project implements a rock-solid NFC-based kiosk mode for time tracking. It is written so you can reproduce the same approach in your own time-tracking app, with special focus on the part that trips most people up: **triggering the NFC interface on a mobile device and getting implicit permission to use it.**

---

## Table of Contents

1. [How It Works — The Big Picture](#1-how-it-works--the-big-picture)

2. [Prerequisites & Device Requirements](#2-prerequisites--device-requirements)

3. [The Implicit NFC Permission Model (The Key Part)](#3-the-implicit-nfc-permission-model-the-key-part)

4. [Step-by-Step Implementation](#4-step-by-step-implementation)

   - 4.1 [Web NFC Type Definitions](#41-web-nfc-type-definitions)

   - 4.2 [The NFC Scan Component](#42-the-nfc-scan-component)

   - 4.3 [Tag → User Lookup](#43-tag--user-lookup)

   - 4.4 [Login → Time Tracker](#44-login--time-tracker)

   - 4.5 [The Backend API Client](#45-the-backend-api-client)

5. [Kiosk Mode (Fullscreen PWA)](#5-kiosk-mode-fullscreen-pwa)

6. [Writing the NFC Tags](#6-writing-the-nfc-tags)

7. [Getting It Working on Your Phone](#7-getting-it-working-on-your-phone)

8. [Common Pitfalls & Why "It Doesn't Work"](#8-common-pitfalls--why-it-doesnt-work)

9. [File Map](#9-file-map)

---

## 1. How It Works — The Big Picture

```text

┌──────────────┐   tap tag    ┌─────────────────┐  lookup  ┌──────────┐  login  ┌──────────────┐

│  NFC Tag     │ ──────────►  │  Browser Web NFC │ ───────► │ users.ts │ ──────► │ TimeTracker  │

│ (text: "86130978")│         │  NDEFReader     │          │ rfidTag  │         │ (start/stop)  │

└──────────────┘              └─────────────────┘          └──────────┘         └──────┬───────┘

                                                                                      │

                                                                                      ▼

                                                                              ┌──────────────┐

                                                                              │  Kimai API   │

                                                                              │ /timesheets  │

                                                                              └──────────────┘

```

- The **NFC tag stores a text payload** (e.g. `"86130978"`), NOT the tag UID.

- The browser's **Web NFC API** (`NDEFReader`) reads the text.

- The app matches the text against a list of users (`rfidTag` field).

- On match, the user is "logged in" and sees a start/stop time-tracker screen.

- NFC is used **for login only**. Clock-in/out is done with on-screen buttons after login.

---

## 2. Prerequisites & Device Requirements

| Requirement | Why | Notes |

| --- | --- | --- |

| **Chrome on Android** | Web NFC is only available in Chromium browsers. | Firefox and Safari do **not** support Web NFC. |

| **HTTPS (secure context)** | Web NFC only works in a secure context. | `localhost` counts as secure for development. For deployment you need TLS (e.g. a reverse proxy with Let's Encrypt, or Cloudflare Tunnel). |

| **Physical NFC hardware** | The phone's NFC radio must be present and on. | Most Android phones have this. |

| **NFC tag with NDEF text record** | The app reads the **text** content, not the UID. | You must pre-write the tag with the matching code. |

| **User gesture (button click)** | `reader.scan()` must be called from a user-activated event. | This is the single most important permission rule — see section 3. |

| **PWA manifest + service worker** | Required for installability and fullscreen kiosk mode. | Not strictly required for NFC, but required for the kiosk experience. |

> ⚠️ **iOS (iPhone/iPad) does NOT support Web NFC at all.** There is no `NDEFReader` in Safari or in iOS PWAs. If you need iOS, you must use a native app or a third-party browser that wraps a native NFC layer. This project targets Android kiosks.

---

## 3. The Implicit NFC Permission Model (The Key Part)

This is the part that most developers get stuck on. Here is the exact truth about how this project gets permission to use NFC — and it is simpler than you think.

### What the project does NOT do

- ❌ No `Permissions-Policy: nfc=(self)` header (the `next.config.ts` is completely empty).

- ❌ No `navigator.permissions.query({name:'nfc'})` call.

- ❌ No iframe `allow="nfc"` attribute (the app is a top-level document).

- ❌ No special manifest field (the Web App Manifest spec has **no** NFC permission field).

- ❌ No native Android manifest / `AndroidManifest.xml` permissions (it's a PWA, not a native app).

### What the project DOES do (the only two rules that matter)

**Rule 1 — Serve over HTTPS (or localhost).** Web NFC is gated behind the **secure context** requirement. If your page is served over plain HTTP (and not localhost), `window.NDEFReader` will simply not exist. HTTPS is the first "implicit allow."

**Rule 2 — Call **`reader.scan()`** from a user gesture.** The `scan()` call must happen inside (or in a promise chain started by) a user-initiated event handler — typically an `onClick`. This is the second "implicit allow." Chrome will reject `scan()` calls that happen on page load, in `setTimeout`, or in any non-user-triggered code path.

That's it. There is **no explicit permission request**, no permission prompt to handle in code. Chrome shows its own native NFC UI ("Tap a tag to scan") the first time the radio is activated. The user just taps a tag. You do not write _any_ permission code.

### The exact code that satisfies both rules

From `src/components/RfidLogin.tsx`:

```tsx
// Rule 2 is satisfied: this function is the onClick handler of the scan button.

const handleNfcScan = async () => {
  // Feature-detect first (NDEFReader only exists in secure contexts on Chromium)

  if (!("NDEFReader" in window)) {
    setError("Web NFC wird von diesem Browser nicht unterstützt.");

    return;
  }

  try {
    const reader = new NDEFReader();

    setIsScanning(true);

    setError("");

    // This scan() call is inside the click handler → user gesture is present.

    await reader.scan();

    reader.onreading = (event) => {
      const { message } = event as NDEFReadingEvent;

      for (const record of message.records) {
        if (record.recordType === "text") {
          const textDecoder = new TextDecoder();

          const rfidCode = textDecoder.decode(record.data);

          handleRfidLogin(rfidCode);

          setIsScanning(false);

          return;
        }
      }
    };

    reader.onreadingerror = (event) => {
      console.error("NFC Error:", event);

      setError("Fehler beim Scannen des NFC-Tags.");

      setIsScanning(false);
    };
  } catch (error) {
    setError("NFC-Scan konnte nicht gestartet werden.");

    setIsScanning(false);
  }
};
```

```tsx
// The button — the user gesture source

<button onClick={handleNfcScan} disabled={isScanning}>
  {isScanning ? "Scanne jetzt..." : "RFID-Chip scannen (NFC)"}
</button>
```

### Why this "just works" on the phone

1. You open the app over **HTTPS** on Chrome for Android → `NDEFReader` exists.

2. You tap the **"RFID-Chip scannen (NFC)"** button → Chrome sees a user gesture.

3. `reader.scan()` runs → Chrome activates the NFC radio and shows the native "Tap a tag" prompt.

4. You tap an NFC tag → `reader.onreading` fires with the text payload.

5. The text is matched to a user → logged in.

The "implicit allow" is literally: **HTTPS + a button click.** Nothing else.

---

## 4. Step-by-Step Implementation

### 4.1 Web NFC Type Definitions

Create `src/types/web-nfc.d.ts`. This gives TypeScript knowledge of the Web NFC API so `'NDEFReader' in window` and `new NDEFReader()` type-check. You do **not** need an npm package for this — the file augments the global `Window` interface directly.

```ts
// src/types/web-nfc.d.ts

interface Window {
  NDEFReader: NDEFReader;
}

type NDEFMessageSource = string | BufferSource | NDEFMessageInit;

interface NDEFReader extends EventTarget {
  scan: (options?: NDEFScanOptions) => Promise<void>;

  write: (message: NDEFMessageSource, options?: NDEFWriteOptions) => Promise<void>;

  onreading: (this: this, event: NDEFReadingEvent) => any;

  onreadingerror: (this: this, event: Event) => any;
}

declare var NDEFReader: {
  prototype: NDEFReader;

  new (): NDEFReader;
};

interface NDEFReadingEvent extends Event {
  serialNumber: string;

  message: NDEFMessage;
}

interface NDEFMessage {
  records: ReadonlyArray<NDEFRecord>;
}

interface NDEFRecord {
  readonly recordType: string;

  readonly mediaType?: string;

  readonly id?: string;

  readonly data?: DataView;

  readonly encoding?: string;

  readonly lang?: string;

  toRecords?: () => NDEFRecord[];
}

interface NDEFScanOptions {
  signal: AbortSignal;
}

interface NDEFWriteOptions {
  overwrite?: boolean;

  signal?: AbortSignal;
}
```

> Your `tsconfig.json` must include `**/*.ts` (the default Next.js config does this) so this ambient file is picked up automatically. No import is needed — the triple-slash reference `/// <reference path="../types/web-nfc.d.ts" />` at the top of `RfidLogin.tsx` makes it explicit.

### 4.2 The NFC Scan Component

This is the complete, minimal NFC login component. Put it at `src/components/RfidLogin.tsx`:

```tsx
/// <reference path="../types/web-nfc.d.ts" />

"use client";

import { useState } from "react";

import { User } from "@/types";

import { getUserByRfidTag } from "@/lib/users";

interface RfidLoginProps {
  onUserLogin: (user: User) => void;
}

export default function RfidLogin({ onUserLogin }: RfidLoginProps) {
  const [error, setError] = useState("");

  const [isScanning, setIsScanning] = useState(false);

  const handleRfidLogin = (rfidTag: string) => {
    setError("");

    const user = getUserByRfidTag(rfidTag);

    if (user) {
      onUserLogin(user);
    } else {
      setError("RFID-Tag nicht erkannt. Bitte wenden Sie sich an den Administrator.");

      setTimeout(() => setError(""), 3000);
    }
  };

  const handleNfcScan = async () => {
    if (!("NDEFReader" in window)) {
      setError("Web NFC wird von diesem Browser nicht unterstützt.");

      return;
    }

    try {
      const reader = new NDEFReader();

      setIsScanning(true);

      setError("");

      await reader.scan();

      reader.onreading = (event) => {
        const { message } = event as NDEFReadingEvent;

        for (const record of message.records) {
          if (record.recordType === "text") {
            const textDecoder = new TextDecoder();

            const rfidCode = textDecoder.decode(record.data);

            handleRfidLogin(rfidCode);

            setIsScanning(false);

            return;
          }
        }
      };

      reader.onreadingerror = (event) => {
        console.error("NFC Error:", event);

        setError("Fehler beim Scannen des NFC-Tags.");

        setIsScanning(false);
      };
    } catch (error) {
      setError("NFC-Scan konnte nicht gestartet werden.");

      setIsScanning(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: 400, padding: 32 }}>
        <h1>Time Tracking</h1>

        <p>Scan your NFC tag to log in</p>

        <button
          onClick={handleNfcScan}
          disabled={isScanning}
          style={{ width: "100%", padding: "12px 16px" }}
        >
          {isScanning ? "Scanning..." : "Scan NFC Tag"}
        </button>

        {error && <div style={{ color: "red", marginTop: 16 }}>{error}</div>}
      </div>
    </div>
  );
}
```

Key points:

- `onClick={handleNfcScan}` — the click is the user gesture. Without this, `scan()` silently fails.

- `await reader.scan()` — starts the NFC radio. Resolves once scanning is active (not when a tag is read).

- `reader.onreading` — fires when a tag with an NDEF message is tapped. We only care about `recordType === 'text'`.

- `new TextDecoder().decode(record.data)` — converts the NDEF text payload bytes into a string.

- The code does **not** use `event.serialNumber` (the tag UID). It uses the _written text_. This means you must write data to your tags — see section 6.

### 4.3 Tag → User Lookup

The scanned text is matched against a user list. The project stores users in `src/lib/users.ts`:

```ts
// src/types/index.ts

export interface User {
  id: string;

  name: string;

  rfidTag: string; // the text that must be written to the NFC tag

  kimaiApiKey: string;

  kimaiApiUrl: string;

  activityId: number;

  projectId: number;
}
```

```ts
// src/lib/users.ts

import { User } from "@/types";

const USERS_STORAGE_KEY = "kimai-kiosk-users";

export const defaultUsers: User[] = [
  {
    id: "1",

    name: "Anja",

    rfidTag: "86130978", // <-- this string must be on the tag

    kimaiApiKey: "b0e797a7e68cb8217dce20494",

    kimaiApiUrl: "https://time.puku.info/api",

    activityId: 1,

    projectId: 1,
  },

  // ... more users
];

export function getUsers(): User[] {
  if (typeof window === "undefined") return defaultUsers;

  const stored = localStorage.getItem(USERS_STORAGE_KEY);

  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return defaultUsers;
    }
  }

  return defaultUsers;
}

export function getUserByRfidTag(rfidTag: string): User | null {
  const users = getUsers();

  return users.find((user) => user.rfidTag === rfidTag) || null;
}
```

The match is a **simple string equality**: `user.rfidTag === rfidCode`. If your tag's text payload is `"86130978"` and a user has `rfidTag: '86130978'`, they log in. Otherwise the error "RFID-Tag nicht erkannt" is shown for 3 seconds.

### 4.4 Login → Time Tracker

The main page holds the logged-in user in state and swaps between the login screen and the time tracker:

```tsx
// src/app/page.tsx

"use client";

import { useState } from "react";

import { User } from "@/types";

import RfidLogin from "@/components/RfidLogin";

import TimeTracker from "@/components/TimeTracker";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleUserLogin = (user: User) => setCurrentUser(user);

  const handleLogout = () => setCurrentUser(null);

  return (
    <div>
      {currentUser ? (
        <TimeTracker user={currentUser} onLogout={handleLogout} />
      ) : (
        <RfidLogin onUserLogin={handleUserLogin} />
      )}
    </div>
  );
}
```

Once `onUserLogin(user)` is called (from inside the NFC `onreading` handler), `currentUser` is set and `TimeTracker` renders. The `TimeTracker` component creates a per-user API client and lets the user start/stop work and pause via on-screen buttons.

### 4.5 The Backend API Client

The `KimaiApi` class in `src/lib/kimai-api.ts` makes authenticated REST calls to the Kimai backend using the per-user API key:

```ts
export class KimaiApi {
  private apiUrl: string;

  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;

    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      Accept: "application/json",

      Authorization: `Bearer ${this.apiKey}`,

      "Content-Type": "application/json",
    };
  }

  async startTimer(user: User, description = "Started working"): Promise<KimaiApiResponse> {
    const body = {
      begin: this.getBerlinTimestamp(),

      activity: user.activityId,

      project: user.projectId,

      description,
    };

    const response = await fetch(`${this.apiUrl}/timesheets`, {
      method: "POST",

      headers: this.headers,

      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Failed to start timer: ${response.statusText}`);

    return await response.json();
  }

  async stopAllTimers(): Promise<void> {
    const response = await fetch(`${this.apiUrl}/timesheets?running=1`, { headers: this.headers });

    const runningTimers: KimaiApiResponse[] = await response.json();

    const stopPromises = runningTimers.map((timer) =>
      fetch(`${this.apiUrl}/timesheets/${timer.id}/stop`, {
        method: "PATCH",
        headers: this.headers,
      })
    );

    await Promise.all(stopPromises);
  }

  async getActiveTimesheets(): Promise<KimaiApiResponse[]> {
    const response = await fetch(`${this.apiUrl}/timesheets/active`, { headers: this.headers });

    return await response.json();
  }
}
```

> For your own app, replace this class with whatever your time-tracking backend requires. The NFC flow is independent of the backend.

---

## 5. Kiosk Mode (Fullscreen PWA)

Kiosk mode is achieved through a **PWA manifest** declaring `"display": "fullscreen"`, plus a **service worker** for installability, plus **Apple/iOS meta tags** as a fallback, plus a **locked viewport** and **auto-logout**.

### 5.1 PWA Manifest

`public/manifest.json`:

```json
{
  "name": "Kimai Kiosk",

  "short_name": "Kimai Kiosk",

  "description": "RFID-based time tracking kiosk for Kimai",

  "start_url": "/",

  "display": "fullscreen",

  "orientation": "portrait",

  "theme_color": "#2563eb",

  "background_color": "#f3f4f6",

  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },

    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],

  "categories": ["productivity", "business"],

  "prefer_related_applications": false
}
```

- `"display": "fullscreen"` — when installed to the home screen on Android, the app launches with no browser chrome and no status bar. This is the most aggressive display mode.

- `"orientation": "portrait"` — locks the device to portrait.

- You must provide **real 192×192 and 512×512 PNG icons** for Chrome to consider the app installable.

### 5.2 Service Worker

`public/sw.js` (a minimal cache-first service worker):

```js
const CACHE_NAME = "kimai-kiosk-v1";

const urlsToCache = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
```

### 5.3 Root Layout — Manifest Link, Meta Tags, SW Registration

`src/app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: "Kimai Kiosk - Time Tracker",

  description: "RFID-based time tracking kiosk for Kimai",

  manifest: "/manifest.json",

  themeColor: "#2563eb",

  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",

  appleWebApp: {
    capable: true,

    statusBarStyle: "default",

    title: "Kimai Kiosk",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />

        <meta name="theme-color" content="#2563eb" />

        <meta name="apple-mobile-web-app-capable" content="yes" />

        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <meta name="apple-mobile-web-app-title" content="Kimai Kiosk" />

        <script
          dangerouslySetInnerHTML={{
            __html: `

            if ('serviceWorker' in navigator) {

              window.addEventListener('load', function() {

                navigator.serviceWorker.register('/sw.js')

                  .then(function(registration) { console.log('SW registered: ', registration); })

                  .catch(function(registrationError) { console.log('SW registration failed: ', registrationError); });

              });

            }

          `,
          }}
        />
      </head>

      <body>{children}</body>
    </html>
  );
}
```

Key kiosk hardening:

- `viewport: maximum-scale=1, user-scalable=no` — disables pinch-to-zoom.

- `apple-mobile-web-app-capable=yes` — iOS Safari standalone mode when added to Home Screen.

- **Service worker registration** — makes the app installable (PWA).

### 5.4 Auto-Logout (Kiosk Hardening)

The `TimeTracker` component logs the user out after 30 seconds of inactivity, returning to the NFC login screen so the next person can scan:

```tsx
useEffect(() => {
  const events = ["mousedown", "keydown", "touchstart"];

  events.forEach((event) => document.addEventListener(event, handleActivity));

  const checkInactivity = setInterval(() => {
    const inactive = Date.now() - lastActivity;

    if (inactive > 25000 && inactive <= 30000) {
      setShowWarning(true); // 5-second warning
    } else if (inactive > 30000) {
      onLogout(); // force logout
    }
  }, 1000);

  return () => {
    events.forEach((event) => document.removeEventListener(event, handleActivity));

    clearInterval(checkInactivity);
  };
}, [lastActivity, onLogout]);
```

---

## 6. Writing the NFC Tags

This is critical and often missed: **the app reads the text content of the NDEF record, not the tag's serial number/UID.** You must write the user's `rfidTag` value onto the tag as a plain text NDEF record.

### How to write tags (using another Android phone)

1. Install an NFC writing app such as **NFC Tools** (by Wakdev) from the Play Store.

2. Open it and tap **Write**.

3. Add a record of type **Text**.

4. Enter the exact `rfidTag` string, e.g. `86130978` — no spaces, no newline, no quotes.

5. Tap **Write** and place a blank NFC tag on the back of the phone.

6. Verify by reading the tag back in the app — it should show the text `86130978`.

### How to write tags (using a Web NFC page)

You can write a tiny HTML page that uses the same Web NFC API to write tags. Open it in Chrome on Android over HTTPS/localhost:

```html
<!DOCTYPE html>

<html>
  <body>
    <input id="text" placeholder="e.g. 86130978" />

    <button onclick="writeTag()">Write Tag</button>

    <script>
      async function writeTag() {
        if (!("NDEFReader" in window)) {
          alert("No Web NFC");
          return;
        }

        try {
          const writer = new NDEFReader();

          await writer.write({
            records: [{ recordType: "text", data: document.getElementById("text").value }],
          });

          alert("Tag written!");
        } catch (e) {
          alert("Write failed: " + e);
        }
      }
    </script>
  </body>
</html>
```

> The text on the tag must match a `rfidTag` in your user list **exactly** (case-sensitive, no trailing whitespace).

---

## 7. Getting It Working on Your Phone

Follow these exact steps to test on a physical Android device:

### Development (localhost — secure context)

1. Start your dev server: `npm run dev` → `http://localhost:3000`.

2. On your Android phone, open Chrome and navigate to `http://<your-computer-ip>:3000` — **but this will NOT be a secure context unless you use localhost.** Web NFC on a non-localhost LAN IP over HTTP will not work.

3. To test on the phone, either:

   - Use `chrome://inspect` → Port forwarding: forward `localhost:3000` on the phone to your dev machine. The phone's Chrome will then open `http://localhost:3000`, which **is** a secure context.

   - **Or** deploy behind HTTPS (see below).

### Production (HTTPS — recommended)

1. Deploy the app behind a TLS-terminating reverse proxy (nginx, Caddy, Cloudflare Tunnel, ngrok, etc.).

2. Ensure the site is reachable over `https://your-domain`.

3. On your Android phone, open Chrome and go to `https://your-domain`.

4. Tap the browser menu → **"Add to Home screen"** (or **"Install app"**). This installs the PWA.

5. Launch the app from the home screen icon. It opens in **fullscreen kiosk mode** (no browser chrome).

6. Tap the **"RFID-Chip scannen (NFC)"** button. Chrome activates the NFC radio. The first time, the OS may show an NFC permission prompt — allow it.

7. Tap your pre-written NFC tag on the back of the phone. The `onreading` handler fires, the user is looked up, and you are logged in.

### First-scan permission prompt

The very first time `reader.scan()` runs, Chrome on Android may show a system-level prompt asking permission to use NFC. This is handled by the OS, not by your code. Once the user taps "Allow," subsequent scans do not prompt again. There is nothing to code for this — it is the browser/OS doing the "implicit allow" after the user grants it once.

---

## 8. Common Pitfalls & Why "It Doesn't Work"

| Symptom | Cause | Fix |

| --- | --- | --- |

| `'NDEFReader' in window` is `false` | Page is not a secure context (served over HTTP, not localhost). | Serve over HTTPS or use `localhost`. |

| `'NDEFReader' in window` is `false` | Browser doesn't support Web NFC (Firefox, Safari, iOS). | Use Chrome on Android. iOS will never work with this approach. |

| `reader.scan()` throws / silently does nothing | `scan()` was not called from a user gesture (e.g. called in `useEffect` or `setTimeout`). | Call it from an `onClick` handler. |

| Scan starts but `onreading` never fires | NFC tag has no NDEF message, or is empty/proprietary. | Write a text NDEF record to the tag (section 6). |

| `onreading` fires but login fails ("nicht erkannt") | The text on the tag does not match any `rfidTag` in `users.ts`. | Check for trailing whitespace/newlines. The match is exact. |

| Works in desktop Chrome, not on phone | Desktop Chrome does not have NFC hardware. `NDEFReader` exists but scan hangs. | Test on a real Android phone with NFC. |

| App works but no fullscreen | Manifest not linked, or app not installed as PWA. | Add `<link rel="manifest">`, a service worker, real icons, then "Add to Home screen." |

| `maximum-scale=1` not honored | Modern Chrome ignores `user-scalable=no` for accessibility. | This is a known browser change; not a code bug. |

| Permission denied after reinstall | OS revoked NFC permission. | Go to Android Settings → Apps → Chrome → Permissions → NFC → Allow. |

| Multiple users log in too fast / scan reads twice | `onreading` can fire more than once if the tag stays on the reader. | The project calls `setIsScanning(false)` and returns after the first text record; consider adding an `AbortController` to stop scanning after one read. |

### Optional: clean scan cancellation (not in the original project)

The original project does not pass an `AbortSignal` to `scan()`, so scanning cannot be cleanly cancelled. If you want to stop scanning after one read or on unmount, add:

```tsx
const abortControllerRef = useRef<AbortController | null>(null);

const handleNfcScan = async () => {
  if (!("NDEFReader" in window)) return;

  const reader = new NDEFReader();

  const controller = new AbortController();

  abortControllerRef.current = controller;

  setIsScanning(true);

  try {
    await reader.scan({ signal: controller.signal });

    reader.onreading = (event) => {
      controller.abort(); // stop scanning after first read

      setIsScanning(false);

      // ... handle the text record
    };
  } catch (e) {
    setIsScanning(false);
  }
};

useEffect(() => () => abortControllerRef.current?.abort(), []); // cleanup on unmount
```

---

## 9. File Map

| File | Role |

| --- | --- |

| `src/components/RfidLogin.tsx` | **NFC entry point.** `handleNfcScan` (lines 73-113) contains the entire Web NFC flow. The scan button (line 181-198) provides the user gesture. |

| `src/types/web-nfc.d.ts` | Web NFC TypeScript type definitions. Augments `Window` with `NDEFReader`. |

| `src/lib/users.ts` | User list with `rfidTag` strings. `getUserByRfidTag` (line 128-131) does the tag→user lookup. |

| `src/lib/kimai-api.ts` | REST client for the Kimai backend. `startTimer`, `stopAllTimers`, `getActiveTimesheets`. |

| `src/types/index.ts` | `User`, `TimeEntry`, `KimaiApiResponse` interfaces. |

| `src/app/page.tsx` | Holds `currentUser` state; swaps between `RfidLogin` and `TimeTracker`. |

| `src/app/layout.tsx` | Manifest link, theme color, locked viewport, Apple meta tags, service worker registration. |

| `src/components/TimeTracker.tsx` | Post-login screen: start/stop work + pause, auto-logout after 30s inactivity. |

| `public/manifest.json` | PWA manifest with `"display": "fullscreen"`. |

| `public/sw.js` | Minimal cache-first service worker (for installability). |

| `public/icon-192.png`, `public/icon-512.png` | PWA icons (provide real ones for installability). |

| `next.config.ts` | **Empty.** No `Permissions-Policy` header is needed for a top-level document. |

---

### Summary in one sentence

The entire NFC kiosk "permission" trick is: **serve the page over HTTPS, and call **`new NDEFReader().scan()`** from a button click — the browser handles the rest.**
