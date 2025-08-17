Shazbot Netlify Hotfix (JSZip)

What this contains
------------------
1) package.json at the repository root declaring the 'jszip' dependency.
2) netlify/functions/zip.js updated to use a static 'require("jszip")', which helps the bundler
   detect the dependency. This eliminates the "Cannot find module 'jszip'" error.

How to apply
------------
- Drop BOTH files into your repo (at the same relative paths).
- Commit and redeploy on Netlify.

Optional (if builds still fail)
-------------------------------
Add the following to your existing netlify.toml (do not remove other content):

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["jszip"]

Notes
-----
- Netlify installs dependencies from the TOP-LEVEL package.json when bundling Functions.
- Ensure your site uses Node 18+ runtime (this file sets `engines.node` to ">=18").
