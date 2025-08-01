# Raindrops | API Documentation

**URL:** https://developer.raindrop.io/v1/raindrops

**Extracted:** 2025-08-01T14:30:10.350Z

---

<content>
### 

[](#main-fields)

Main fields

Field

Type

Description

\_id

`Integer`

Unique identifier

collection

`Object`

​

collection.$id

`Integer`

Collection that the raindrop resides in

cover

`String`

Raindrop cover URL

created

`String`

Creation date

domain

`String`

Hostname of a link. Files always have `raindrop.io` hostname

excerpt

`String`

Description; max length: 10000

note

`String`

Note; max length: 10000

lastUpdate

`String`

Update date

link

`String`

URL

media

`Array<Object>`

​Covers list in format: `[ {"link":"url"} ]`

tags

`Array<String>`

Tags list

title

`String`

Title; max length: 1000

type

`String`

`link` `article` `image` `video` `document` or `audio`

user

`Object`

​

user.$id

`Integer`

Raindrop owner

### 

[](#other-fields)

Other fields

Field

Type

Description

broken

`Boolean`

Marked as broken (original `link` is not reachable anymore)

cache

`Object`

Permanent copy (cached version) details

cache.status

`String`

`ready` `retry` `failed` `invalid-origin` `invalid-timeout` or `invalid-size`

cache.size

`Integer`

Full size in bytes

cache.created

`String`

Date when copy is successfully made

creatorRef

`Object`

Sometime raindrop may belong to other user, not to the one who created it. For example when this raindrop is created in shared collection by other user. This object contains info about original author.

creatorRef.\_id

`Integer`

Original author (user ID) of a raindrop

creatorRef.fullName

`String`

Original author name of a raindrop

file

`Object`

This raindrop uploaded from desktop

[Supported file formats](https://help.raindrop.io/article/48-uploading-files)

file.name

`String`

File name

file.size

`Integer`

File size in bytes

file.type

`String`

Mime type

important

`Boolean`

Marked as "favorite"

highlights

`Array`

highlights\[\].\_id

`String`

Unique id of highlight

highlights\[\].text

`String`

Text of highlight (required)

highlights\[\].color

`String`

Color of highlight. Default `yellow` Can be `blue`, `brown`, `cyan`, `gray`, `green`, `indigo`, `orange`, `pink`, `purple`, `red`, `teal`, `yellow`

highlights\[\].note

`String`

Optional note for highlight

highlights\[\].created

`String`

Creation date of highlight

reminder

`Object`

Specify this object to attach reminder

reminder.data

`Date`

YYYY-MM-DDTHH:mm:ss.sssZ

Our API response could contain **other fields**, not described above. It's **unsafe to use** them in your integration! They could be removed or renamed at any time.

[PreviousCovers/icons](/v1/collections/covers-icons)[NextSingle raindrop](/v1/raindrops/single)

Last updated 1 year ago

Was this helpful?
</content>