# SocialFeeds API
### Handle all the database opertations from all services.
V2 now documented.


# Status
----
## GET v2/status
### Returns a list of statuses for all running services.

### Returns
Data may be returned as empty arrays if there is an issue with the gateway.
```js
{
  shards: [ { uptime: 0, memory: 0, id: 0 guilds: 0, shards: [{ id: 0, status: '', guilds: 0 }] } ],
  interactions: [ { uptime: 0, memory: 0, id: 0 } ],
  feeds: [ { uptime: 0, memory: 0, id: '' } ],
  apis: [ { uptime: 0, memory: 0, id: '' } ]
}
```

# Users
----
## GET /v2/users/@me
### Get information about the current user.
**`Requires user access token.`**

### Returns
```ts
{
  id: '',
  username: '',
  discriminator: '',
  avatar: '',
  bot: false
}
```

# Premium
---
**`All routes require admin token`**

## GET /v2/premium/status
### Returns premium status of a user.

### Query Params
| Name  | Value  
| ---   | ----
| id    | ID of the user you wish to check.

### Returns
```ts
{
  isPremium: true,
  discordID: '',
  amountPaid: 0,
  guildID: '',
  expires: 0,
  subscriptionStatus: '',
  tier: 0
}
```

### Errors
Accessing from normal user (not developer or bot account)
```
401: You are not authorised to use this endpoint, nice try though.
```


## GET /v2/premium/customers
### Get a list of all premium customers.

### Returns
```js
[{
  discordID: '',
  amountPaid: 0,
  guildID: '',
  expires: 0,
  subscriptionStatus: '',
  tier: 0
}, ...]
```

### Errors
Accessing from normal user (not developer or bot account)
```
401: You are not authorised to use this endpoint, nice try though.
```

## PUT /v2/premium/customers
### Update the database with updated customer list.
`ENDPOINT TO BE REMOVED?`


# Feeds
----
## GET v2/feeds
### Gets a list of all the feeds in the database.

### Query options
| Key              | Definition                            | Default
| ----             |        -----                          | ---- 
| page             | Page number to go to                  | 1
| guildID          | Filter feeds by guild ID              | X    
| type             | Filter feeds by type                  | X
| url              | Filter feeds by their url             | X
| webhook_id       | Filter by webhook ID                  | X
| webhook_token    | Filter by webhook token               | X
| opts.replies     | Filter by if Twitter replies included | X
| opts.excludeDesc | Filter by if text is shorter in RSS   | X
| opts.noEmbed     | Filter by if  messages are non embed  | X
| opts.user_id     | Filter by a Twitch streamer id        | X 
| opts.message     | Filter by custom messages             | X


### Returns
```js
[
  { type: '',
      url: '',
      guildID: '',
      webhookID: '',
      webhookToken: '',
      options: { replies: false, excludeDesc: false, noEmbed: false, user_id: '', message: '' },
      display: { title?: '', icon?: '' }
  }
]
```

### Errors
Accessing from normal user (not developer or bot account)
```
401: You are not authorised to use this endpoint, nice try though.
```

## GET v2/feeds/<guild_id>
### Gets a list of feeds for a specific server.

### Query options
| Key              | Definition                            | Default
| ----             |        -----                          | ---- 
| page             | Page number to go to                  | 1
| guildID          | Filter feeds by guild ID              | X    
| type             | Filter feeds by type                  | X
| url              | Filter feeds by their url             | X
| webhook_id       | Filter by webhook ID                  | X
| webhook_token    | Filter by webhook token               | X
| opts.replies     | Filter by if Twitter replies included | X
| opts.excludeDesc | Filter by if text is shorter in RSS   | X
| opts.noEmbed     | Filter by if  messages are non embed  | X
| opts.user_id     | Filter by a Twitch streamer id        | X 
| opts.message     | Filter by custom messages             | X


### Returns
```js
[
  {
    type: '',
    url: '',
    guildID: '',
    webhookID: '',
    webhookToken: '',
    options: {
      replies: false,
      excludeDesc: false,
      noEmbed: false,
      user_id: '',
      message: ''
    },
    display: { title?: '', icon?: '' }
  }
]
```

### Errors
Accessing from normal user (not developer or bot account)
```
401: You are not authorised to use this endpoint, nice try though.
```


## GET v2/feeds/counts
### Shows a table of total feed counts setup.

### Returns
```js
{
  feedCount: 0,
  twitter: 0,
  twitch: 0,
  rss: 0,
  reddit: 0,
  statuspage: 0,
  youtube: 0,
  rblxGroup: 0
}
```

## POST v2/feeds/<guild_id>
### Creates a new feed.

### Body
```js
{
  type: '',
  url: '',
  guildID: '',
  options: {
    message: '',
    excludeDesc: false,
    replies: false,
    noEmbed: false
  }
}
```

### Returns
```js
{
  success: true,
  feedData: {
    title?: '',
    icon?: ''
  }
}
```

### Errors
Posting from normal user (not developer or bot account)
```
401: You are not authorised to use this endpoint, nice try though.
```


## PATCH v2/feeds/<guild_id>
### Updates an existing feed.

### Body
```js
{
  type: '',
  url: '',
  newURL?: '',
  webhookID: ''
}
```

### Returns
```js
{
  success: true
}
```

### Errors
Patching from normal user (not developer or bot account)
```
401: You are not authorised to use this endpoint, nice try though.
```


## DELETE v2/feeds/<guild_id>
### Deletes an existing feed.

### Body
```js
{
  type: '',
  url: '',
  webhookID: ''
}
```

### Returns
```js
{
  success: true,
  options?: {
    message: '',
    excludeDesc: false,
    replies: false,
    noEmbed: false
  },
  type: '',
  url: '',
  display: {
    title?: '',
    icon?: ''
  }
}
```

### Errors
Patching from normal user (not developer or bot account)
```
401: You are not authorised to use this endpoint, nice try though.
```


## Gateway
---
`All endpoints require Authorisation`

## GET v2/gateway/auth
### Check if a user is staff (developers or SocialFeeds bot)

### Returns
```js
{
  auth: false
}
```

### Errors
Accessing without authorisation.
```
401: Not logged in
```


## POST v2/gateway/restart
### Restarts a specified service.

### Body
```js
{
  name: '',
  id: 'all'
}
```

### Returns
```js
{
  success: true
}
```

### Errors
Accessing without authorisation or not logged in.
```
401: Not logged in
```

API not connected to gateway.
```
500: Gateway not connected.
```