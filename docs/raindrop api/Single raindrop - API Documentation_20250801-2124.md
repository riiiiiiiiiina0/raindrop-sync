# Single raindrop | API Documentation

**URL:** https://developer.raindrop.io/v1/raindrops/single

**Extracted:** 2025-08-01T13:24:23.501Z

---

<content>
## 

[](#get-raindrop)

Get raindrop

`GET` `https://api.raindrop.io/rest/v1/raindrop/{id}`

#### 

[](#path-parameters)

Path Parameters

Name

Type

Description

id\*

number

Existing raindrop ID

200

[](#tab-id-200)

Copy

## 

[](#create-raindrop)

Create raindrop

`POST` `https://api.raindrop.io/rest/v1/raindrop`

Description and possible values of fields described in "Fields"

#### 

[](#request-body)

Request Body

Name

Type

Description

pleaseParse

object

Specify empty object to automatically parse meta data (cover, description, html) in the background

created

string

lastUpdate

string

order

number

Specify sort order (ascending). For example if you want to move raindrop to the first place set this field to **0**

important

boolean

tags

array

media

array

cover

string

collection

object

type

string

excerpt

string

title

string

link\*

string

highlights

array

reminder

object

200

[](#tab-id-200-1)

Copy

```
{
    "result": true,
    "item": {
        ...
    }
}
```

## 

[](#update-raindrop)

Update raindrop

`PUT` `https://api.raindrop.io/rest/v1/raindrop/{id}`

Description and possible values of fields described in "Fields"

#### 

[](#path-parameters-1)

Path Parameters

Name

Type

Description

id\*

number

Existing raindrop ID

#### 

[](#request-body-1)

Request Body

Name

Type

Description

created

string

lastUpdate

string

pleaseParse

object

Specify empty object to re-parse link meta data (cover, type, html) in the background

order

number

Specify sort order (ascending). For example if you want to move raindrop to the first place set this field to **0**

important

boolean

tags

array

media

array

cover

string

collection

object

type

string

excerpt

string

title

string

link

string

highlights

array

reminder

object

200

[](#tab-id-200-2)

Copy

```
{
    "result": true,
    "item": {
        ...
    }
}
```

## 

[](#remove-raindrop)

Remove raindrop

`DELETE` `https://api.raindrop.io/rest/v1/raindrop/{id}`

When you remove raindrop it will be moved to user `Trash` collection. But if you try to remove raindrop from `Trash`, it will be removed permanently.

#### 

[](#path-parameters-2)

Path Parameters

Name

Type

Description

id\*

number

Existing raindrop ID

200

[](#tab-id-200-3)

Copy

```
{
    "result": true
}
```

## 

[](#upload-file)

Upload file

`PUT` `https://api.raindrop.io/rest/v1/raindrop/file`

Make sure to send PUT request with [multipart/form-data](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST#example) body

#### 

[](#headers)

Headers

Name

Type

Description

Content-Type\*

string

multipart/form-data

#### 

[](#request-body-2)

Request Body

Name

Type

Description

file\*

object

File

collectionId

String

Collection Id

200

[](#tab-id-200-4)

400

[](#tab-id-400)

Copy

```
{
    "result": true,
    "item": {
        "title": "File name",
        "type": "image",
        "link": "https://up.raindrop.io/raindrop/111/file.jpeg",
        "domain": "raindrop.io",
        "file": {
            "name": "File name.jpeg",
            "size": 10000
        }
        ...
    }
}
```

Copy

```
//file is not specified
{
  "result": false,
  "error": -1,
  "errorMessage": "no file"
}

//unsupported file format
{
  "result": false,
  "error": "file_invalid",
  "errorMessage": "File is invalid"
}

//file size is big
{
  "result": false,
  "error": "file_size_limit",
  "errorMessage": "File size limit"
}
```

## 

[](#upload-cover)

Upload cover

`PUT` `https://api.raindrop.io/rest/v1/raindrop/{id}/cover`

PNG, GIF or JPEG

#### 

[](#path-parameters-3)

Path Parameters

Name

Type

Description

id\*

number

Existing raindrop ID

#### 

[](#headers-1)

Headers

Name

Type

Description

Content-Type\*

string

multipart/form-data

#### 

[](#request-body-3)

Request Body

Name

Type

Description

cover\*

object

File

200

[](#tab-id-200-5)

400

[](#tab-id-400-1)

Copy

```
{
    "result": true,
    "item": {
        "cover": "https://up.raindrop.io/raindrop/...",
        "media": [
            {
                "link": "https://up.raindrop.io/raindrop/..."
            }
        ]
        ...
    }
}
```

Copy

```
//file is not specified
{
  "result": false,
  "error": -1,
  "errorMessage": "no file"
}

//unsupported file format
{
  "result": false,
  "error": "file_invalid",
  "errorMessage": "File is invalid"
}

//file size is big
{
  "result": false,
  "error": "file_size_limit",
  "errorMessage": "File size limit"
}
```

## 

[](#get-permanent-copy)

Get permanent copy

`GET` `https://api.raindrop.io/rest/v1/raindrop/{id}/cache`

Links permanently saved with all content (only in PRO plan). Using this method you can navigate to this copy.

#### 

[](#path-parameters-4)

Path Parameters

Name

Type

Description

id\*

number

Existing raindrop ID

307

[](#tab-id-307)

Copy

```
Location: https://s3.aws...
```

## 

[](#suggest-collection-and-tags-for-new-bookmark)

Suggest collection and tags for new bookmark

`POST` `https://api.raindrop.io/rest/v1/raindrop/suggest`

#### 

[](#request-body-4)

Request Body

Name

Type

Description

link\*

string

200

[](#tab-id-200-6)

Copy

```
{
    "result": true,
    "item": {
        "collections": [
            {
                "$id": 568368
            },
            {
                "$id": 8519567
            },
            {
                "$id": 1385626
            },
            {
                "$id": 8379661
            },
            {
                "$id": 20865985
            }
        ],
        "tags": [
            "fonts",
            "free",
            "engineering",
            "icons",
            "invalid_parser"
        ]
    }
}
```

## 

[](#suggest-collection-and-tags-for-existing-bookmark)

Suggest collection and tags for existing bookmark

`GET` `https://api.raindrop.io/rest/v1/raindrop/{id}/suggest`

#### 

[](#path-parameters-5)

Path Parameters

Name

Type

Description

\*

String

Bookmark id

200

[](#tab-id-200-7)

Copy

```
{
    "result": true,
    "item": {
        "collections": [
            {
                "$id": 568368
            },
            {
                "$id": 8519567
            },
            {
                "$id": 1385626
            },
            {
                "$id": 8379661
            },
            {
                "$id": 20865985
            }
        ],
        "tags": [
            "fonts",
            "free",
            "engineering",
            "icons",
            "invalid_parser"
        ]
    }
}
```

[PreviousRaindrops](/v1/raindrops)[NextMultiple raindrops](/v1/raindrops/multiple)

Last updated 1 year ago

Was this helpful?
</content>