# Integrations: MCP, REST API and webhooks

Everything here is set up from **Settings → Integrations** in Comms.

## API keys

Keys look like `cms_…`. Each key belongs to one person and acts as them: it sees what they see, and anything it sends goes out under their name.

A key's access is either:
- **Read only:** search, read conversations and look people up.
- **Read & act:** everything above, plus sending, notes and conversation changes.

Comms stores only a SHA-256 of each key, so the full key is shown once, when it is made. You can revoke a key from the same page, and a key stops working as soon as its owner is deactivated.

Send the key as `Authorization: Bearer cms_…`. The `x-api-key` header also works.

Verification-code (OTP) threads never appear through the API, MCP or webhooks. Internal notes are left out of webhooks and search, and the API returns them only when you ask for them.

## MCP server

`POST {APP_URL}/api/mcp` serves MCP over Streamable HTTP. It is stateless and answers in plain JSON, with no sessions and no server-sent events.

For clients that can only be given a URL, such as the "custom connector" screens in Claude and ChatGPT, use `{APP_URL}/api/mcp/k/{key}`. Treat that URL like a password.

| Tool | Access | What it does |
|---|---|---|
| `whoami` | read | The user the key acts as and its access |
| `search_conversations` | read | Full-text search over messages, names and titles |
| `list_conversations` | read | By status and assignee, newest first |
| `get_conversation` | read | Details, recent messages and known facts about the person |
| `find_contacts` | read | By name, phone (any format) or email |
| `get_contact` | read | A person, their facts and their conversations |
| `list_teammates` | read | Active teammates, for assigning |
| `send_message` | write | Reply in a conversation (subject to the undo window) |
| `start_conversation` | write | Message a phone number or email |
| `add_note` | write | Internal note, with @mention notifications |
| `update_conversation` | write | Status, priority, assignee |

Write tools are listed only for keys that have write access.

To check that the server is up:

```bash
curl -s $APP_URL/api/mcp -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## REST API

Base URL: `{APP_URL}/api/v1`. A successful response is `{ "data": … }`. A failure is `{ "error": { "code", "message" } }` with status 400, 401, 403, 404 or 422.

| Method | Path | Notes |
|---|---|---|
| GET | `/me` | Who the key acts as |
| GET | `/conversations` | `status` (`open` by default, or `all`), `assigned=me\|unassigned\|any`, `contactId`, `limit`, `before` (ISO) |
| POST | `/conversations` | `{ address, body }`: message a phone or email; reuses an existing thread |
| GET | `/conversations/search?q=` | Postgres websearch syntax |
| GET | `/conversations/:id` | `messages` (count), `before`, `notes=true` |
| PATCH | `/conversations/:id` | `{ status?, priority?, assigneeEmail? }` |
| GET | `/conversations/:id/messages` | `limit`, `before` |
| POST | `/conversations/:id/messages` | `{ body }`: send a reply |
| POST | `/conversations/:id/notes` | `{ body }`: internal note |
| GET | `/contacts` | `query`, or `phone` / `email`; phones match on their last 10 digits |
| GET | `/contacts/:id` | Contact, facts and recent conversations |

## Webhooks

Comms POSTs a JSON event to each subscribed endpoint:

```json
{
  "id": "evt_…",
  "type": "message.received",
  "createdAt": "2026-10-09T12:00:00.000Z",
  "data": { "conversation": { … }, "message": { … } }
}
```

The events are:
- `message.received`
- `message.sent`
- `conversation.created`
- `ping`, sent by the **Test** button

Only live traffic is sent. Backfills and history re-syncs never fire webhooks.

Every delivery carries these headers:
- `Comms-Event`
- `Comms-Delivery`
- `Comms-Signature: t=<unix seconds>,v1=<hex>`, where `v1` is the HMAC-SHA256 of `"<t>.<raw body>"` keyed with the endpoint's `whsec_…` secret. Reject a delivery if the signature doesn't match or if `t` is more than five minutes old.

A failed delivery is retried with exponential backoff, up to six attempts. After 50 failures in a row the endpoint is switched off; turn it back on from the settings page.

## Twenty CRM

The Comms app for Twenty adds an iMessage tab to every person; see [`integrations/twenty`](../integrations/twenty/README.md). A single **Connect** in Comms creates its key and webhook.
