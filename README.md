# Pavithran — Portfolio Website

Personal portfolio of **Pavithran**, Graphic Designer & Motion Graphics Video Editor.
A plain HTML/CSS website hosted free on **Cloudflare Pages**, straight from this GitHub repo.

## Adding and editing your work — the admin page

Go to **https://pavithran.pages.dev/admin/** on any phone or computer and log in with your
username and password. You stay logged in on that device for 30 days.

- **+ Add new work**: title, category, photos (straight from your gallery), YouTube links,
  description → **Publish**. The site updates about a minute later.
- **Main category** is the tag on the project's card. **Also show it under** adds extra categories:
  the project then also appears under those filters on the Portfolio page, tagged with that category.
- Tap a project to edit it, or scroll to the bottom to delete it.
- Large photos are shrunk automatically before upload.

How it works: `src/admin/index.html` is the page, and `functions/admin/api/[[path]].js` is a
Cloudflare Pages Function that saves each change to this repo as one commit (so Cloudflare rebuilds).
It needs three settings in Cloudflare → Workers & Pages → pavithran → Settings → Variables and Secrets:

| Name | Type | Value |
|---|---|---|
| `ADMIN_USER` | Text | your admin username |
| `ADMIN_PASSWORD` | Secret | your admin password |
| `GITHUB_TOKEN` | Secret | a fine-grained GitHub token for this repo with **Contents: Read and write** |

After changing any of them, redeploy (Deployments → latest → ⋯ → Retry deployment).
Changing the password logs out every device. When the GitHub token expires, create a new one and replace it.

The older Pages CMS dashboard (`.pages.yml`, app.pagescms.org) still works too, if you ever want it.

## Private Vault — your secret files

**https://pavithran.pages.dev/admin/vault/** is a private folder for your scripts, plugins and other
files. It uses the same username and password as the admin page. Upload (drag-and-drop works),
sort into folders, rename, download and delete — up to 500 MB per file (files over 20 MB are stored
in 20 MB pieces and joined back together when you download them).

The files are **not** stored in this GitHub repo (the repo is public). They live in Cloudflare KV storage,
which only the vault can read. One-time setup:

1. Cloudflare → **Storage & Databases → KV → Create** a namespace called `pavithran-vault`.
2. **Workers & Pages → pavithran → Settings → Bindings → Add → KV namespace**:
   Variable name `VAULT`, namespace `pavithran-vault` → Save.
3. Deployments → latest → ⋯ → **Retry deployment**.

Files: `src/admin/vault/index.html` (the page) and `functions/admin/vault-api/[[path]].js` (its back end).
Cloudflare's free KV plan allows 1 GB of storage in total and about 1,000 saves per day
(every 20 MB piece of a big file counts as one save).

## Portfolio showcase and testimonials

- **Work wall:** every YouTube video and design in your projects becomes a tile on the Home page
  (a mix of the newest, from projects with "Show on the Home page" on) and on the Portfolio page
  ("Every piece"). Tapping a tile plays it right there; arrows go to the next piece. YouTube Shorts
  links (`youtube.com/shorts/…`) are shown vertical, other links wide. Nothing to set up — it's
  built from your projects automatically.
- **Testimonials:** admin page → **Testimonials**. Send colleagues the link
  **https://pavithran.pages.dev/recommend/** (there's a WhatsApp button for it). What they write
  is saved on the site (in the VAULT storage, by `functions/api/recommend.js`) and shows up in
  admin → Testimonials → **New from colleagues** (the button gets a number badge). Tap
  **Add to website**, then **Publish**. Nothing goes live until you publish. The "Working with me" section appears on
  Home and About as soon as at least one testimonial is shown, and stays hidden while there are none.
  Saved in `content/testimonials.json`.
- **About page:** "My Creative Approach" and "What makes my work different" are in
  `src/about-me/index.html` (search for `ap-steps` and `dif-grid`) — edit the wording any time.

## WhatsApp button, recruiter assistant and Career Timeline

- **WhatsApp button + "Cue" (the "Hiring? Ask Cue" chat)** appear on every public page, with gentle animations. Both live in
  `src/assets/js/assistant.js`: change the WhatsApp number in `WA_NUMBER`, and edit any answer in
  the `ANSWERS` list (each has the words that trigger it and the reply). It's free and needs no server —
  it answers from the facts written there, and sends anything it can't answer to WhatsApp.
- **Career Timeline** (Home and About pages) is in `src/index.html` and `src/about-me/index.html`
  (search for `xp-panel`). Each job is a clip with `data-start` / `data-end` (YYYY-MM); leave out
  `data-end` for your current job. Durations and the "years" numbers update themselves.
  When you change jobs, update the job list in `assistant.js` too.

## How the site is organised

| Folder / file | What it is |
|---|---|
| `content/projects/` | One file per project — the dashboard writes these |
| `images/` | Every picture on the site — the dashboard uploads here |
| `src/` | Page templates: Home, Portfolio, About Me, Contact, thank-you and 404 pages |
| `src/_project.html` | The layout every project page uses |
| `src/assets/css/style.css` | Colours, fonts and layout (brand colours at the top) |
| `src/assets/js/main.js` | Preloader, effects, mobile menu, portfolio filter, image viewer |
| `build.js` | Turns all of the above into the finished website (in `dist/`) |
| `.pages.yml` | Settings for the older Pages CMS dashboard |
| `src/admin/`, `functions/admin/` | The admin page, the private vault, and their back ends |

To change wording on the About or Contact page, edit `src/about-me/index.html` or `src/contact/index.html`
on github.com (✏️ pencil icon → change the text → **Commit changes**).

## Contact form

The form on the Contact page is sent by [FormSubmit](https://formsubmit.co) (free, no account) to
Pavithranwv@gmail.com.

## Hosting on Cloudflare Pages

Cloudflare dashboard → **Workers & Pages → pavithran → Settings → Build**:
Build command `node build.js`, Build output directory `dist`.
