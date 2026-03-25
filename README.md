# LinkedIn Zip Auto Solver

A simple Tampermonkey userscript that automatically solves the daily **LinkedIn Zip** puzzle.

Made for fun while learning about browser automation and reverse-engineering simple web apps.

## Features

- Works as soon as you open https://www.linkedin.com/games/zip/
- Reads the hidden solution data from LinkedIn's own payload
- Simulates realistic mouse/pointer clicks
- Lightweight and fast

## How to Install

1. Install the **Tampermonkey** extension (Chrome, Edge, or Firefox)
2. Click the Tampermonkey icon → **Create a new script**
3. Delete everything and paste the content of `linkedin-zip-solver.user.js`
4. Save (Ctrl + S)
5. Go to the Zip game — it should solve itself!

## Files in this repo

- `linkedin-zip-solver.user.js` → the actual userscript
- `HOW-IT-WORKS.md` → detailed explanation of how it works
- `README.md` → this file

## Disclaimer

This is for educational purposes only. Use at your own risk. LinkedIn could change their page at any time and break the script.

Made with ❤️ by Aaryan
