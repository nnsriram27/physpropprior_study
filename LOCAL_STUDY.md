# Local User Study Workflow

This repository now supports running the 2AFC survey with friends/family
without Mechanical Turk. Use these steps to capture participant info and store
their voting data for later analysis.

## Launching the survey

1. Host the repo (e.g., GitHub Pages) as usual.
2. Share the link without any MTurk query parameters
   (the page automatically enters **local** mode), or append
   `?submissionMode=local&questionSet=control_fidelity_questions`
   to choose a specific dataset.
3. Each participant is asked for a display name/email before answering.

## Pre-sampling question packs

1. Confirm the field map in `config/table_fields.json` matches the table cells you
   plan to report. Each entry specifies the method, attribute, axis, dataset, and
   number of questions that should be asked per participant.
2. Generate packs (two questions per field by default):

```bash
python src/sample_question_packs.py --count 5 --prefix friend
```

This writes JSON files such as `data/packs/friend_01.json`. Share the survey
link with `?questionSet=packs/friend_01` so each friend receives their assigned
set of questions. (If you prefer a custom mix, pass `--participants alice bob`.)

## Saving responses

After the participant answers every question they can:

* **Download JSON** – creates a `responses_<name>.json` file containing:
  - participant metadata
  - question set identifier
  - timestamps and selections
* **Send to Organizer** – optional POST upload if you provide an endpoint via
  `responseEndpoint` query param, e.g.  
  `...?responseEndpoint=https://script.google.com/macros/s/AKfycb.../exec`.

### Example Google Sheets endpoint

1. Create a new Google Sheet and open **Extensions → Apps Script**.
2. Paste the following script and deploy as a Web App (execute as yourself,
   allow access to anyone with the link):

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Responses') ||
                SpreadsheetApp.getActiveSpreadsheet().insertSheet('Responses');
  const payload = JSON.parse(e.postData.contents);
  const row = [
    new Date(),
    payload.participant?.name || '',
    payload.participant?.email || '',
    payload.questionSet,
    JSON.stringify(payload.responses),
  ];
  sheet.appendRow(row);
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}
```

3. Copy the deployed URL and pass it as `responseEndpoint` in the survey link.

## Aggregating metrics

1. Gather downloaded response files (or export the Google Sheet to JSON) into a
   single folder, e.g., `responses/`.
2. Run the metric script, which understands the `fieldId` metadata embedded in
   each sampled question:

```bash
python src/compute_metrics.py --responses responses --output metrics.json
```

3. The script prints field-level accuracy/preference percentages, plus a
   summarized `controllability` vs. `physical_realism` table keyed by method and
   attribute. Use those percentages to populate Table 1 (values > 50% indicate a
   preference for the ControlNet variant).

If you add or remove table cells, update `config/table_fields.json` before
sampling packs so the aggregator knows how to bucket responses.
