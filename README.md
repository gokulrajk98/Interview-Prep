# Interview Prep Hub

A standalone personal interview-question manager built with plain HTML, CSS and JavaScript.

## Features

- Add, edit and delete interview questions.
- Organize questions by category, difficulty and preparation status.
- Store answers, code examples, practical scenarios and tags.
- Search and filter your question bank.
- Dashboard with progress tracking and a revision queue.
- Export and import JSON backups.
- Responsive layout for desktop, tablet and mobile.
- No account, backend, database, build step or paid service required.

## Run locally

1. Extract the ZIP file.
2. Open the `interview-prep-hub` folder.
3. Double-click `index.html` to open it in your browser.

For a local web-server preview, open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish online with GitHub Pages

1. Sign in to GitHub and create a new repository, for example `interview-prep-hub`.
2. Upload `index.html`, `styles.css`, `app.js` and optionally `README.md` to the repository root.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder, then save.
6. Wait for GitHub Pages to publish. The website URL will be shown in the Pages settings.

The site is static, so no server-side runtime or environment variables are needed.

## Publish online with Netlify

1. Sign in to Netlify.
2. Choose **Add new site → Deploy manually** (wording may vary).
3. Drag the extracted `interview-prep-hub` folder into the deploy area.
4. Netlify will publish the static site and provide a URL.
5. You can optionally configure a custom domain in your Netlify site settings.

## Important: how browser storage works

- Questions are stored in the browser's `localStorage` for the exact site origin.
- Data is not uploaded to a server and is not automatically synchronized between devices or browsers.
- If you publish on a new domain, that domain has separate browser storage. Export your JSON backup from the old site and import it on the new site.
- Clearing browser site data, using private/incognito mode, or changing browser profiles may remove or hide saved questions.
- Anyone with access to the same browser profile may be able to access the question bank. This version does not include sign-in or encryption.
- Export backups regularly using **Backup & settings → Download backup**. Keep the JSON file somewhere safe.

## Files

- `index.html` — page structure and modal forms.
- `styles.css` — responsive styling.
- `app.js` — question management, local storage, filtering, progress and backup logic.
- `README.md` — setup and deployment instructions.

## Customization

Edit the default categories in `app.js` in the `DEFAULT_CATEGORIES` array. You can also add categories from the website sidebar using the plus button beside **Categories**.
