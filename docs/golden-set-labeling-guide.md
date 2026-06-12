# ListGem — Entity Pair Labeling Guide

Thanks for helping! This is a ~1 hour task. You don't need to know anything about
ListGem beforehand — everything you need is below. Read the short background, then
follow the steps.

---

## The 30-second background

**ListGem** is a catalog of "things" — books, movies, albums, video games, etc.

Sometimes the *same* real-world item ends up saved in the catalog **more than once**.
For example:
- The **hardcover** and the **paperback** of the same novel get saved as two separate entries.
- The same book gets pulled in from **two different websites** (say Amazon and Goodreads) and saved twice.

We're teaching the system to recognize when two entries are "the same." To do that,
we need a **human answer key**: a few hundred examples where a person looked at two
entries and said how they relate. **You are creating that answer key.**

A couple of words you'll see:
- **Work** = the creative work itself (e.g., the novel *Dune*).
- **Edition** = a specific version of it (the 1965 paperback, the 2019 deluxe hardcover, the audiobook).

So one *Work* ("Dune") can have many *Editions*.

---

## What you'll actually do

You'll see **two catalog entries side by side** ("left" and "right"). For each pair,
you pick **one of four buttons** that describes how they relate, and the next pair
loads automatically. That's the whole loop. Aim for **~100+ pairs**.

---

## Step 1 — Log in

1. Open: **https://listgem-admin.netlify.app/labeling**
2. Sign in with the email and password **Tim will give you separately.**
3. In the left sidebar, under **Registry**, click **Golden-Set Labeling** (you may already be there).

✅ **Check you're in the right place:** near the top you should see a blue bar that says
**"Live feed — 156 candidate pairs."**
❌ If it says **"Seeded sample"** instead, you're not fully logged in — refresh the page
and sign in again. (Seeded-sample data is fake practice data and won't be saved.)

---

## Step 2 — Understand the screen

For each pair you'll see:
- **Two cards, side by side** — the left entry and the right entry. Each shows the
  title, the author/creator, the type (Book, Movie, etc.), the year, where it came from
  (a clickable source link), any ID numbers (like an ISBN), and a small quality bar.
- **Four buttons** underneath: *Same Work*, *Same Edition*, *Different*, *Not a match*.
- A **progress bar** at the top showing how many you've done.

Tip: the source links (e.g. "amazon ↗") open the original page in a new tab if you need
a closer look — but usually the card has enough to decide.

---

## Step 3 — Pick the right answer (the important part)

There are four buttons. Below is what each one means, with several worked examples.
Read this section carefully once — after that it becomes quick.

First, a 10-second mental model:
- **Same Edition** and **Same Work** both mean *"these two are the same item"* (just at
  different levels of "sameness").
- **Different** and **Not a match** both mean *"these two are NOT the same item."*

So your first question is always: **are these the same item, or not?** Then pick the
specific button.

---

### 🟢 Same Edition — *the exact same version, listed twice* (key `2`)

The two cards are the **identical version** of the item — same format, same release —
usually because it was pulled in from two different websites.

**The giveaway:** matching **ISBN / ASIN / ID number**, same year, same format.

| Left card | Right card | Why |
|---|---|---|
| *Dune* — paperback, 2021, ISBN **9780441013593**, from Amazon | *Dune* — paperback, 2021, ISBN **9780441013593**, from Goodreads | Identical ISBN → same exact edition, just two listings |
| *The Matrix* — film, 1999, from TMDB | *The Matrix* — film, 1999, from IMDb | Same movie, same year, two sources |
| *Abbey Road (2009 Remaster)* — album, from Spotify | *Abbey Road (2009 Remaster)* — album, from Apple Music | Same specific remaster |

---

### 🔵 Same Work — *same creative work, but a different version* (key `1`)

The two cards are the **same underlying work**, but **different editions / formats** —
different printing, cover, translation, or medium (e.g. print vs audiobook).

**The giveaway:** same title + same author/creator, but the **format, year, or ID differs**.

| Left card | Right card | Why |
|---|---|---|
| *Dune* — paperback, 1965 | *Dune* — deluxe hardcover, 2019 | Same novel, different printing/edition |
| *Sapiens* — book | *Sapiens* — audiobook | Same work, different medium |
| *Crime and Punishment* (Garnett translation) | *Crime and Punishment* (Pevear & Volokhonsky translation) | Same novel, different translation |
| *The Hobbit* — standard edition | *The Hobbit* — illustrated edition | Same book, different edition |

---

### ⚪ Different — *two real but distinct items* (key `3`)

Both cards are **legitimate, valid entries** — they're just **not the same thing.**

**Watch out:** a sequel, or another book in the same series, is a **Different** work —
not "Same Work." Same author or same universe does **not** make them the same.

| Left card | Right card | Why |
|---|---|---|
| *Dune* | *Dune Messiah* | A sequel — different work (this trips people up!) |
| *Harry Potter and the Sorcerer's Stone* | *Harry Potter and the Chamber of Secrets* | Different books in the same series |
| *The Hobbit* | *The Lord of the Rings* | Same author/world, different works |
| *Dune* (novel) | *Dune* (2021 film) | Same title, but a book and a movie are different items |
| *The Pragmatic Programmer* | *Educated* | Completely unrelated |

---

### 🔴 Not a match — *the pair is broken or can't be judged* (key `4`)

Use this when **at least one card is bad data** — so it's not a fair "same vs different"
comparison at all. It's the "this is garbage / nonsense" bucket.

| Left card | Right card | Why |
|---|---|---|
| *Dune* | **(blank title)** / `B08XYZ1234` as the title | One side never got a real title — junk |
| *The Hobbit* | *"Page Not Found"* / garbled gibberish text | One side is a broken/error entry |
| *Inception (Original Soundtrack)* — labeled **Book** | *The Dark Knight* — Movie | Grossly mis-categorized; not a meaningful pairing |

**Different vs Not a match, simply:**
- **Different** = both entries are *fine*, they're just not the same → key `3`
- **Not a match** = one entry is *broken / blank / nonsense*, so you can't really compare → key `4`

(For scoring, both mean "these shouldn't be merged" — so if you're torn between `3` and
`4`, it's not a big deal. The distinction just helps us spot bad data.)

---

> ### ⚡ Quick rule of thumb
> | If… | Pick | Key |
> |---|---|---|
> | Same item, **exact same version** (matching ISBN/ID) | **Same Edition** | `2` |
> | Same item, **different version** (format/printing/translation) | **Same Work** | `1` |
> | **Different** items, both valid (incl. sequels & adaptations) | **Different** | `3` |
> | One side is **broken / blank / mislabeled** | **Not a match** | `4` |

**If you genuinely can't decide, don't guess — press the right-arrow key (→) to Skip it**
and move on. A skipped pair is fine; a wrong label hurts the answer key.

---

## Step 4 — The "type" check (optional, quick)

Each card also has a small button at the bottom like **"Left type: ✓ Book correct."**
This is asking: *is the category (Book / Movie / Album / etc.) correct for this entry?*

- If the type is right, **leave it** (it defaults to ✓).
- If the type is **wrong** (e.g. it says "Book" but it's clearly a box set or a soundtrack),
  click that button to flip it to **✗ wrong**.

You only need to touch this when something's obviously mis-categorized. Don't overthink it.

---

## Keyboard shortcuts (much faster than clicking)

| Key | Does |
|----|------|
| **1** | Same Work |
| **2** | Same Edition |
| **3** | Different |
| **4** | Not a match |
| **→** | Skip this pair |
| **←** | Go back to the previous pair |
| **t** | Flip the LEFT card's type ✓/✗ |
| **y** | Flip the RIGHT card's type ✓/✗ |

Pressing **1–4 records your answer and moves to the next pair automatically.**

---

## How many, and what mix

- **Goal: at least ~100 pairs.** More is welcome, but **variety matters more than quantity.**
- Near the top there are **filter chips**: *fragmentation cluster*, *near-duplicate*,
  *random sample*. Click them to focus on one kind at a time. **Please do a mix of all
  three** — don't just grind through the first batch. The "random sample" ones (often
  "Different") and the near-duplicates are especially valuable.

---

## Making sure your work is saved

- Every answer is **saved automatically** to the server as you go.
- Watch the green **"N saved"** counter near the progress bar — that number going up is
  your confirmation it's being recorded. You don't need to "submit" anything.
- If you ever see a red **"failed"** note, click the **"Retry failed"** button that appears.
- You can close the tab whenever — your saved answers stay saved.

---

## You're done when…

You've labeled **~100+ pairs with a good mix of types**. That's it — just let Tim know.
There's nothing to submit or export; everything you clicked is already saved.

---

## Quick FAQ

**I'm not sure about a pair.** Skip it (press →). Never guess.

**The two look identical but I can't find an ISBN to compare.** If they're clearly the
same version (same title, author, year, format), **Same Edition** is fine. If you can
only tell they're the same book but the versions differ, use **Same Work**.

**One card looks broken / blank / gibberish.** That's a **Not a match** (and if its type
is wrong, flip the type toggle too).

**I clicked the wrong button.** Press **←** to go back; re-labeling overwrites the old answer.

**It logged me out / shows "Seeded sample."** Refresh and sign in again, then continue —
your earlier saved answers are safe.
