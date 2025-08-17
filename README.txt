Logo Patch

- Adds /images/logo.svg and /images/logo.png so your site stops 404-ing /images/logo.png.
- You can replace these with your real artwork anytime.

How to install
1) Unzip at the repo root so the path is exactly /images/logo.png and /images/logo.svg.
2) Commit and redeploy.

Recommended HTML snippet
------------------------
Use the SVG with PNG fallback:

<img src="/images/logo.svg" alt="Shazbot" height="32"
     onerror="this.onerror=null;this.src='/images/logo.png';">

Favicon (optional):
<link rel="icon" href="/images/logo.png">
