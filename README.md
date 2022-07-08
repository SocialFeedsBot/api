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
`TO BE DOCUMENTATED`

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
  isPremium: boolean,
  customerID: string,
  balance: number,
  created: Date,
  currency: string,
  email: string
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
  customerID: '',
  balance: 0,
  created: 100000,
  currency: '',
  email: ''
}]
```

### Errors
Accessing from normal user (not developer or bot account)
```
401: You are not authorised to use this endpoint, nice try though.
```

## PUT /v2/premium/customers
### Update the database with updated customer list.
`DOCUMENTATION TODO`


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

