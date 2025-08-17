Drop-in Function Update: scp.js (broad search)
=============================================

This replaces `netlify/functions/scp.js` and adds an automatic "broad search"
fallback when the primary query returns too few results. It's tailored to
fix generic set queries like "2025 score rookie".

How it works
------------
- Calls the SportsCardsPro search API with the original q.
- If < 10 results, it automatically tries alternates like:
  "2025 panini score", "2025 score", "panini score rookie",
  token pairs and strong single tokens, then unions & de-dupes.
- Filters to sports (by default), ranks, and returns with images when
  `?withImage=1` is present.

Usage
-----
1) Replace your `netlify/functions/scp.js` with this file.
2) Ensure the root has `package.json` (ESM or add `"type": "module"`).
3) Ensure Netlify env var **SCP_TOKEN** is set.
4) Deploy, then test:
   /.netlify/functions/scp?q=2025%20score%20rookie&withImage=1
