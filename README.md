# Markup

Pin-and-comment reviews for client websites. Add a client's page (a live website address or a
screenshot), send them a private review link, and they click anywhere on the page to drop a
numbered pin with a comment. You reply, resolve and delete comments from your own view.

- **You** sign in with email and password and see only your own projects.
- **Clients** don't need an account. Anyone with a project's review link can view it and comment.
  They can't resolve or delete anything, and they can't see your other projects.

Built with Next.js, Supabase (database, login and screenshot storage) and Vercel (hosting).

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the whole of [`schema.sql`](schema.sql) and click **Run**.
   It creates the tables, the access rules and a `screenshots` storage bucket. It's safe to run
   again.
3. Under **Authentication → Sign In / Providers → Email**, turn **Confirm email** off so you can
   sign in straight after creating your account. (If you leave it on, Supabase emails you a
   confirmation link first. Set **Authentication → URL Configuration → Site URL** to your app's
   address so that link works.)
4. Copy your **Project URL** and **anon** (or **publishable**) key from the **Connect** button or
   **Project Settings → API Keys**.

### 2. Settings

Copy `.env.example` to `.env.local` and fill in the two values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

`.env.local` is ignored by git, so it is never uploaded to GitHub. The anon key is designed to be
visible to browsers. The access rules in `schema.sql` are what keep your data private.
**Never** use the `service_role` / secret key here.

### 3. Run it on your computer

Requires [Node.js](https://nodejs.org) 20.9 or newer.

```
npm install
npm run dev
```

Open http://localhost:3000, create your account, and you're in.

### 4. Put it on Vercel

1. In [Vercel](https://vercel.com), **Add New → Project** and import this GitHub repository.
2. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the same values as `.env.local`.
3. Click **Deploy**.

### 5. Lock down sign-ups

Once you've created your own account, turn off **Allow new users to sign up** in Supabase under
**Authentication → Sign In / Providers**. Otherwise anyone who finds your Markup address could
create an account. They still couldn't see your projects, but they would use up your free
Supabase allowance.

## Using it

- **New project:** give it a name and either a website address or a screenshot.
- **Commenting: on/off:** when on, clicking the page drops a pin. Turn it off to scroll and
  click through the site normally.
- **Client review link:** copy it from the project's sidebar and send it to your client.
- **Page height:** website projects are shown 1280 px wide and 3000 px tall by default. Change the
  height under **Page settings** if the page is longer or shorter.
- **Blank page?** Many sites block being shown inside other apps. Upload a full-page screenshot
  instead (**Page settings → Use a screenshot instead**).
- New comments show up automatically every 15 seconds.

## Files

| Path | What it is |
| --- | --- |
| `schema.sql` | Database tables, access rules and storage bucket. Run once in Supabase. |
| `app/page.js` | Sign-in screen and your project list. |
| `app/p/[id]/page.js` | Your view of a project: comment, reply, resolve, delete, share. |
| `app/r/[token]/page.js` | The client review page behind the share link. |
| `components/Board.js` | The page-with-pins view and comment sidebar shared by both. |
| `lib/supabase.js` | Connects to Supabase using the two settings above. |
