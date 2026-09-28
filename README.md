# PromptVault

A full-stack Node.js app for saving, searching, and reusing AI prompts. Prompts can contain `{{blanks}}`. When you copy one, the app asks you to fill the blanks in first, so a prompt pattern becomes a reusable template.

Built with **Node.js only**: no frameworks and no npm dependencies. The server uses Node's built-in `http`, `fs`, and `node:test` modules, and the front end is plain HTML, CSS, and JavaScript.

## Features

- Create, read, update, and delete prompts (REST API)
- Search by title, prompt text, or tag
- Tag filter with counts in a sidebar
- `{{variable}}` templates: fill in the blanks, then copy the finished prompt
- "Copied N times" counter for each prompt
- Server-side validation, with clear error messages shown in the form
- Data saved to a JSON file, so prompts survive a restart
- Automated API tests (12 tests)
- Ships with 8 starter prompts based on well-known prompt patterns

## Run it

You need Node.js 18 or newer.

```bash
npm start
```

Open http://localhost:3000. Set another port with `PORT=4000 npm start`.

Run the tests with:

```bash
npm test
```

## API

| Method | URL | What it does |
| --- | --- | --- |
| GET | `/api/health` | Server status and prompt count |
| GET | `/api/prompts?q=text&tag=name` | List prompts, optionally searched and filtered |
| GET | `/api/prompts/:id` | Get one prompt |
| POST | `/api/prompts` | Create a prompt (`title`, `body`, `tags`) |
| PUT | `/api/prompts/:id` | Replace a prompt's title, body, and tags |
| DELETE | `/api/prompts/:id` | Delete a prompt (returns 204) |
| POST | `/api/prompts/:id/copy` | Record that a prompt was copied |
| GET | `/api/tags` | All tags with counts |

Errors return JSON like `{ "error": "Invalid prompt", "details": ["title is required"] }` with a suitable status code: 400 (bad input), 404 (not found), 405 (wrong method), 413 (body too large).

## Project structure

```
promptvault/
├── server.js          # HTTP server, routing, static files, error handling
├── lib/
│   ├── store.js       # PromptStore: in-memory data saved to a JSON file
│   └── validate.js    # Input checking and tag cleanup
├── public/            # Front end (index.html, style.css, app.js)
├── data/prompts.json  # Saved prompts (starter data included)
└── test/api.test.js   # Automated tests
```

## Design decisions

- **No dependencies.** Building the router, body parser, and static file server by hand shows how Express-style tools work underneath.
- **Safe file serving.** Requests that try to leave the `public` folder (like `/../server.js`) are blocked, and a test covers it.
- **Safe rendering.** The front end builds elements with `textContent` instead of `innerHTML`, so saved text can never run as HTML.
- **Safe saving.** Data is written to a temp file and then renamed, so a crash cannot leave a half-written file.
- **Body size limit.** Requests over 1 MB are rejected.

## Ideas for next steps

- Replace the JSON file with SQLite or MongoDB
- Move the routes to Express
- Add user accounts, so each person has a private vault
- Export and import prompts as JSON
- Deploy it on Render or Railway

## Author

Rasal MK, BCA student, Bengaluru North University
