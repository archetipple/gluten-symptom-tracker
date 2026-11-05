# Celiac Tracker

A food and symptom diary for someone with celiac disease. Web app first, installable
on an iPhone home screen, works offline. Built from the reusable parts of
`fitness-tracker` (app shell, on-device storage, cloud sync, account screen, barcode
scanning and Open Food Facts lookup).

It is a personal diary, not medical advice.

## What it does

- **Today**: quick buttons for food, symptoms and bowel movements; the day's log in
  time order; a daily check-in (sleep hours and quality, stress, period); a meds and
  supplements checklist. Arrows step back to fill in earlier days.
- **Food log**: meals with time, foods, where you ate (home, restaurant, takeout,
  someone else's home...), the place, and cross-contact worries (shared toaster or
  fryer, unsure ingredients...). Each meal gets a **gluten risk**: low, unsure, possible
  exposure, or contained gluten, with the reasons shown.
- **Gluten checks**: scan a barcode (or search) and the app reads Open Food Facts'
  allergens, "may contain" traces, labels and ingredients. Anything listing gluten,
  wheat, barley, rye, malt, spelt and so on counts as gluten, even if also labelled
  gluten-free; "may contain" and oats without a gluten-free label count as caution.
  The verdict opens for checking before it's saved, because the data is crowd-sourced.
- **My foods**: your safe, caution and avoid lists, with favourites and notes.
- **Symptoms**: grouped into collapsible body areas (abdominal; brain and head, covering
  physical, thinking and mood; skin; whole body). Tap a symptom and rate it 1 to 10, then
  optionally say where (a 9-region abdomen map, head areas, body parts, left or right),
  what the pain feels like (achy, dull, sharp, stabbing, throbbing, pulling...), how often
  (constant, comes and goes, in waves, once) and how long. Each entry lists what was
  eaten in the hours before. Each area's list is editable in Settings, and anything typed
  under "Something else" is added to it.
- **Bowel movements**: Bristol scale 1 to 7, urgency, and a blood flag with a prompt to
  tell a doctor.
- **Meds and supplements**: daily items as a checklist, as-needed items with a
  "took one" button, and a dose history.
- **Places**: restaurants and others rated 1 to 5 for how safe they feel, plus
  gluten-free kitchen, GF menu, dedicated fryer and separate prep. Meals at a place
  rated 4 or 5 (or a fully gluten-free kitchen) count as lower risk.
- **Patterns**: over 30 days, 90 days or a year, with a 12, 24, 48 or 72 hour window:
  - a daily chart of the worst symptom, with each day's riskiest meal underneath
  - how often meals at each risk level were followed by symptoms
  - foods (eaten 3 or more times) and places ranked by how often symptoms followed,
    with rows well above the usual rate highlighted
  - poor sleep, high stress and period days compared with other days
  - the most common symptoms
  Meals whose window hasn't finished yet are left out. Patterns show what happened
  together, not what caused it.
- **Account and sync, backup and restore** as in the fitness app.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (gluten checks, patterns, sync)
npm run build      # type-check and production build into dist/
```

## Deploying (Cloudflare Pages)

1. Cloudflare dashboard > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Pick `celiac-tracker`, then **Begin setup**.
3. Build settings: production branch `main`, build command `npm run build`, output
   directory `dist`, environment variable `NODE_VERSION` = `22`.
4. **Save and Deploy**. On iPhone: open the site in Safari > Share > **Add to Home Screen**.

## Cloud sync (Supabase)

Use a **new Supabase project** for this app, separate from the fitness tracker, so this
person's health data lives in its own account.

1. Create a free project at supabase.com.
2. **SQL Editor > New query**: paste `supabase/schema.sql` and run it.
3. **Authentication > Sign In / Providers > Email**: turn off **Confirm email**.
4. **Project Settings > API**: copy the project URL and the anon / publishable key.
5. Cloudflare Pages > the project > **Settings > Variables and secrets**: add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
6. On their phone: Settings (gear on Today) > Account and sync > **Create account**,
   using their own email and password.
7. Then turn off new sign-ups in Supabase (Authentication > Sign In / Providers >
   "Allow new users to sign up").

Row level security limits every account to its own rows. As the Supabase project owner
you can still see the data in the Supabase dashboard; if that matters, they can create
the Supabase project themselves and give you only the two keys.

## Ideas for next

- A printable summary for a GI doctor or dietitian
- Saved meals and recipes
- Reminders for daily meds
