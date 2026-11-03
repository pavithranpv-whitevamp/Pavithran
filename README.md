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
| `src/admin/`, `functions/admin/` | The admin page and its back end |

To change wording on the About or Contact page, edit `src/about-me/index.html` or `src/contact/index.html`
on github.com (✏️ pencil icon → change the text → **Commit changes**).

## Contact form

The form on the Contact page is sent by [FormSubmit](https://formsubmit.co) (free, no account) to
Pavithranwv@gmail.com.

## Hosting on Cloudflare Pages

Cloudflare dashboard → **Workers & Pages → pavithran → Settings → Build**:
Build command `node build.js`, Build output directory `dist`.
