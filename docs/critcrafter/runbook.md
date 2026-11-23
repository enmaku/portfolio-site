# CritCrafter function operations runbook

Operating the rules corpus and the `critcrafterSheet` function. Decisions are in [SPEC.md](SPEC.md) (Corpus, Function boundary, Ops and tests); this file is the procedure.

Firebase project: `enmaku-portfolio-site` (`.firebaserc`). Region `us-central1`. Firestore emulator port `8080`, Functions emulator port `5001` (`firebase.json`).

> **Status:** the ingest script, its flags and the log field names below are the interface the implementation tickets must build to (tickets 2 and 4). Where this runbook and the code disagree after those tickets land, fix whichever is wrong and keep them in step.

## What the ingest does

A manually run Node script, `scripts/critcrafter-ingest.mjs`, reads a local clone of `foundryvtt/pf2e` at a **pinned SHA** (`packs/pf2e/` only) and writes the `rulesEntries` collection and `rulesMeta/current` with the Admin SDK.

- Every run upserts every entry, then deletes documents not seen in that run, so the corpus **mirrors the pinned SHA exactly**. Re-running the same SHA is safe (idempotent).
- Aliases are built at ingest from AoN `legacy_id`/`remaster_id` pairs (same category, distinct names; fetched server-side from `elasticsearch.aonprd.com`, politely, once per run) plus the committed Pathbuilder label table (`functions/critcrafter/` or `scripts/` JSON, wherever ticket 2 puts it).
- `rulesMeta/current` (`{sha, ingestedAt, counts}`) is written **last**. A half-finished run therefore leaves a visibly stale `rulesMeta`.
- It is not a deployed function, not in CI and not scheduled.

### Flags

| Flag | Meaning |
| --- | --- |
| *(none)* | **Dry run.** Prints per-type counts and the diff against `rulesMeta/current` (added, changed, deleted). Writes nothing. |
| `--apply` | Write. |
| `--force` | With `--apply`, bypass the guard below. |
| `--packs <dir>` | Path to the local `foundryvtt/pf2e` clone (`packs/pf2e/` inside it). |
| `--sha <sha>` | The commit that clone must be at; the script refuses to run if `HEAD` differs. |

**Guard:** `--apply` refuses if more than 10% of existing documents would be deleted, or the total count drops by more than 10%, unless `--force`.

### Pointing at an environment

- **Emulator:** `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` (the Admin SDK honours it; nothing reaches production).
- **Production:** unset that variable and use Application Default Credentials for `enmaku-portfolio-site` (`gcloud auth application-default login`, or a service account key outside the repo). Check the script's banner, which prints the target project or "EMULATOR", before passing `--apply`.

## When to run

On demand only. Triggers:

1. You want newer Foundry content.
2. Name-drift clusters show up in the `warnings[]` code counts (saved query 2 below), for example many `name_unmatched` for names that have a remaster rename.
3. **The first production ingest is the v1 launch gate** (ticket 9 cannot close without it).

Record the SHA you ran in the table at the bottom of this file.

## Procedure: ingest

1. **Clone and pin.**
   ```bash
   git clone --filter=blob:none --sparse https://github.com/foundryvtt/pf2e.git ~/code/foundry-pf2e   # first time only
   cd ~/code/foundry-pf2e && git sparse-checkout set packs/pf2e
   git fetch origin && git checkout <sha>
   ```
   Use a full 40-character SHA. Never track a branch.
2. **Emulator rehearsal.** In one terminal: `firebase emulators:start --only firestore`. In another:
   ```bash
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/critcrafter-ingest.mjs --packs ~/code/foundry-pf2e --sha <sha>            # dry run
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/critcrafter-ingest.mjs --packs ~/code/foundry-pf2e --sha <sha> --apply    # write
   ```
   Check the per-type counts look sane (order of magnitude: about 6.5k feats, 6k equipment, 2k spells, 590 actions, 880 class features, 360 heritages, 550 backgrounds; about 20k documents in all) and that the guard did not trip.
3. **Verify against fixtures on the emulator.** Run the function tests and the fixtures regenerate script with the emulator corpus. Per-fixture warning counts must not rise compared with the previous SHA (the first ingest sets the baseline: write the counts into the table below).
4. **Production dry run.** Unset `FIRESTORE_EMULATOR_HOST`; run the same command without `--apply`. Read the diff: added, changed, deleted. A large delete count with a small SHA gap means something is wrong.
5. **Production apply.** Same command with `--apply`. If the guard trips and you have read the diff and agree with it, repeat with `--force`.
6. **Confirm.** Read `rulesMeta/current` in the Firebase console (Firestore, production): `sha` equals what you pinned, `counts` match the dry-run output.
7. **Regression check.** Run saved query 2 (below) for the new corpus SHA after loading each fixture character through the viewer once; warnings per fixture must not exceed those under the previous SHA. If they do, roll back (next section) and investigate.
8. **Log it** in the table at the bottom.

Interrupted run: `rulesMeta/current` still names the old SHA, so the corpus is visibly stale rather than silently mixed. Re-run the same command; upserts are idempotent.

## Procedure: rollback

There is no Firestore export, backup job or staging project. Rollback is **re-running the ingest at the previous pinned SHA**; mirror semantics make the result exact (entries added since are deleted, changed entries restored).

1. Look up the previous SHA in the table at the bottom (also the prior value of `rulesMeta/current.sha`).
2. `git -C ~/code/foundry-pf2e checkout <previous-sha>`.
3. Dry run, then `--apply` against production, exactly as in the ingest procedure. The delete guard may trip if the bad ingest added more than 10% new documents; confirm the diff and use `--force`.
4. Confirm `rulesMeta/current.sha`, then rerun the regression check.

The function holds a warm-instance in-memory cache of corpus entries, cleared when an instance recycles. After a rollback, a stale warm instance can serve old text for a short while; this resolves on its own as instances recycle. To force it, redeploy the function: `firebase deploy --only functions:critcrafterSheet`.

## Procedure: function deploy and App Check

- Deploy: `firebase deploy --only functions:critcrafterSheet` (and `--only firestore:rules` for the deny-all `rulesEntries` and `rulesMeta` rules).
- App Check: enforced on the function with a reCAPTCHA key registered in the Firebase console for the production site origin; registering the key is a launch ship-blocker. Other projects calling this endpoint must register their own App Check app.
- Ceiling on cost and abuse: App Check plus `maxInstances` (about 10). There is no per-IP rate limit and no billing budget or alert in v1 (owner decision). Revisit if Firebase usage in the console ever looks unusual.
- Cost reference: an ingest is about 20k writes and 20k reads, cents. Normal viewer use is expected to be insignificant.

## Monitoring

Monitoring is the function's structured logs plus two saved queries in Logs Explorer (Google Cloud console, project `enmaku-portfolio-site`). There are no dashboards or alert policies.

The function writes one structured entry per request, with **only** these fields, never the body, names, item names, `warnings[].detail` or the Pathbuilder id:

```json
{
  "message": "critcrafter.sheet",
  "requestId": "…",
  "requestBytes": 48211,
  "responseBytes": 61890,
  "durationMs": 740,
  "corpusSha": "<40-char foundry sha>",
  "warningCounts": { "name_unmatched": 6, "breakdown_residual": 1 },
  "errorCode": null
}
```

Failures log `message: "critcrafter.error"` at severity `ERROR` with `errorCode` set to the stable error code (`internal`, `invalid_build`, …).

### Saved query 1: server errors

Name it `critcrafter-errors`. Anything the function failed on that was not the caller's fault:

```
resource.type="cloud_run_revision"
resource.labels.service_name="critcrafterSheet"
(severity>=ERROR OR jsonPayload.errorCode="internal" OR httpRequest.status>=500)
```

Expect a few rare cold-start or timeout entries; a run of `internal` after a deploy or an ingest means roll back.

> Service names for 2nd-gen functions are the lower-cased function name in some projects. If the query returns nothing, open any log entry of the function once and copy its exact `resource.labels.service_name`.

### Saved query 2: warnings by corpus SHA

Name it `critcrafter-warnings`. Shows every successful request that produced warnings, with the corpus it ran against:

```
resource.type="cloud_run_revision"
resource.labels.service_name="critcrafterSheet"
jsonPayload.message="critcrafter.sheet"
jsonPayload.warningCounts:*
```

To count a code per corpus SHA, add a field filter (for example `AND jsonPayload.warningCounts.name_unmatched>0`) and compare the number of hits for `jsonPayload.corpusSha="<old>"` against `jsonPayload.corpusSha="<new>"` over the same fixture loads. If Log Analytics is enabled on the `_Default` bucket (a one-time upgrade in the console, optional), the same grouping is one query:

```sql
SELECT JSON_VALUE(json_payload.corpusSha) AS corpus_sha,
       COUNT(*) AS requests,
       SUM(CAST(JSON_VALUE(json_payload.warningCounts.name_unmatched) AS INT64)) AS name_unmatched
FROM `enmaku-portfolio-site.global._Default._AllLogs`
WHERE JSON_VALUE(json_payload.message) = 'critcrafter.sheet'
GROUP BY corpus_sha
ORDER BY MAX(timestamp) DESC
```

Use this query after every ingest (procedure step 7). A rise in per-fixture warnings against the previous SHA is a regression.

Firebase request logs keep default retention.

## Ingest log

Keep one row per production ingest; the previous row is the rollback target.

| Date | Foundry pf2e SHA | Counts (feat / spell / action / classFeature / heritage / background / equipment) | Fixture warnings | Notes |
| --- | --- | --- | --- | --- |
| *(first production ingest pending; launch gate)* | | | | |
