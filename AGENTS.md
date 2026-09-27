# Project workflow

- Use the npm scripts in `package.json` for routine work: `npm start`, `npm run build`, `npm run fix`, and `npm test`. `npm test` runs the Vite+ check and unit tests.
- Add dependencies with the project-local Vite+ binary: `./node_modules/.bin/vp add <package>` (use `-D` for a development dependency).
- Run `npm test` after making changes; run `npm run build` when the production build is affected.
