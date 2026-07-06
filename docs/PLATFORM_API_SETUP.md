# Connecting the social platforms — API setup guide

This guide explains how to obtain API access for each platform the app
supports, so an account can eventually **publish** from Sunaidi Design Central.

> **Read this first — current status.** The app's **Admin → Integrations**
> screen lets you store an API key/token per account, but **publishing is not
> wired up yet** — scheduling saves a post to the calendar; it does **not** send
> it to the platform. Turning these credentials into real posts is a separate
> implementation step (one publisher per platform). This document is the
> prerequisite: get the credentials first, then we wire the publishers.
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
7. **Submit for App Review** requesting the permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   You'll also need **Business Verification** for the Meta business.

**What you collect:** App ID, App Secret, long-lived Page access token,
Instagram Business Account ID.

**In the app:** Admin → Integrations → the Instagram account → **Connect** →
paste the access token. (The other IDs are stored for the publisher step.)

**Gotchas**
- Personal IG accounts cannot use content publishing — must be Business/Creator.
- Page access tokens expire; you'll refresh them (~60 days for long-lived).
- Review can take several days and requires a clear use-case + screencast.

---

## 2. Facebook Pages (via Meta Graph API)

Facebook uses the **same Meta app** you created for Instagram.

**Steps**
1. In the same app, add the **Facebook Login** product (if not already).
2. Add the permissions **`pages_manage_posts`**, **`pages_read_engagement`**,
   and **`pages_show_list`**.
3. Generate a **long-lived Page access token** for the Page you'll post to
   (Graph API Explorer → select the Page → generate token → exchange for
   long-lived).
4. Note the **Page ID** (Page → About, or `/me/accounts`).
5. **Submit for App Review** for the `pages_manage_posts` permission.

**What you collect:** App ID, App Secret, Page access token, Page ID.

**In the app:** Admin → Integrations → the Facebook account → **Connect** →
paste the Page access token.

---

## 3. X / Twitter (API v2)

**Prerequisites**
- An X account for the brand.
- A card on file may be required depending on the access tier.

**Steps**
1. Go to **https://developer.x.com/** → **Sign up** for a developer account
   (answer the use-case questions honestly — automated posting for your events).
2. In the **Developer Portal**, create a **Project**, then an **App** inside it.
3. From the app's **Keys and tokens**, copy:
   - **API Key** and **API Key Secret**
   - **Bearer Token**
   - Under **User authentication settings**, enable **OAuth 2.0**, set the
     app to **Read and write**, and copy the **Client ID** and **Client Secret**.
4. Set a **callback / redirect URL** (your app's domain) for OAuth 2.0.
5. Authorize the brand account via OAuth 2.0 with scopes
   **`tweet.read tweet.write users.read offline.access`** to get a user
   **access token + refresh token**.

**What you collect:** API Key/Secret, Client ID/Secret, access token, refresh
token.

**In the app:** Admin → Integrations → the X account → **Connect** → paste the
access token.

**Gotchas / cost**
- X has tiers: **Free** (very limited posting), **Basic** and **Pro** (paid,
  higher limits). Check current limits/pricing — posting volume may require a
  paid tier.
- `offline.access` is required to get a refresh token (tokens are short-lived).

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

## 5. LinkedIn

**Prerequisites**
- A **LinkedIn Company Page** for the brand (to post as the organization) and an
  admin of that Page.

**Steps**
1. Go to **https://developer.linkedin.com/** → **Create app**. Associate it
   with your **Company Page** and verify the association.
2. From the app's **Auth** tab, copy the **Client ID** and **Client Secret**,
   and set the **Authorized redirect URL**.
3. Under **Products**, request access to **"Share on LinkedIn"** and, for
   posting as the company, the **"Community Management API"** (a.k.a. Marketing
   Developer Platform). These require approval.
4. Scopes you'll request: **`w_member_social`** (post as a person) and/or the
   organization posting scopes (`w_organization_social`) for Page posts.
5. Run the OAuth 2.0 flow to get an **access token**. Note the **Person URN**
   (`/me`) or **Organization URN** you'll post as.

**What you collect:** Client ID, Client Secret, access token, Person/Org URN.

**In the app:** Admin → Integrations → the LinkedIn account → **Connect** →
paste the access token.

**Gotchas**
- LinkedIn tokens are typically ~60 days; you'll refresh.
- Organization posting requires the Community Management API approval, which is
  stricter than personal sharing.

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
