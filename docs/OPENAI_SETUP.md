# Put $5 on the OpenAI API (step by step)

> ChatGPT Plus and the API are **separate**. A ChatGPT subscription does not pay for API images.
> The API is **prepaid**: you buy credit first, the app spends it, and when it runs out requests stop. You cannot be surprised by a bill.

## 1. Open the API platform
1. Go to **platform.openai.com** and log in (a normal OpenAI login works).
2. Top-left, open the project menu → **Create project** → name it `97 Image Generator`.

## 2. Add payment details and buy the $5
1. Open **platform.openai.com/settings/organization/billing/overview**.
2. Click **Add payment details**, choose *Individual* (or Company), enter a **Visa / Mastercard** card, continue.
   - The card must allow **online / international USD** payments. If it is declined, call your bank or try a different card.
3. Choose the credit amount. **Minimum is $5** (the default shown is $10 — change it to 5).
4. **Turn OFF “Use auto-reload”.** It is on by default. Off = OpenAI can never charge you more than the $5 you bought.
5. Confirm. The balance can take a few minutes to appear.

Good to know: purchased credit **expires after 1 year** and is **non-refundable**. Local tax may be added at checkout.

## 3. Create the secret key
1. Left menu → **API keys** → **Create new secret key**.
2. Owned by: *You*. Project: **97 Image Generator**. Name: `97-image-generator-server`.
3. Permissions: choose **Restricted** and allow **Images** (and **Model capabilities** if shown, so “Enhance prompt” works) — or **All** if unsure.
4. Click create and **copy the key immediately** (starts with `sk-`). OpenAI never shows it again.
5. Paste it ONLY into your host’s **Variables** screen as `OPENAI_API_KEY`.
   Never put it in GitHub, WhatsApp, email or a chat.

## 4. If you see “organization must be verified” (403)
OpenAI sometimes gates the GPT Image models behind verification.
**Settings → Organization → General → Verify Organization** and follow the ID check, then wait a few minutes and press **Retry** in the app.

## 5. Set a safety limit (optional but smart)
- In the app: **Account → Spending controls** — the default is $5/month and it blocks any render that would pass it.
- At OpenAI: **Settings → Limits** — set a monthly budget / email alert if the page offers it.

## 6. How to see what you really have left
Always trust **platform.openai.com → Billing** for the live balance. The app’s “Tracked spend” is its own running total (it reads the token usage OpenAI returns after each image) — it is **not** your live balance.

## What $5 buys (rough, honest)
OpenAI charges image output at **$30 per 1M tokens** and does not publish a fixed per-image price for GPT-Image-2.6. The app shows an **estimate** before each render and corrects itself using the real usage from your first images. Rule of thumb: Draft/Standard quality is cheap, High is mid, **Max and 4K cost the most** — try Draft first, then render the winner at High/Max.
