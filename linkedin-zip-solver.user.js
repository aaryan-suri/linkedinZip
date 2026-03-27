// ==UserScript==
// @name         LinkedIn Zip Auto-Solver v4
// @namespace    https://github.com/
// @version      4.0
// @description  Automatically solves LinkedIn Zip puzzle - works with SPA navigation
// @author       Aaryan
// @match        https://www.linkedin.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
    'use strict';

    const CLICK_DELAY_MS = 100;
    const MAX_WAIT_MS = 20000;
    const POLL_INTERVAL_MS = 200;
    const NAV_CHECK_MS = 500;
    const P = '[Zip Solver]';

    const log = (...a) => console.log(P, ...a);
    const warn = (...a) => console.warn(P, ...a);
    const err = (...a) => console.error(P, ...a);

    let solverRunning = false;
    let lastUrl = '';

    // ═══════════════════════════════════════════════════════════════
    //  0. SPA NAVIGATION DETECTION
    // ═══════════════════════════════════════════════════════════════
    // LinkedIn is an SPA — navigating from /feed/ to /games/zip
    // doesn't trigger a page reload, so Tampermonkey won't re-run.
    // We match all of linkedin.com/* and watch for URL changes.

    function isZipPage() {
        return window.location.pathname.startsWith('/games/zip');
    }

    function watchForNavigation() {
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                if (isZipPage() && !solverRunning) {
                    log('Detected navigation to Zip page');
                    solverRunning = true;
                    // Brief delay for SPA content to start rendering
                    setTimeout(main, 300);
                }
            }
        }, NAV_CHECK_MS);

        // Also catch pushState/replaceState which LinkedIn uses
        const origPush = history.pushState;
        const origReplace = history.replaceState;
        history.pushState = function (...args) {
            origPush.apply(this, args);
            checkUrlChange();
        };
        history.replaceState = function (...args) {
            origReplace.apply(this, args);
            checkUrlChange();
        };
        window.addEventListener('popstate', checkUrlChange);
    }

    function checkUrlChange() {
        setTimeout(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                if (isZipPage() && !solverRunning) {
                    log('Detected navigation to Zip page (pushState)');
                    solverRunning = true;
                    setTimeout(main, 300);
                }
            }
        }, 100);
    }

    // ═══════════════════════════════════════════════════════════════
    //  1. EXTRACT THE SOLUTION ARRAY
    // ═══════════════════════════════════════════════════════════════

    function extractSolution() {
        const el = document.getElementById('rehydrate-data');
        if (el?.textContent) {
            const text = el.textContent;
            const patterns = [
                /\\"solution\\":\s*\[([\d,\s]+)\]/,
                /"solution"\s*:\s*\[([\d,\s]+)\]/,
                /\\\\?"solution\\\\?":\s*\[([\d,\s]+)\]/,
            ];
            for (const pat of patterns) {
                const m = text.match(pat);
                if (m) {
                    try {
                        const sol = JSON.parse(`[${m[1]}]`);
                        if (sol.length > 0 && sol.every(n => typeof n === 'number')) {
                            return sol;
                        }
                    } catch (e) { warn('Parse fail:', e.message); }
                }
            }

            try {
                let parsed = JSON.parse(text);
                if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                const sol = deepFind(parsed, 'solution');
                if (sol) return sol;
            } catch (_) {}
        }

        for (const tag of document.querySelectorAll('script')) {
            const text = tag.textContent || '';
            if (!text.includes('solution')) continue;
            const m = text.match(/\\"solution\\":\s*\[([\d,\s]+)\]/) ||
                      text.match(/"solution"\s*:\s*\[([\d,\s]+)\]/);
            if (m) {
                try {
                    const sol = JSON.parse(`[${m[1]}]`);
                    if (sol.length > 0) return sol;
                } catch (_) {}
            }
        }

        return null;
    }

    function deepFind(obj, key, depth = 0) {
        if (depth > 20 || !obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const r = deepFind(item, key, depth + 1);
                if (r) return r;
            }
            return null;
        }
        for (const k of Object.keys(obj)) {
            if (k === key && Array.isArray(obj[k]) && obj[k].length > 0 &&
                obj[k].every(n => typeof n === 'number')) {
                return obj[k];
            }
            const r = deepFind(obj[k], key, depth + 1);
            if (r) return r;
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. FIND CELL ELEMENTS
    // ═══════════════════════════════════════════════════════════════

    function findCell(idx) {
        return document.querySelector(`[data-cell-idx="${idx}"]`) ||
               document.querySelector(`[data-cell-index="${idx}"]`) ||
               document.querySelector(`[data-idx="${idx}"]`);
    }

    function getCellCenter(el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. SIMULATE INTERACTIONS
    // ═══════════════════════════════════════════════════════════════

    function makePointerOpts(el, extra = {}) {
        const { x, y } = getCellCenter(el);
        return {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y,
            screenX: x + window.screenX, screenY: y + window.screenY,
            pointerId: 1, pointerType: 'mouse', isPrimary: true,
            button: 0, buttons: 1, ...extra,
        };
    }

    function makeMouseOpts(el, extra = {}) {
        const { x, y } = getCellCenter(el);
        return {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y,
            screenX: x + window.screenX, screenY: y + window.screenY,
            button: 0, buttons: 1, ...extra,
        };
    }

    function executeDrag(solution) {
        log('Attempting DRAG method...');
        const cells = solution.map(findCell);
        const missing = cells.findIndex(c => !c);
        if (missing !== -1) {
            warn(`Drag: cell ${solution[missing]} not found (step ${missing})`);
            return false;
        }

        const first = cells[0];
        first.dispatchEvent(new PointerEvent('pointerdown', makePointerOpts(first)));
        first.dispatchEvent(new MouseEvent('mousedown', makeMouseOpts(first)));

        cells.slice(1).forEach((cell, i) => {
            setTimeout(() => {
                cell.dispatchEvent(new PointerEvent('pointerover', makePointerOpts(cell)));
                cell.dispatchEvent(new PointerEvent('pointerenter', makePointerOpts(cell, { bubbles: false })));
                cell.dispatchEvent(new PointerEvent('pointermove', makePointerOpts(cell)));
                cell.dispatchEvent(new MouseEvent('mouseover', makeMouseOpts(cell)));
                cell.dispatchEvent(new MouseEvent('mouseenter', makeMouseOpts(cell, { bubbles: false })));
                cell.dispatchEvent(new MouseEvent('mousemove', makeMouseOpts(cell)));

                if (i === cells.length - 2) {
                    setTimeout(() => {
                        const last = cells[cells.length - 1];
                        last.dispatchEvent(new PointerEvent('pointerup', makePointerOpts(last, { buttons: 0 })));
                        last.dispatchEvent(new MouseEvent('mouseup', makeMouseOpts(last, { buttons: 0 })));
                        log('Drag complete!');
                    }, 50);
                }
            }, (i + 1) * CLICK_DELAY_MS);
        });
        return true;
    }

    function executeClicks(solution) {
        log('Attempting CLICK method...');
        solution.forEach((cellIdx, i) => {
            setTimeout(() => {
                const cell = findCell(cellIdx);
                if (!cell) { warn(`Click: cell ${cellIdx} not found`); return; }
                const po = makePointerOpts(cell);
                const mo = makeMouseOpts(cell);
                cell.dispatchEvent(new PointerEvent('pointerdown', po));
                cell.dispatchEvent(new MouseEvent('mousedown', mo));
                cell.dispatchEvent(new PointerEvent('pointerup', { ...po, buttons: 0 }));
                cell.dispatchEvent(new MouseEvent('mouseup', { ...mo, buttons: 0 }));
                cell.dispatchEvent(new MouseEvent('click', { ...mo, buttons: 0 }));
            }, i * CLICK_DELAY_MS);
        });
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  4. ORCHESTRATION
    // ═══════════════════════════════════════════════════════════════

    function dismissOverlays() {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
            const text = (btn.textContent || '').trim().toLowerCase();
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (text === 'play' || text === 'start' || text === 'play game' ||
                label.includes('play') || label.includes('start')) {
                if (btn.offsetParent !== null) {
                    log('Clicking play/start button');
                    btn.click();
                    return true;
                }
            }
        }
        return false;
    }

    function checkIfSolved() {
        const modal = document.querySelector('[class*="congrat"], [class*="success"], [class*="complete"]');
        if (modal) return true;
        const shareBtn = document.querySelector('button[aria-label*="share" i], button[aria-label*="result" i]');
        if (shareBtn && shareBtn.offsetParent !== null) return true;
        return false;
    }

    function main() {
        const startTime = Date.now();
        let overlayDismissed = false;
        let solutionExecuted = false;

        function poll() {
            // Stop if we navigated away
            if (!isZipPage()) {
                log('No longer on Zip page, stopping');
                solverRunning = false;
                return;
            }

            const elapsed = Date.now() - startTime;
            if (elapsed > MAX_WAIT_MS) {
                err(`Gave up after ${MAX_WAIT_MS / 1000}s`);
                debugDump();
                solverRunning = false;
                return;
            }

            if (checkIfSolved()) {
                log('Puzzle already solved!');
                solverRunning = false;
                return;
            }

            if (!overlayDismissed) {
                if (dismissOverlays()) {
                    overlayDismissed = true;
                    setTimeout(poll, 800);
                    return;
                }
            }

            const solution = extractSolution();
            if (!solution) {
                setTimeout(poll, POLL_INTERVAL_MS);
                return;
            }

            if (solutionExecuted) return;

            // Verify cells exist in DOM before executing
            const testCell = findCell(solution[0]);
            if (!testCell) {
                setTimeout(poll, POLL_INTERVAL_MS);
                return;
            }

            solutionExecuted = true;
            log(`Solution found (${solution.length} steps), executing...`);

            // Execute immediately — no extra delay
            const dragWorked = executeDrag(solution);

            const totalDragTime = solution.length * CLICK_DELAY_MS + 500;
            setTimeout(() => {
                if (!checkIfSolved()) {
                    log('Drag may not have worked, trying clicks...');
                    executeClicks(solution);

                    // Reset solver state after click attempt finishes
                    setTimeout(() => { solverRunning = false; }, solution.length * CLICK_DELAY_MS + 500);
                } else {
                    log('Solved!');
                    solverRunning = false;
                }
            }, totalDragTime);
        }

        log('Starting solver...');
        poll();
    }

    function debugDump() {
        err('=== DEBUG DUMP ===');
        const rh = document.getElementById('rehydrate-data');
        if (rh) {
            err('rehydrate-data found, length:', rh.textContent?.length);
            err('Contains "solution":', rh.textContent?.includes('solution'));
            err('First 500 chars:', rh.textContent?.substring(0, 500));
        } else {
            err('rehydrate-data NOT found');
        }
        err('data-cell-idx count:', document.querySelectorAll('[data-cell-idx]').length);
        err('=== END DEBUG ===');
    }

    // ═══════════════════════════════════════════════════════════════
    //  5. ENTRY — start watching immediately
    // ═══════════════════════════════════════════════════════════════

    log('Loaded — watching for Zip page navigation...');
    lastUrl = window.location.href;

    // If we're already on the Zip page (direct load / refresh), run now
    if (isZipPage()) {
        solverRunning = true;
        setTimeout(main, 200);
    }

    // Watch for SPA navigations
    watchForNavigation();
})();