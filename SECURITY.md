# Security

LifeLink India currently publishes a static guide to official blood-service resources. The site does not accept blood requests or donor registrations, and it does not store personal or medical details.

## Report a security issue

Email [abhinash1023@gmail.com](mailto:abhinash1023@gmail.com) with a description of the issue, the affected page, and steps to reproduce it. Please do not include patient records, donor contact details, passwords, or other sensitive information in a report.

There is no formal bug-bounty program or guaranteed response time.

## Hosting note

The browser content policy in `index.html` is enforced by browsers on the current static site. The root `_headers` file provides response-header rules for a future Cloudflare Pages deployment. GitHub Pages does not read that Cloudflare-specific file, so its clickjacking, MIME-sniffing, and other HTTP-header protections are not active on the current GitHub Pages host.
