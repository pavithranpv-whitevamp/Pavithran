# Pavithran — Portfolio Website

Personal portfolio of **Pavithran**, Graphic Designer & Motion Graphics Video Editor.
A plain HTML/CSS website hosted free on **Cloudflare Pages**, straight from this GitHub repo.

## Adding and editing your work — the dashboard

Go to **https://app.pagescms.org**, sign in with GitHub, and open this repo.

- **My Works → Add an entry** to create a project: give it a title, pick a category, drop in a cover
  and gallery images, or paste a YouTube link for a video. Click **Save**.
- Click any project to change it; use the **…** menu to delete one.
- **Media** shows every image on the site; you can upload or remove images there too.

Every save goes to GitHub, and Cloudflare publishes the change on the live site in about a minute.

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
| `.pages.yml` | Dashboard settings (which fields a project has, categories, etc.) |

To change wording on the About or Contact page, edit `src/about-me/index.html` or `src/contact/index.html`
on github.com (✏️ pencil icon → change the text → **Commit changes**).

## Contact form

The form on the Contact page is sent by [FormSubmit](https://formsubmit.co) (free, no account) to
Pavithranwv@gmail.com.

## Hosting on Cloudflare Pages

Cloudflare dashboard → **Workers & Pages → pavithran → Settings → Build**:
Build command `node build.js`, Build output directory `dist`.
