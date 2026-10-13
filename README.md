# CareerPilot

CareerPilot is a local-first job-search organizer with optional OpenAI-powered cover-letter drafts. It saves applicant details and job applications in your browser, links to public job searches, and keeps final review and portal submission in your hands.

## Run it

1. Install Node.js 20 or later.
2. In this folder, run `node server.js`.
3. Open `http://127.0.0.1:3000` in your browser.
4. In the Applicant profile section, enter your OpenAI API key and select **Save for this session**.
5. Add an opportunity, choose **Prepare draft**, then select **Generate with OpenAI**.

The key stays in the running local server's memory and is cleared when you stop that server or select **Clear key**. It is not saved to browser storage or a file. Alternatively, set `OPENAI_API_KEY` in the environment before starting the server. Do not commit API keys.

Run the server checks with `node --test server.test.js`.

## What it does

- Saves your profile and job pipeline in this browser's local storage.
- Opens searches on Google Jobs, Indeed, and LinkedIn.
- Lets you add job details and a posting URL to your pipeline.
- Generates editable, role-specific cover letters using OpenAI's `gpt-4.1-mini` model, or offers a local template when AI is not configured.
- Tracks saved, drafting, ready-to-apply, and applied roles.

## Privacy and limitations

AI generation is optional. When you explicitly request a draft, CareerPilot sends your name, professional summary, skills, experience highlights, and the job title, company, and description to OpenAI. Email and phone are not sent. The request asks OpenAI not to store the response, but OpenAI's service and data policies still apply; API usage may incur charges. Review those policies and your account settings before use.

The server binds to `127.0.0.1` and does not expose an API-key read endpoint. Applicant and job data remains in browser local storage unless you choose AI generation. Anyone with access to this browser profile or local machine may be able to access that data or the running local server. Job-board searches open third-party websites with their own privacy policies.

CareerPilot does not access company career portals, store portal passwords, fill application forms, or submit applications. AI output can be wrong: verify every claim and edit the draft before using it on a company portal.
