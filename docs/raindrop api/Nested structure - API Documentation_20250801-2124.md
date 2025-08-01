# Nested structure | API Documentation

**URL:** https://developer.raindrop.io/v1/collections/nested-structure

**Extracted:** 2025-08-01T13:24:15.775Z

---

<content>
### 

[](#overview)

Overview

If you look into Raindrop UI you will notice a sidebar in left corner, where collections are located. Collections itself divided by groups. Groups useful to create separate sets of collections, for example "Home", "Work", etc.

`Groups` array is a single place where user **root** collection list and order is persisted. Why just not to save order position inside collection item itself? Because collections can be shared and they group and order can vary from user to user.

So to fully recreate sidebar like in our app you need to make 3 separate API calls (sorry, will be improved in future API updates):

#### 

[](#id-1.-get-user-object)

1\. [Get user object](/v1/user/authenticated#get-user)

It contains `groups` array with exact collection ID's. Typically this array looks like this:

Copy

```
{
  "groups": [
    {
      "title": "Home",
      "hidden": false,
      "sort": 0,
      "collections": [
        8364483,
        8364403,
        66
      ]
    },
    {
      "title": "Work",
      "hidden": false,
      "sort": 1,
      "collections": [
        8492393
      ]
    }
  ]
}
```

Collection ID's listed below is just first level of collections structure! To create full tree of nested collections you need to get child items separately.

To get name, count, icon and other info about collections, make those two separate calls:

#### 

[](#id-2.-get-root-collections)

2\. [Get root collections](/v1/collections/methods#get-root-collections)

Sort order of root collections persisted in `groups[].collections` array

#### 

[](#id-3.-get-child-collections)

3\. [Get child collections](/v1/collections/methods#get-child-collections)

Sort order of child collections persisted in collection itself in `sort` field

[PreviousCollection methods](/v1/collections/methods)[NextSharing](/v1/collections/sharing)

Last updated 5 years ago

Was this helpful?
</content>