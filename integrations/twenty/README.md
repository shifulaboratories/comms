# Comms for Twenty CRM

A [Twenty](https://twenty.com) app that brings your shared iMessage inbox into your CRM.

- **iMessage tab on every person.** It shows their thread from Comms, live. Your teammates' replies and internal notes are included, and you can reply from the same box. A message sent from Twenty goes out through Comms like any other reply: it's signed, checked against STOP opt-outs and held for the undo window.
- **"Last iMessage" fields.** Each person gets *Last iMessage*, *Last iMessage text* and *Comms conversation*. They update the moment a message arrives or goes out, so you can sort and filter people by who you've been texting.
- **Matching by phone number or email.** A person in Twenty is matched to a Comms contact when any of their numbers shares its last ten digits with the contact's, or an email address matches exactly. `+1 (415) 555-0177` and `4155550177` count as the same number.

Verification-code threads and internal notes never leave Comms through this app.

## How it fits together

```
Twenty  ── iMessage tab ──▶  /s/comms/thread, /s/comms/send  ──▶  Comms REST API (/api/v1)
   ▲                                                               │
   └──── /s/comms/webhook ◀── signed webhook on every message ─────┘
```

The Comms API key and webhook secret are stored as encrypted app variables in Twenty. They are only ever read on the server, by the logic functions. The front component calls the app's own routes, so the key never reaches the browser.

## Install

You need Twenty **2.45 or later** and a Comms workspace that your Twenty server can reach over HTTPS.

1. **Deploy the app to your Twenty server.** You need Node 24.5+ and Yarn 4 (`corepack enable`):

   ```bash
   cd integrations/twenty
   yarn install
   yarn twenty remote:add --url https://crm.example.com --as production
   yarn twenty app:publish --private --remote production
   ```

   Then install it from **Settings → Applications** in Twenty. You can also use `yarn twenty app:install --remote production`.

2. **Connect Twenty in Comms.** As a workspace admin, go to **Settings → Integrations → Twenty CRM → Connect** and enter your Twenty address. Comms creates:
   - an API key with read and write access, for the app to call Comms;
   - a webhook to `https://<your-twenty>/s/comms/webhook` for new messages.

3. **Paste the three values** Comms shows you into **Settings → Applications → Comms → Variables** in Twenty:

   | Variable | Value |
   |---|---|
   | `COMMS_URL` | Your Comms address, e.g. `https://comms.example.com` |
   | `COMMS_API_KEY` | The `cms_…` key |
   | `COMMS_WEBHOOK_SECRET` | The `whsec_…` secret |

   The app's health check runs when you open its settings page. It confirms that the URL works and that the key can send.

4. Open any person in Twenty and pick the **iMessage** tab.

Connecting again from Comms revokes the old key and replaces the webhook, so you can always start over cleanly.

## Develop

```bash
yarn install
yarn twenty docker:start   # local Twenty on :2020
yarn twenty dev            # build, sync and watch src/
yarn test                  # unit tests
yarn twenty dev:build      # validate the manifest and bundle without a server
```

The code is organised like this:

| Path | What |
|---|---|
| `src/application-config.ts` | App identity and the three variables |
| `src/fields/` | The *Last iMessage* fields added to Person |
| `src/logic-functions/on-comms-webhook.ts` | Verifies Comms' signature and updates matching people |
| `src/logic-functions/get-thread.ts`, `send-message.ts` | Routes the iMessage tab calls |
| `src/logic-functions/health-check.ts` | Checks the Comms connection from the settings page |
| `src/front-components/imessage-thread.tsx` | The iMessage tab |
| `src/page-layout-tabs/` | Places the tab on the Person record page |
| `src/lib/comms.ts` | Comms API client and webhook signature check |

Webhook signatures use `Comms-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` and must be less than five minutes old. A shared test vector in `src/lib/__tests__/comms.test.ts` and `packages/core/test/webhooks.test.ts` keeps both sides in agreement.
