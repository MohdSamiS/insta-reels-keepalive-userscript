// ==UserScript==
// @name         Instagram Keep Reels Playing (Robust, Fixed v1.5)
// @namespace    https://github.com/MohdSamiS
// @version      1.5
// @description  Prevent Instagram Reels from pausing on tab switch, allow user/manual pauses and offscreen pauses.
// @description  Research script for testing visibility APIs. Not for automation or ToS-violating use.
// @author       Mohammed Sami
// @match        https://www.instagram.com/*
// @license MIT
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  const origAddEventListener = EventTarget.prototype.addEventListener;
  const origRemoveEventListener = EventTarget.prototype.removeEventListener;
  const origDefineProperty = Object.defineProperty;
  const origPause = HTMLMediaElement.prototype.pause;
  const origPlay = HTMLMediaElement.prototype.play;

  // ===== 1) Block visibilitychange listeners (prevent site from registering handlers) =====
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'visibilitychange') return;
    return origAddEventListener.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    if (type === 'visibilitychange') return;
    return origRemoveEventListener.call(this, type, listener, options);
  };

  // ===== 2) Always report page visible (best-effort) =====
  try {
    origDefineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      get: () => 'visible'
    });
    origDefineProperty(Document.prototype, 'hidden', {
      configurable: true,
      get: () => false
    });
  } catch (e) {
    // If browser prevents redefining, we silently continue (we still block listeners above).
  }

  const stopVis = ev => { ev.stopImmediatePropagation(); ev.preventDefault?.(); };
  window.addEventListener('visibilitychange', stopVis, true);
  document.addEventListener('visibilitychange', stopVis, true);

  // ===== 3) Detect user intent (mark a video as user-paused) =====
  const markUserAction = v => { if (v) v.dataset.userPaused = '1'; };

  // Click/dblclick/contextmenu on the video element => user intent to pause/play
  document.addEventListener('click', e => markUserAction(e.target.closest('video')), true);
  document.addEventListener('dblclick', e => markUserAction(e.target.closest('video')), true);
  document.addEventListener('contextmenu', e => markUserAction(e.target.closest('video')), true);

  // Space key when video focused => user intent
  document.addEventListener('keydown', e => {
    if ([' ', 'Spacebar', 'Space'].includes(e.key)) {
      const v = document.activeElement?.tagName === 'VIDEO'
        ? document.activeElement
        : document.querySelector('video');
      markUserAction(v);
    }
  }, true);

  // ===== 4) Detect visible vs offscreen videos =====
  const visibleVideos = new WeakSet();
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const v = entry.target;
      if (!entry.isIntersecting) v.dataset.outOfView = '1';
      else delete v.dataset.outOfView;
    }
  }, { threshold: 0.5 });

  const watch = () => {
    document.querySelectorAll('video').forEach(v => {
      if (!visibleVideos.has(v)) {
        visibleVideos.add(v);
        try { io.observe(v); } catch (e) {}
      }
    });
  };
  new MutationObserver(watch).observe(document, { childList: true, subtree: true });
  watch();

  // ===== 5) Fix pause logic =====
  // Rules:
  // - If user explicitly paused the video (marker dataset.userPaused), honor pause.
  // - If video is out of view (dataset.outOfView), honor pause (we don't force-play videos out of view).
  // - If document is visible, honor pause (lets user/site pause while tab active).
  // - Otherwise (most programmatic pauses triggered when tab becomes hidden), ignore pause.
  HTMLMediaElement.prototype.pause = function(...args) {
    try {
      const v = this;

      // If the user explicitly interacted to pause -> allow.
      if (v.dataset.userPaused === '1') {
        return origPause.apply(v, args);
      }

      // If the video is out of view (scrolled out) -> allow pause.
      if (v.dataset.outOfView === '1') {
        return origPause.apply(v, args);
      }

      // If the page is visible, allow pause (site or user while visible).
      // This prevents breaking normal pause controls while you're on the page.
      if (document.visibilityState === 'visible') {
        return origPause.apply(v, args);
      }

      // Otherwise: ignore pause (this blocks pauses caused by visibility change),
      // effectively keeping the video playing when the page is backgrounded.
      return;
    } catch (e) {
      // In case anything goes wrong, fall back to original pause to avoid breaking the page.
      try { return origPause.apply(this, args); } catch (err) { /* noop */ }
    }
  };

  // ===== 6) Play override: clear user-paused marker when play is called programmatically or by user.
  // If the user intentionally paused and then hits play, that indicates they want playback again.
  HTMLMediaElement.prototype.play = function(...args) {
    try {
      delete this.dataset.userPaused;
    } catch (e) {}
    return origPlay.apply(this, args);
  };

  // ===== 7) Optional: recover from accidental pauses by the site:
  // If a video emits a 'pause' event while it shouldn't be paused, attempt to play it.
  // This runs asynchronously and only when the video isn't user-paused/out-of-view.
  document.addEventListener('pause', function(e) {
    const v = e.target;
    if (!(v instanceof HTMLMediaElement)) return;
    try {
      if (v.dataset.userPaused === '1') return;
      if (v.dataset.outOfView === '1') return;
      if (document.visibilityState !== 'visible') {
        // try to resume playback; ignore failures (autoplay policies etc.)
        v.play?.().catch(()=>{});
      }
    } catch (err) {}
  }, true);

  // ===== 8) Keep monitoring new videos and clear stale markers where appropriate
  const cleanupObserver = new MutationObserver(() => {
    document.querySelectorAll('video').forEach(v => {
      // if a video is removed then re-added, ensure dataset flags are respected.
      // no-op here, but this is where you'd add extra per-video initialization if needed.
    });
  });
  cleanupObserver.observe(document, { childList: true, subtree: true });

})();

