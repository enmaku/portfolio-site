# Time Tracker client invoice page is a capability URL

The **client invoice page** is unauthenticated so a **client** can bookmark one link without a Firebase account. Access is a high-entropy secret unique to that **client** (a capability URL the **account owner** copies from **Clients**), not a guessable id and not a short spoken room code. Anyone with the link can see **invoices** and change **amount paid**; the **account owner** can regenerate the secret, which invalidates the old bookmark. The route is not **paste-unfurl eligible**—chat previews must not leak amounts.

**Considered:** requiring the **client** to sign in (stronger, kills send-a-link); sequential or short codes (easy to guess or brute-force).
