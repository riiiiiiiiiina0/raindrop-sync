# Backups | API Documentation

**URL:** https://developer.raindrop.io/v1/backups

**Extracted:** 2025-07-28T01:31:47.283Z

---

<content>
`GET` `https://api.raindrop.io/rest/v1/backups`

Useful to get backup ID's that can be used in `/backup/{ID}.{format}` endpoint.

Sorted by date (new first)

```
{
    "result": true,
    "items": [
        {
            "_id": "659d42a35ffbb2eb5ae1cb86",
            "created": "2024-01-09T12:57:07.630Z"
        }
    ]
}
```

`GET` `https://api.raindrop.io/rest/v1/backup/{ID}.{format}`

For example:

`https://api.raindrop.io/rest/v1/backup/659d42a35ffbb2eb5ae1cb86.csv`

ID\*

String

Backup ID

format\*

String

File format: `html` or `csv`

`GET` `https://api.raindrop.io/rest/v1/backup`

Useful to create a brand new backup. This requires some time.

New backup will appear in the list of `/backups` endpoint

```
We will send you email with html export file when it be ready! Time depends on bookmarks count and queue.
```

Last updated 1 year ago

Was this helpful?
</content>