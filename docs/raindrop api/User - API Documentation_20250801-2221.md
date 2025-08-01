# User | API Documentation

**URL:** https://developer.raindrop.io/v1/user#single-group-detail

**Extracted:** 2025-08-01T14:21:46.140Z

---

<selectedText>
Group
</selectedText>

<content>
### 

[](#main-fields)

Main fields

Field

Publicly visible

Type

Description

\_id

**Yes**

`Integer`

Unique user ID

config

No

`Object`

More details in "Config fields"

email

No

`String`

Only visible for you

email\_MD5

**Yes**

`String`

MD5 hash of email. Useful for using with Gravatar for example

files.used

No

`Integer`

How much space used for files this month

files.size

No

`Integer`

Total space for file uploads

files.lastCheckPoint

No

`String`

When space for file uploads is reseted last time

fullName

**Yes**

`String`

Full name, max 1000 chars

groups

No

`Array<Object>`

More details below in "Groups"

password

No

`Boolean`

Does user have a password

pro

**Yes**

`Boolean`

PRO subscription

proExpire

No

`String`

When PRO subscription will expire

registered

No

`String`

Registration date

### 

[](#config-fields)

Config fields

Field

Publicly visible

Type

Description

config.broken\_level

No

`String`

Broken links finder configuration, possible values:

`basic` `default` `strict` or `off`

config.font\_color

No

`String`

Bookmark preview style: `sunset` `night` or empty

config.font\_size

No

`Integer`

Bookmark preview font size: from 0 to 9

config.lang

No

`String`

UI language in 2 char code

config.last\_collection

No

`Integer`

Last viewed collection ID

config.raindrops\_sort

No

`String`

Default bookmark sort:

`title` `-title` `-sort` `domain` `-domain` `+lastUpdate` or `-lastUpdate`

config.raindrops\_view

No

`String`

Default bookmark view:

`grid` `list` `simple` or `masonry`

### 

[](#single-group-detail)

Groups object fields

Field

Type

Description

title

`String`

Name of group

hidden

`Boolean`

Does group is collapsed

sort

`Integer`

Ascending order position

collections

`Array<Integer>`

Collection ID's in order

### 

[](#other-fields)

Other fields

Field

Publicly visible

Type

Description

facebook.enabled

No

`Boolean`

Does Facebook account is linked

twitter.enabled

No

`Boolean`

Does Twitter account is linked

vkontakte.enabled

No

`Boolean`

Does Vkontakte account is linked

google.enabled

No

`Boolean`

Does Google account is linked

dropbox.enabled

No

`Boolean`

Does Dropbox backup is enabled

gdrive.enabled

No

`Boolean`

Does Google Drive backup is enabled

Our API response could contain **other fields**, not described above. It's **unsafe to use** them in your integration! They could be removed or renamed at any time.

[PreviousHighlights](/v1/highlights)[NextAuthenticated user](/v1/user/authenticated)

Last updated 1 year ago

Was this helpful?
</content>