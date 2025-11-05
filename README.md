# Insta Reels Keepalive Userscript

A research-oriented browser userscript designed to study how Instagram handles
media playback, visibility APIs, programmatic pause events, and
IntersectionObserver-based autoplay restrictions.

⚠️ **This script is strictly for personal testing, debugging, and learning.**
It is **not** intended for automation, farming, scraping, or any
Terms-of-Service–violating behavior.

---

## ✅ Purpose

Instagram (and many modern sites) automatically pause videos when:

- You switch tabs  
- The document visibility changes  
- The video scrolls out of view  
- Internal JavaScript triggers a pause event  

This userscript explores:

- Intercepting `visibilitychange`
- Overriding `HTMLMediaElement.pause()` and `.play()`
- Detecting user intent vs. automated actions
- Tracking off-screen media via `IntersectionObserver`
- Understanding how sites enforce playback constraints

It is **not** for cheating engagement or bypassing restrictions —  
it is a **browser behavior analysis project**.

---

## ✅ Features

- Blocks registration of `visibilitychange` listeners  
- Forces `document.visibilityState` to stay `"visible"`  
- Honors **real user-pauses** (click, dblclick, space key)  
- Honors **offscreen pauses** (when video is scrolled out of view)  
- Ignores **forced pauses** triggered only when backgrounded  
- Resumes playback only under conditions that mimic active-tab behavior  
- Uses MutationObserver to monitor dynamically injected videos  
- Safe fallbacks to prevent breaking the site

---

## ✅ Installation

1. Install a userscript manager:
   - **Tampermonkey** (recommended)
   - **Violentmonkey**
   - **Greasemonkey** (limited support)

2. Click **“Add new script”**

3. Paste the contents of  
   `userscript/insta-reels-keepalive.user.js`

4. Save → Done.

---

## ✅ Technical Architecture

### 1. Event Listener Interception
Instagram adds visibility listeners to detect backgrounding.  
We neutralize them:

- Block `addEventListener('visibilitychange')`
- Block `removeEventListener('visibilitychange')`

### 2. Visibility API Override
We redefine:

- `document.visibilityState → "visible"`
- `document.hidden → false`

### 3. User-Intent Tracking
Pauses triggered by:

- click  
- dblclick  
- contextmenu  
- space key  

are marked as **legitimate pauses** via:

```js
video.dataset.userPaused = "1";
