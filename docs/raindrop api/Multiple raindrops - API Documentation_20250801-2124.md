# Multiple raindrops | API Documentation

**URL:** https://developer.raindrop.io/v1/raindrops/multiple

**Extracted:** 2025-08-01T13:24:27.216Z

---

<content>
### 

[](#common-parameters)

Common parameters

To filter, sort or limit raindrops use one of the parameters described below. Check each method for exact list of supported parameters.

Parameter

Type

Description

collectionId

`Integer`

Path parameter that specify from which collection to get raindrops. Or specify one of system:

`0` to get all (except Trash)

`-1` to get from "Unsorted"

`-99` to get from "Trash"

Warning: update or remove methods not support `0` yet. Will be fixed in future.

search

`String`

As text, check all [examples here](https://help.raindrop.io/using-search#operators)

You can first test your searches in Raindrop app and if it works correctly, just copy content of search field and use it here

sort

`String`

Query parameter for sorting:

`-created` by date descending (default)

`created` by date ascending

`score` by relevancy (only applicable when search is specified)

`-sort` by order

`title` by title (ascending)

`-title` by title (descending)

`domain` by hostname (ascending)

`-domain` by hostname (descending)

page

`Integer`

Query parameter. 0, 1, 2, 3 ...

perpage

`Integer`

Query parameter. How many raindrops per page. 50 max

ids

`Array<Integer>`

You can specify exact raindrop ID's for batch update/remove methods

nested

`Boolean`

Also include bookmarks from nested collections (true/false)

## 

[](#get-raindrops)

Get raindrops

`GET` `https://api.raindrop.io/rest/v1/raindrops/{collectionId}`

#### 

[](#path-parameters)

Path Parameters

Name

Type

Description

collectionId\*

number

Collection ID. Specify 0 to get all raindrops

#### 

[](#query-parameters)

Query Parameters

Name

Type

Description

sort

string

perpage

number

page

number

search

string

nested

boolean

200

[](#tab-id-200)

Copy

## 

[](#create-many-raindrops)

Create many raindrops

`POST` `https://api.raindrop.io/rest/v1/raindrops`

#### 

[](#request-body)

Request Body

Name

Type

Description

items\*

array

Array of objects. Format of single object described in "Create single raindrop". Maximum 100 objects in array!

200

[](#tab-id-200-1)

Copy

```
{
    "result": true,
    "items": [
        {
            ...
        }
    ]
}
```

## 

[](#update-many-raindrops)

Update many raindrops

`PUT` `https://api.raindrop.io/rest/v1/raindrops/{collectionId}`

Specify optional `search` and/or `ids` parameters to limit raindrops that will be updated. Possible fields that could be updated are described in "Body Parameters"

#### 

[](#path-parameters-1)

Path Parameters

Name

Type

Description

collectionId\*

number

nested

boolean

#### 

[](#request-body-1)

Request Body

Name

Type

Description

ids

array

important

boolean

TRUE - mark as "favorite" FALSE - unmark as "favorite"

tags

array

Will append specified tags to raindrops. Or will remove all tags from raindrops if `[]` (empty array) is specified

media

array

Will append specified media items to raindrops. Or will remove all media from raindrops if `[]` (empty array) is specified

cover

string

Set URL for cover. *Tip:* specify `<screenshot>` to set screenshots for all raindrops

collection

object

Specify `{"$id": collectionId}` to move raindrops to other collection

200

[](#tab-id-200-2)

Copy

## 

[](#remove-many-raindrops)

Remove many raindrops

`DELETE` `https://api.raindrop.io/rest/v1/raindrops/{collectionId}`

Specify optional `search` and/or `ids` parameters to limit raindrops that will be moved to "**Trash**" When `:collectionId` is **\-99**, raindrops will be permanently removed!

#### 

[](#path-parameters-2)

Path Parameters

Name

Type

Description

collectionId\*

number

nested

boolean

#### 

[](#query-parameters-1)

Query Parameters

Name

Type

Description

search

string

#### 

[](#request-body-2)

Request Body

Name

Type

Description

ids

array

200

[](#tab-id-200-3)

Copy

```
{
    "result": true,
    "modified": 330
}
```

[PreviousSingle raindrop](/v1/raindrops/single)[NextHighlights](/v1/highlights)

Last updated 7 months ago

Was this helpful?
</content>