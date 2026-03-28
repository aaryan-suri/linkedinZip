// ==UserScript==
// @name         LinkedIn Zip Auto-Solver v6
// @namespace    https://github.com/
// @version      6.0
// @description  Speed-optimized LinkedIn Zip solver — SPA-aware, rAF-batched
// @author       Aaryan
// @match        https://www.linkedin.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
    'use strict';

    // ── Tuning ────────────────────────────────────────────────────
    // CELLS_PER_FRAME: how many cells to click per animation frame
    // (~16ms per frame at 60fps). Higher = faster but risks drops.
    // 3 means ~16 cells/sec → 49 cells in ~1s
    // 5 means ~26 cells/sec → 49 cells in ~0.6s
    const CELLS_PER_FRAME = 3;
    const MAX_WAIT_MS = 15000;
    const P = '[Zip]';

    const log = (...a) => console.log(P, ...a);
    const err = (...a) => console.error(P, ...a);

    let solverRunning = false;
    let lastPath = '';

    // ═══════════════════════════════════════════════════════════════
    //  0. SPA NAV DETECTION (instant)
    // ═══════════════════════════════════════════════════════════════

    function isZipPage() {
        return window.location.pathname.startsWith('/games/zip');
    }

    function onNavigate() {
        const path = window.location.pathname;
        if (path === lastPath) return;
        lastPath = path;
        if (isZipPage() && !solverRunning) {
            solverRunning = true;
            main();
        }
    }

    function setupNavWatcher() {
        const origPush = history.pushState;
        const origReplace = history.replaceState;
        history.pushState = function (...args) {
            origPush.apply(this, args);
            onNavigate();
        };
        history.replaceState = function (...args) {
            origReplace.apply(this, args);
            onNavigate();
        };
        window.addEventListener('popstate', onNavigate);

        // MutationObserver fires the instant LinkedIn injects game DOM
        new MutationObserver(() => {
            if (isZipPage() && !solverRunning) onNavigate();
        }).observe(document.body, { childList: true, subtree: true });

        setInterval(onNavigate, 200);
    }

    // ═══════════════════════════════════════════════════════════════
    //  1. EXTRACT SOLUTION
    // ═══════════════════════════════════════════════════════════════

    function extractSolution() {
        const el = document.getElementById('rehydrate-data');
        if (!el?.textContent) return null;

        const m = el.textContent.match(/\\"solution\\":\s*\[([\d,\s]+)\]/) ||
                  el.textContent.match(/"solution"\s*:\s*\[([\d,\s]+)\]/);
        if (!m) return null;

        try {
            const sol = JSON.parse(`[${m[1]}]`);
            return (sol.length > 0 && sol.every(n => typeof n === 'number')) ? sol : null;
        } catch (_) { return null; }
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. CELL LOOKUP + EVENTS
    // ═══════════════════════════════════════════════════════════════

    function findCell(idx) {
        return document.querySelector(`[data-cell-idx="${idx}"]`);
    }

    function clickCell(el) {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const shared = {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y,
            screenX: x + window.screenX, screenY: y + window.screenY,
            button: 0, buttons: 1,
        };
        const pShared = { ...shared, pointerId: 1, pointerType: 'mouse', isPrimary: true };

        el.dispatchEvent(new PointerEvent('pointerdown', pShared));
        el.dispatchEvent(new MouseEvent('mousedown', shared));
        el.dispatchEvent(new PointerEvent('pointerup', { ...pShared, buttons: 0 }));
        el.dispatchEvent(new MouseEvent('mouseup', { ...shared, buttons: 0 }));
        el.dispatchEvent(new MouseEvent('click', { ...shared, buttons: 0 }));
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. rAF-BATCHED EXECUTION
    // ═══════════════════════════════════════════════════════════════
    // Instead of setTimeout per cell (minimum ~4ms each, often 16ms+
    // due to browser throttling), we use requestAnimationFrame and
    // process multiple cells per frame. This is significantly faster.

    function executeSolution(solution) {
        const t0 = performance.now();
        let i = 0;

        function frame() {
            const batchEnd = Math.min(i + CELLS_PER_FRAME, solution.length);
            while (i < batchEnd) {
                const cell = findCell(solution[i]);
                if (cell) {
                    clickCell(cell);
                } else {
                    err(`Cell ${solution[i]} not found at step ${i}`);
                }
                i++;
            }

            if (i < solution.length) {
                requestAnimationFrame(frame);
            } else {
                const elapsed = (performance.now() - t0).toFixed(0);
                log(`Done! ${solution.length} cells in ${elapsed}ms`);
                solverRunning = false;
            }
        }

        requestAnimationFrame(frame);
    }

    // ═══════════════════════════════════════════════════════════════
    //  4. MAIN
    // ═══════════════════════════════════════════════════════════════

    function main() {
        const t0 = Date.now();
        let executed = false;

        // Use rAF for polling too — tighter than setTimeout
        function poll() {
            if (!isZipPage()) { solverRunning = false; return; }
            if (Date.now() - t0 > MAX_WAIT_MS) {
                err('Timed out waiting for puzzle data');
                solverRunning = false;
                return;
            }

            const solution = extractSolution();
            if (solution && findCell(solution[0])) {
                if (executed) return;
                executed = true;
                log(`Found solution (${solution.length} cells) in ${Date.now() - t0}ms`);
                executeSolution(solution);
                return;
            }

            requestAnimationFrame(poll);
        }

        requestAnimationFrame(poll);
    }

    // ═══════════════════════════════════════════════════════════════
    //  5. BOOT
    // ═══════════════════════════════════════════════════════════════

    lastPath = window.location.pathname;
    if (isZipPage()) { solverRunning = true; main(); }
    setupNavWatcher();
})();