# Collections | API Documentation

**URL:** https://developer.raindrop.io/v1/collections

**Extracted:** 2025-08-01T14:30:14.309Z

---

<content>
### 

[](#fields)

Fields

Field

Type

Description

\_id

`Integer`

The id of the collection.

access

`Object`

access.level

`Integer`

1.  read only access (equal to `public=true`)
    
2.  collaborator with read only access
    
3.  collaborator with write only access
    
4.  owner
    

access.draggable

`Boolean`

Does it possible to change parent of this collection?

collaborators

`Object`

When this object is present, means that collections is shared. Content of this object is private and not very useful. All sharing API methods [described here](/v1/collections/sharing)

color

`String`

Primary color of collection cover as `HEX`

count

`Integer`

Count of raindrops in collection

cover

`Array<String>`

Collection cover URL. This array always have one item due to legacy reasons

created

`String`

When collection is created

expanded

`Boolean`

Whether the collection’s sub-collections are expanded

lastUpdate

`String`

When collection is updated

parent

`Object`

parent.$id

`Integer`

The id of the parent collection. Not specified for root collections

public

`Boolean`

Collection and raindrops that it contains will be accessible without authentication by public link

sort

`Integer`

The order of collection (descending). Defines the position of the collection among all the collections with the same `parent.$id`

title

`String`

Name of the collection

user

`Object`

user.$id

`Integer`

Owner ID

view

`String`

View style of collection, can be:

-   `list` (default)
    
-   `simple`
    
-   `grid`
    
-   `masonry` Pinterest like grid
    

Our API response could contain **other fields**, not described above. It's **unsafe to use** them in your integration! They could be removed or renamed at any time.

### 

[](#system-collections)

System collections

Every user have several system non-removable collections. They are not contained in any API responses.

\_id

Description

**\-1**

"**Unsorted**" collection

**\-99**

"**Trash**" collection

[PreviousMake authorized calls](/v1/authentication/calls)[NextCollection methods](/v1/collections/methods)

Last updated 5 years ago

Was this helpful?
</content>