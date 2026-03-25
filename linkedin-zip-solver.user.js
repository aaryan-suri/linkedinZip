// ==UserScript==
// @name         LinkedIn Zip Auto Solver
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Automatically solves the LinkedIn Zip daily puzzle by reading the hidden solution data
// @author       Aaryan
// @match        https://www.linkedin.com/games/zip/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    console.log('%c[Zip Solver] Script loaded - waiting for puzzle data...', 'color: #0077b5; font-weight: bold');

    const DATA_ID = 'rehydrate-data';
    const CLICK_DELAY = 85;           // milliseconds between clicks (feels natural)
    let attempts = 0;
    const maxAttempts = 60;           // roughly 12 seconds of waiting

    function clickCell(cellNum) {
        const cell = document.querySelector(`[data-cell-idx="${cellNum}"]`);
        if (!cell) {
            console.warn(`[Zip Solver] Cell ${cellNum} not found`);
            return;
        }

        const ev = { bubbles: true, cancelable: true, view: window };

        cell.dispatchEvent(new PointerEvent('pointerdown', ev));
        cell.dispatchEvent(new MouseEvent('mousedown', ev));
        cell.click();
        cell.dispatchEvent(new MouseEvent('mouseup', ev));
        cell.dispatchEvent(new PointerEvent('pointerup', ev));

        console.log(`[Zip Solver] Clicked cell → ${cellNum}`);
    }

    function trySolve() {
        attempts++;
        const dataNode = document.getElementById(DATA_ID);

        if (!dataNode || !dataNode.textContent) {
            if (attempts < maxAttempts) {
                setTimeout(trySolve, 200);
            } else {
                console.error('[Zip Solver] Could not find puzzle data after waiting');
            }
            return;
        }

        const text = dataNode.textContent;
        const match = text.match(/\\"solution\\":\[(.*?)\]/s);

        if (!match) {
            console.error('[Zip Solver] Solution array not found in data');
            return;
        }

        let solution;
        try {
            solution = JSON.parse(`[${match[1]}]`);
        } catch (err) {
            console.error('[Zip Solver] Failed to parse solution:', err);
            return;
        }

        if (!Array.isArray(solution) || solution.length === 0) {
            console.error('[Zip Solver] Invalid solution data');
            return;
        }

        console.log(`%c[Zip Solver] Found solution! ${solution.length} moves`, 'color: green; font-weight: bold', solution);

        // Click each cell with a small delay
        solution.forEach((cell, i) => {
            setTimeout(() => {
                clickCell(cell);
            }, i * CLICK_DELAY);
        });

        console.log('%c[Zip Solver] Puzzle should be solved shortly 🎉', 'color: green; font-weight: bold');
    }

    // Start checking after a short delay
    setTimeout(trySolve, 600);

})();