# Collection methods | API Documentation

**URL:** https://developer.raindrop.io/v1/collections/methods

**Extracted:** 2025-08-01T13:23:55.107Z

---

<content>
## 

[](#get-root-collections)

Get root collections

`GET` `https://api.raindrop.io/rest/v1/collections`

Returns JSON-encoded array containing all root collections

200

[](#tab-id-200)

Copy

```
{
  "result": true,
  "items": [
    {
      "_id": 8492393,
      "access": {
        "level": 4,
        "draggable": true
      },
      "collaborators": {
        "$id": "5dc1759a0e123be5f2654b6f"
      },
      "color": "#0c797d",
      "count": 16,
      "cover": [
        "https://up.raindrop.io/collection/thumbs/849/239/3/333ce18769311113836cf93a223a14a3.png"
      ],
      "created": "2019-10-09T11:49:53.518Z",
      "expanded": false,
      "lastUpdate": "2019-11-27T17:51:19.085Z",
      "public": false,
      "sort": 8492393,
      "title": "Development",
      "user": {
        "$id": 32
      },
      "view": "list"
    }
  ]
}
```

## 

[](#get-child-collections)

Get child collections

`GET` `https://api.raindrop.io/rest/v1/collections/childrens`

Returns JSON-encoded array containing all nested collections (that have positive `parent.$id`)

200

[](#tab-id-200-1)

Copy

```
{
  "result": true,
  "items": [
    {
      "_id": 8492393,
      "access": {
        "level": 4,
        "draggable": true
      },
      "collaborators": {
        "$id": "5dc1759a0e123be5f2654b6f"
      },
      "color": "#0c797d",
      "count": 16,
      "cover": [
        "https://up.raindrop.io/collection/thumbs/849/239/3/333ce18769311113836cf93a223a14a3.png"
      ],
      "created": "2019-10-09T11:49:53.518Z",
      "expanded": false,
      "lastUpdate": "2019-11-27T17:51:19.085Z",
      "parent": { "$id": 1111 },
      "public": false,
      "sort": 8492393,
      "title": "Development",
      "user": {
        "$id": 32
      },
      "view": "list"
    }
  ]
}
```

## 

[](#get-collection)

Get collection

`GET` `https://api.raindrop.io/rest/v1/collection/{id}`

#### 

[](#path-parameters)

Path Parameters

Name

Type

Description

id

number

Collection ID

200

[](#tab-id-200-2)

Copy

```
{
  "result": true,
  "item": {
    "_id": 8492393,
    "access": {
      "for": 32,
      "level": 4,
      "root": true,
      "draggable": true
    },
    "author": true,
    "collaborators": {
      "$id": "5dc1759a0e123be5f2654b6f"
    },
    "color": "#0c797d",
    "count": 16,
    "cover": [
      "https://up.raindrop.io/collection/thumbs/849/239/3/333ce18769311113836cf93a223a14a3.png"
    ],
    "created": "2019-10-09T11:49:53.518Z",
    "expanded": false,
    "lastUpdate": "2019-11-27T17:51:19.085Z",
    "public": false,
    "sort": 8492393,
    "title": "Development",
    "user": {
      "$id": 32
    },
    "view": "list"
  }
}
```

## 

[](#create-collection)

Create collection

`POST` `https://api.raindrop.io/rest/v1/collection`

Create a new collection

#### 

[](#request-body)

Request Body

Name

Type

Description

view

string

More details in "Fields"

title

string

Name of the collection

sort

number

The order of collection (descending). Defines the position of the collection among all the collections with the same `parent.$id`

public

boolean

Collection and raindrops that it contains will be accessible without authentication?

parent.$id

integer

The ID of parent collection. Empty for root collections

cover

array

Collection cover url

200

[](#tab-id-200-3)

400 Incorrect 'view' field value

[](#tab-id-400-incorrect-view-field-value)

Copy

```
{
    "result": true,
    "item": {
        ...
    }
}
```

Copy

```
{
    "result": false,
    "error": "view",
    "errorMessage": "Collection validation failed: view: `bla` is not a valid enum value for path `view`."
}
```

## 

[](#update-collection)

Update collection

`PUT` `https://api.raindrop.io/rest/v1/collection/{id}`

Update an existing collection

#### 

[](#path-parameters-1)

Path Parameters

Name

Type

Description

id

number

Existing collection id

#### 

[](#request-body-1)

Request Body

Name

Type

Description

expanded

boolean

Whether the collection\`s sub-collections are expanded

view

string

More details in "Fields"

title

string

Name of the collection

sort

number

The order of collection (descending). Defines the position of the collection among all the collections with the same `parent.$id`

public

boolean

Collection and raindrops that it contains will be accessible without authentication?

parent.$id

integer

The ID of parent collection. Empty for root collections

cover

array

Collection cover url

200

[](#tab-id-200-4)

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

[](#upload-cover)

Upload cover

`PUT` `https://api.raindrop.io/rest/v1/collection/{id}/cover`

It's possible to upload cover from desktop. PNG, GIF and JPEG supported

#### 

[](#path-parameters-2)

Path Parameters

Name

Type

Description

id

string

Existing collection ID

#### 

[](#headers)

Headers

Name

Type

Description

Content-Type

string

multipart/form-data

#### 

[](#request-body-2)

Request Body

Name

Type

Description

cover

object

File

200

[](#tab-id-200-5)

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

[](#remove-collection)

Remove collection

`DELETE` `https://api.raindrop.io/rest/v1/collection/{id}`

Remove an existing collection and all its descendants. Raindrops will be moved to "Trash" collection

#### 

[](#path-parameters-3)

Path Parameters

Name

Type

Description

id

number

Existing collection ID

200

[](#tab-id-200-6)

Copy

```
{
    "result": true
}
```

## 

[](#remove-multiple-collections)

Remove multiple collections

`DELETE` `https://api.raindrop.io/rest/v1/collections`

Remove multiple collections at once. Nested collections are ignored (include ID's in `ids` array to remove them)

#### 

[](#request-body-3)

Request Body

Name

Type

Description

ids

array

Array of collection ID

200

[](#tab-id-200-7)

Copy

## 

[](#reorder-all-collections)

Reorder all collections

`PUT` `https://api.raindrop.io/rest/v1/collections`

Updates order of all collections

#### 

[](#request-body-4)

Request Body

Name

Type

Description

sort

string

Change order of all collections. Possible values: "title" - sort alphabetically ascending "-title" - sort alphabetically descending "-count" - sort by raindrops count descending

200

[](#tab-id-200-8)

Copy

```
{
    "result": true
}
```

## 

[](#expand-collapse-all-collections)

Expand/collapse all collections

`PUT` `https://api.raindrop.io/rest/v1/collections`

#### 

[](#path-parameters-4)

Path Parameters

Name

Type

Description

expanded

boolean

TRUE = expand all FALSE = collapse all

200

[](#tab-id-200-9)

Copy

```
{
    "result": true
}
```

## 

[](#merge-collections)

Merge collections

`PUT` `https://api.raindrop.io/rest/v1/collections/merge`

Merge multiple collections

#### 

[](#request-body-5)

Request Body

Name

Type

Description

to

number

Collection ID where listed collection `ids` will be merged

ids

array

Collection ID's

200

[](#tab-id-200-10)

Copy

## 

[](#remove-all-empty-collections)

Remove all empty collections

`PUT` `https://api.raindrop.io/rest/v1/collections/clean`

200

[](#tab-id-200-11)

Copy

```
{
    "result": true,
    "count": 3
}
```

## 

[](#empty-trash)

Empty Trash

`DELETE` `https://api.raindrop.io/rest/v1/collection/-99`

200

[](#tab-id-200-12)

Copy

```
{
  "result": true
}
```

## 

[](#get-system-collections-count)

Get system collections count

`GET` `https://api.raindrop.io/rest/v1/user/stats`

200

[](#tab-id-200-13)

Copy

```
{
  "items": [
    {
      "_id": 0,
      "count": 1570
    },
    {
      "_id": -1,
      "count": 34
    },
    {
      "_id": -99,
      "count": 543
    }
  ],
  "meta": {
    "pro": true,
    "_id": 32,
    "changedBookmarksDate": "2020-02-11T11:23:43.143Z",
    "duplicates": {
      "count": 3
    },
    "broken": {
      "count": 31
    }
  },
  "result": true
}
```

[PreviousCollections](/v1/collections)[NextNested structure](/v1/collections/nested-structure)

Last updated 1 year ago

Was this helpful?
</content>