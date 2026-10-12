# LifeLink India

LifeLink India is an independent, India-wide guide to official blood-service resources, with an optional phone-verified community matching service in a separate release branch. Use eRaktKosh and the treating hospital or licensed blood centre for current availability and clinical decisions.

**Current live guide:** https://abhinash1023-alt.github.io/LIFELINK/

## Official-service guide

The guide links to eRaktKosh for stock search, blood-centre information, camp schedules, and voluntary donor registration. It includes a preparation checklist, emergency guidance for India, and site-sharing support.

## Community matching service

The service is designed for Cloudflare Workers + D1 with Firebase phone authentication.

- A donor profile stores a recorded blood group and state/district.
- A request stores the hospital-provided component, units, hospital or blood-centre name, district, requested time, consent, and the requester’s verified number encrypted with AES-GCM.
- A requester must explicitly consent before their number can be shown.
- Only signed-in volunteers with the same recorded blood group and normalized state/district can view active requests. They must press a reveal button to get the requester’s number.
- Donor phone numbers are not displayed to requesters.
- Requests expire at the requested time or within 72 hours, whichever comes first. Up to two requests may be active per account.
- A volunteer may reveal at most five distinct requester numbers per rolling 24-hour period per Firebase account.
- People can close requests and delete their LifeLink data. A hospital or licensed blood centre must make all clinical decisions.

Phone verification checks number access, not identity. Matching does not verify a request, donor fitness, or compatibility. Contact numbers can be copied once revealed. Do not use LifeLink as an emergency or blood-availability guarantee.

## Deployment requirements

The matching branch is not ready to merge to GitHub Pages. GitHub Pages cannot run this API. Before public launch:

1. Create a Cloudflare D1 database and apply `migrations/0001_init.sql`.
2. Configure the Worker’s D1 binding as `DB`.
3. Set Worker variables `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN`, and `FIREBASE_APP_ID`.
4. Set the Worker secret `DATA_ENCRYPTION_KEY` to 64 random hex characters. Keep it outside Git and never send it in chat.
5. Enable Firebase Phone sign-in, restrict SMS regions to India, and add the final public host (and the temporary Workers host for setup) to Firebase Authorized domains.
6. Configure Firebase billing and SMS budgets/alerts before sending real SMS. Phone sign-in can incur per-message charges and abuse-related costs.
7. Deploy the Worker with `wrangler.jsonc`, confirm `/api/health` returns success, exercise account deletion and a consented test request using Firebase’s fictional test phone numbers, then connect the final domain and publish.

Do not use real patient numbers or real SMS while testing. The domain and final public hosting account must be configured before the site is discoverable under a custom address.

## Files

- `index.html`, `style.css`, `app.js`: India-wide static guide.
- `matching.html`, `matching.js`: phone OTP and matching interface.
- `privacy.html`: data use and consent information.
- `worker/index.js`: Cloudflare Worker API.
- `migrations/0001_init.sql`: D1 schema.
- `wrangler.jsonc`, `.assetsignore`: Cloudflare deployment configuration and upload exclusions.

## Official links

- [eRaktKosh blood stock search](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt)
- [eRaktKosh blood-centre directory](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/transactions/bbpublicindex.html)
- [eRaktKosh camp schedule](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/campSchedule.cnt)
- [eRaktKosh voluntary donor registration](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/onlineDonationRequest.cnt)
- [India 112 Emergency Response Support System](https://112.gov.in/)
- [Directorate General of Health Services: Blood Transfusion Services](https://dghs.mohfw.gov.in/bts.php)
- [Firebase phone authentication documentation](https://firebase.google.com/docs/auth/web/phone-auth)
- [Cloudflare Workers Static Assets documentation](https://developers.cloudflare.com/workers/static-assets/)

## Contact

Managed by **Mudda Abinash** · [abhinash1023@gmail.com](mailto:abhinash1023@gmail.com)
