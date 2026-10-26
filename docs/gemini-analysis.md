# Gemini image analysis

Flow: app uploads photo (`POST /v1/uploads/sign`) -> `POST /v1/reports/analyze` -> Gemini -> rules -> saved in `ai_requests` -> app shows result -> `POST /v1/reports` with `analysis_id`.

Gemini returns: image description, is it a civic issue, category (from the DB list only), confidence, severity + reason, immediate-danger flag, recommended action.

Trust rules (`backend/src/modules/analysis/rules.ts`):
- Department always comes from the `categories` row of the chosen category, never from the model.
- Severity may differ from the category default by at most one level; immediate danger forces at least High.
- Confidence < 0.70, category `other`, or a non-civic photo -> manual review.
- Unknown category ids from the model -> `other` + manual review.
- If Gemini fails, times out, or no key is set -> `source: "fallback"`, manual review, report can still be submitted.
- The report is created from the server-stored analysis (`analysis_id`), so a client cannot forge severity. An analysis can be used once, only by its owner, and only if the category was not changed.

Setup: put `GEMINI_API_KEY` (from https://aistudio.google.com/apikey) in `backend/.env`, run `supabase db push`, restart the backend. Limit: `AI_ANALYSES_PER_HOUR` per user (default 10).
