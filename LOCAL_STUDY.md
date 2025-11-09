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

Download the JSON files (or export the Google Sheet) and aggregate votes per
axis/attribute to fill the controllability and physical-realism table in your
paper. Each response entry already includes `questionId`, `axis`, and the
chosen option, making it straightforward to compute preference percentages.
