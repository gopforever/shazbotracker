Shazbot Hotfix: Sports-first search for players like "michael penix jr"
=====================================================================

What’s inside:
- netlify/functions/scp.js  → replaces your search proxy. Defaults to domain=sports
  and filters/reranks to avoid TCG bleed-through.

Deploy steps (Netlify UI):
1) Site settings → Environment variables → Ensure SCP_TOKEN is set to your SportsCardsPro key.
2) Drag-and-drop this ZIP as a deploy, OR replace just the file in your repo and push.
3) No UI changes required. Client calls can stay:
     /.netlify/functions/scp?q=<query>&withImage=1
   (Optional) Users can override with &domain=tcg or &domain=all

Notes:
- The function also tries a fallback search on the last name if the full query returns little.
- Images are passed through unchanged; your UI should continue to proxy via /.netlify/functions/img?src=...
