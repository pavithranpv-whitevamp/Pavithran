# Pavithran — Portfolio Website

Personal portfolio of **Pavithran**, Graphic Designer & Motion Graphics Video Editor.
A plain HTML/CSS website hosted free on **Cloudflare Pages**, straight from this GitHub repo.

## How the site is organised

| Page | File |
|---|---|
| Home | `index.html` |
| Portfolio | `portfolio/index.html` |
| About Me | `about-me/index.html` |
| Contact | `contact/index.html` |
| Social Media Posters (project) | `work/social-media-posters/index.html` |
| Thank-you page (after the contact form) | `thanks/index.html` |
| Page not found | `404.html` |

- `assets/css/style.css` — all colours, fonts and layout. Brand colours are at the top (section 1).
- `assets/js/main.js` — preloader, mouse effects, mobile menu, image viewer, scroll animations.
- `images/` — every picture the site uses.

## How to edit the site (no software needed)

1. Open this repo on github.com.
2. Click the file you want to change (for example `about-me/index.html`), then the ✏️ pencil icon.
3. Change the text between the tags, e.g. `<p>your text</p>`.
4. Click **Commit changes**. Cloudflare publishes the update automatically in about a minute.

**Add a picture:** open the `images` folder → **Add file → Upload files** → drop the image → **Commit changes**.
Then use it in a page as `<img src="/images/your-file-name.jpg" alt="what it shows">`.

**Add a new project:** copy the folder `work/social-media-posters/`, rename the copy (e.g. `work/logo-designs/`),
change the title and images inside, then add a new card for it in `portfolio/index.html` and `index.html`
(copy the existing `<a class="card ...">` block and change the link, image and title).

## Contact form

The form on the Contact page is sent by [FormSubmit](https://formsubmit.co) (free, no account) to
Pavithranwv@gmail.com. **The very first time** someone uses it, FormSubmit emails that address an
activation link — click it once, and every message after that arrives normally.

## Hosting on Cloudflare Pages

Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo →
Framework preset: **None**, Build command: *(leave empty)*, Build output directory: `/` → **Save and Deploy**.
