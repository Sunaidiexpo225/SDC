# Connecting the social platforms — API setup guide

This guide explains how to obtain API access for each platform the app
supports, so an account can eventually **publish** from Sunaidi Design Central.

> **Read this first — current status.**
> - **Instagram publishing is LIVE.** Once you connect an Instagram account
>   (access token + IG Business Account ID) in **Admin → Integrations**, a
>   scheduled post with Cloudinary media can be published to Instagram via the
>   **Publish now** button (Calendar → open the post). This is the flow to
>   demonstrate for Meta App Review.
> - **X (Twitter) publishing is LIVE.** Set `X_API_KEY` / `X_API_SECRET` (the
>   app's consumer key/secret) in the environment, then connect an X account in
>   **Admin → Integrations** with its **Access Token** (field 1) + **Access
>   Token Secret** (field 2). "Publish now" then posts the caption (and image/
>   video) to X. Needs the X app set to **Read and write**.
> - **Facebook publishing is LIVE.** Connect a Facebook Page in **Admin →
>   Integrations** with its **Page access token** (field 1) + **Page ID**
>   (field 2) — same token type as Instagram, but it must carry the
>   `pages_manage_posts` permission. "Publish now" then posts to the Page.
> - **LinkedIn publishing is LIVE.** Set `LINKEDIN_CLIENT_ID` /
>   `LINKEDIN_CLIENT_SECRET` in the environment, then connect a LinkedIn
>   account in **Admin → Integrations** with the one-click **Connect with
>   LinkedIn** button (an OAuth sign-in — no manual token entry). "Publish now"
>   then posts the caption (and image/video) to the member's LinkedIn feed.
> - **TikTok publisher is not built yet** — the app stores its token but
>   "Publish now" reports it as not-yet-supported. Get its credentials (below)
>   and we'll wire the publisher.
>
> **Every platform below requires an app review / approval and a business or
> creator account before it will allow posting.** Budget days-to-weeks for
> approvals, not minutes. Plan for that.

---

## What each platform gives you (credential cheat-sheet)

| Platform | Where you apply | You end up with | Posting permission (needs review) |
| --- | --- | --- | --- |
| Instagram | Meta for Developers | App ID + Secret, Page/IG access token, IG User ID | `instagram_content_publish` |
| Facebook | Meta for Developers | App ID + Secret, Page access token, Page ID | `pages_manage_posts` |
| X (Twitter) | X Developer Portal | API Key/Secret, OAuth 2.0 Client ID/Secret, access token | `tweet.write` |
| TikTok | TikTok for Developers | Client Key + Secret, access token | `video.publish` (Content Posting API) |
| LinkedIn | LinkedIn Developer Portal | Client ID + Secret, access token, Org/Person URN | `w_member_social` / org posting |

> The app today stores **one token string per account**. Full publishing will
> need more than one value per platform (client id/secret, a refresh token, and
> the page/account ID). Keep every credential you collect — note them per
> account somewhere safe (a password manager), not in the repo.

---

## 1. Instagram (via Meta Graph API)

**Prerequisites**
- An **Instagram Business or Creator** account (not a personal account).
- A **Facebook Page** linked to that Instagram account.
- A Facebook account you can use as the app admin.

**Steps**
1. Go to **https://developers.facebook.com/** → log in → **My Apps** →
   **Create App**.
2. Choose the **Business** app type. Name it (e.g. "Sunaidi Design Central").
3. In the app dashboard, add the products **Instagram Graph API** and
   **Facebook Login**.
4. Under **App settings → Basic**, copy the **App ID** and **App Secret**.
5. Connect your **Facebook Page** and the **Instagram Business account** to the
   app (Business Settings → Accounts).
6. Use the **Graph API Explorer** (or Graph API) to generate a **User access
   token**, then exchange it for a **long-lived Page access token**. Also fetch
   your **Instagram Business Account ID** (`/me/accounts` → the page →
   `instagram_business_account`).
7. **Submit for App Review** requesting the content-publishing permission.
   You'll also need **Business Verification** for the Meta business.

**Two setup flows — pick the one you used:**

- **Instagram API with Instagram Login** (newer; separate *Instagram* app
  ID/secret; permissions named `instagram_business_*`). The app defaults to
  this — base host `https://graph.instagram.com`. **You must add the
  `instagram_business_content_publish` permission** — the "required messaging
  permissions" (`instagram_business_basic`, `..._manage_comments`,
  `..._manage_messages`) are for DMs/comments and do **not** include posting.
  The token is an **Instagram user access token** (generate it after assigning
  your account the *Instagram Tester* role); the account ID is your Instagram
  **user_id** (`GET /me?fields=user_id`).

- **Instagram API with Facebook Login** (classic Graph API; uses the Facebook
  app + a linked Page). Permissions `instagram_basic`,
  `instagram_content_publish`, `pages_read_engagement`. Set the env var
  `IG_API_BASE=https://graph.facebook.com/v21.0`. The token is a **Page access
  token**; the account ID is the **IG Business Account ID**.

**What you collect:** App ID, App Secret, long-lived Page access token,
Instagram Business Account ID.

**In the app:** Admin → Integrations → the Instagram account → **Connect** →
paste **two** values: the **access token** (first field) and the **Instagram
Business Account ID** (second field, "Account/Page ID"). Then open a scheduled
post with an uploaded image/video in the **Calendar** and hit **Publish now** —
that calls the Graph API and posts to Instagram.

> **For Meta App Review:** record this exact flow (connect account → schedule a
> post with media → Publish now → the post appears on Instagram) as your
> screencast demonstrating `instagram_content_publish`.

**Gotchas**
- Personal IG accounts cannot use content publishing — must be Business/Creator.
- Page access tokens expire; you'll refresh them (~60 days for long-lived).
- Review can take several days and requires a clear use-case + screencast.

### Analytics (real data)

The **Analytics** screen shows **live Instagram numbers** for any connected
account. Two tiers, depending on permissions:

- **Already works with `instagram_basic`** (which you have): real **follower
  count**, real **likes + comments** per post, **content-format split**
  (Reel/Video/Image), **best posting time**, and **top posts** (linked to the
  real post). Connect the account and the Analytics badge switches from
  *"Estimated"* to *"Live from Instagram"*.
- **Needs the `instagram_manage_insights` permission** (add it under *Go to
  permissions and features* → submit for App Review like the publishing one):
  real **reach / views**. Without it, everything above is still live; only the
  Views figure stays at 0 until the permission is granted.

If no Instagram account is connected for an event, Analytics falls back to
**estimated** numbers modelled from the audience size, clearly labelled as such.

---

## 2. Facebook Pages (via Meta Graph API) — LIVE

Facebook uses the **same Meta app** you created for Instagram, and the **same
kind of Page token** — you may already have both values from the Instagram
`me/accounts` step.

**Steps**
1. In the Graph API Explorer, generate a token that includes **`pages_manage_posts`**
   (add it to the permissions alongside `pages_read_engagement`, `pages_show_list`)
   → **Generate Access Token** → allow → select your Page.
2. Run `me/accounts?fields=name,access_token,id` → for your Page copy the
   **`access_token`** (Page token) and the **`id`** (Page ID). *(This is the same
   call you ran for Instagram — the token is the same; you just use the Page's
   `id` here, not the `instagram_business_account` id.)*
3. For a **non-expiring** Page token, first extend the user token (Access Token
   Debugger → Extend), then re-run `me/accounts` — see the Instagram section.

**What you collect:** Page access token (with `pages_manage_posts`), Page ID.

**In the app:** Admin → Integrations → the Facebook account → **Connect** →
paste the **Page access token** in field 1 and the **Page ID** in field 2.
Then a scheduled + approved post with Facebook selected posts via **Publish now**
(text, image, or video).

> **App Review:** posting to Pages you don't own needs `pages_manage_posts`
> approved. For your own Pages in development mode it works once the permission
> is added and your account is an admin/tester.

---

## 3. X / Twitter (API v2) — LIVE

**The app's X publisher uses OAuth 1.0a** (user-context), because its tokens
don't expire and media (image/video) upload is reliable — the right fit for a
server-side auto-poster. You need **four** values, all from one page.

**Prerequisites**
- An X account for the brand.
- A paid/pay-as-you-go API tier (the **Free** tier barely allows posting).

**Steps**
1. Go to **https://developer.x.com/** → create a **Project**, then an **App**.
2. In the app → **Settings → User authentication settings → Edit**: turn **ON
   OAuth 1.0a** and set **App permissions = Read and write**. Save.
3. In the app → **Keys and tokens** tab, copy all four values:
   - Under **Consumer Keys**: **API Key** and **API Key Secret**
   - Under **Authentication Tokens → "Access Token and Secret"** → **Generate**:
     **Access Token** and **Access Token Secret**
   > ⚠️ Generate the Access Token & Secret **after** setting Read and write — if
   > you change the permission later, regenerate them.

**What you collect:** API Key, API Key Secret, Access Token, Access Token Secret.
*(Ignore the Bearer Token / Client ID / Refresh Token — those are OAuth 2.0,
which this publisher does not use.)*

**In the app / env:**
- Set env vars **`X_API_KEY`** = API Key and **`X_API_SECRET`** = API Key Secret
  (Vercel → Settings → Environment Variables → redeploy).
- **Admin → Integrations → the X account → Connect**: paste the **Access Token**
  in field 1 and the **Access Token Secret** in field 2.

Then a scheduled + approved post with X selected can be sent via **Publish now**
(text, image, or video; caption is trimmed to X's 280-char limit).

**Gotchas / cost**
- X tiers: **Free** (almost no posting), **Basic**/**Pro** (paid). Posting needs
  a paid or pay-as-you-go tier.
- OAuth 1.0a Access Tokens **don't expire** — no refresh needed (unlike OAuth 2.0).

---

## 4. TikTok (Content Posting API)

**Prerequisites**
- A TikTok account for the brand (Business account recommended).

**Steps**
1. Go to **https://developers.tiktok.com/** → register / log in → **Manage
   apps** → **Create an app**.
2. In the app, add the **Content Posting API** product.
3. From the app credentials, copy the **Client Key** and **Client Secret**.
4. Configure a **redirect URI** for OAuth.
5. **Apply for the Content Posting API** and request the scopes
   **`video.upload`** and **`video.publish`** (Direct Post). This requires an
   **app audit/review** by TikTok, including a demo of your posting flow.
6. Authorize the brand account via OAuth to get an **access token + refresh
   token**.

**What you collect:** Client Key, Client Secret, access token, refresh token.

**In the app:** Admin → Integrations → the TikTok account → **Connect** → paste
the access token.

**Gotchas**
- "Direct Post" (auto-publish) vs "Upload to inbox" (user taps publish) are
  different scopes/flows — Direct Post has stricter review.
- Unaudited apps can only post to the creators who own the app (sandbox).

---

## 5. LinkedIn — LIVE

Connecting LinkedIn is a **one-click OAuth sign-in** — you don't paste tokens.
The app runs the OAuth flow, resolves your member identity, and stores the
access token for you.

**Steps**
1. Go to **https://developer.linkedin.com/** → **Create app**. Associate it
   with a **Company Page** you administer and verify the association.
2. Under **Products**, request/add:
   - **"Share on LinkedIn"** → gives the **`w_member_social`** scope (post to
     the member's feed). Usually granted instantly.
   - **"Sign In with LinkedIn using OpenID Connect"** → gives **`openid`** and
     **`profile`** so the app can read your member URN. Also self-serve/instant.
3. From the app's **Auth** tab, copy the **Client ID** and **Client Secret**,
   and set the **Authorized redirect URL** to **exactly**:

   ```
   https://<your-domain>/api/linkedin/callback
   ```

   (For this deployment: `https://sdc-beryl.vercel.app/api/linkedin/callback` —
   with **no** trailing characters. A stray `.` or `)` will break the flow.)
4. In the environment, set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`
   (Vercel → Project → Settings → Environment Variables), then redeploy.

**In the app:** Admin → Integrations → the LinkedIn account → **Connect with
LinkedIn** → approve on LinkedIn → you're returned connected. "Publish now"
then posts to the member's feed.

**Gotchas**
- The redirect URL must match the registered one **character-for-character**.
- Access tokens last ~2 months; reconnect (one click) when a post fails with an
  auth error. (Refresh tokens require extra LinkedIn approval.)
- By default this posts to the **signed-in member's feed** (`w_member_social`).

**Posting as a Company Page (organization)**

LinkedIn requires the **Community Management API** to be the **only product on
its app** — so Company-Page posting needs a **separate, dedicated LinkedIn
app** (you can't add it to the member app that already has "Share on LinkedIn"
+ "Sign In with OpenID Connect"). The app supports this; it's gated by env so
member-only posting keeps working until you switch.

1. **Create a new LinkedIn app** (developer.linkedin.com → Create app).
   Associate it with the **Company Page** you post from and **verify** it
   (Settings tab → verify, a Page admin approves — instant).
2. In that new app → **Products**, add **only** the **Community Management
   API** (Development Tier covers Pages you administer). It must be the sole
   product, or LinkedIn greys out the request.
3. Set the **Authorized redirect URL** to
   `https://<your-domain>/api/linkedin/callback` (same as before).
4. In the environment, point the LinkedIn vars at the **new** app and turn on
   org mode, then redeploy:
   - `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` → the new app's values
   - `LINKEDIN_ORG_POSTING=1`

   In org mode the connect flow requests `r_organization_admin` +
   `w_organization_social` (and skips OpenID — the CMA app identifies your
   Pages via the admin scope instead of a person URN).
5. Admin → Integrations → each event's LinkedIn account → **Connect with
   LinkedIn** → approve → the account defaults to a Page you admin, and the
   **Post as** dropdown lets you pick the exact Company Page for that event.
   "Publish now" then posts to the Page.

The chosen target is validated against LinkedIn on every change, so an account
can only ever post as a Page you actually administer. (Switching to org mode
replaces member-feed posting; keep the member app's credentials if you ever
want personal posting back.)

---

## Security notes

- **Never commit these tokens to the repo.** They belong in the app's
  encrypted-at-rest storage (the Integrations screen) and/or environment
  variables — never in source files.
- Store the **client secrets and refresh tokens** somewhere safe (a password
  manager); you'll need them when we wire the publishers.
- Rotate any credential that gets exposed.

## After you have the credentials — what's next

Once you've connected the accounts, the remaining work (a separate build) is a
**publisher per platform**: on the post's scheduled time, exchange/refresh the
token and call each platform's "create post/video" endpoint with the caption and
the correct per-platform media rendition. Tell the team when the API access is
approved and we'll wire that up.
