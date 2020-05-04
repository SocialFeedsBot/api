# API
## Handle database opertations from the bot and the website.

# Routes
**GET** `/feeds`
  This will return all the feeds setup.

  - Returns
    ```json
    [{
      "guildID": "1234567890123456789",
      "feeds": [{ "type": "twitter", "url": "https://twitter.com/discordapp" }]
    }, {
      "guildID": "1876543210987654321",
      "feeds": [{ "type": "twitch", "url": "https://twitch.tv/discordapp" }]
    }]
    ```

**GET** `/feeds/:guildID`
  This will return the feeds setup in a server.

  - Returns
    ```json
    [{
      "type": "twitch",
      "url": "https://twitch.tv/discordapp",
      "webhook": { "id": "73739874987398", "token": "kgbgG8T76VU8T" }
    }]
    ```

**POST** `/feeds/new`
  This will create a new document if the URL provided doesn't already exist, or it will add the webhook url to the existing document.

  - Send
    ```json
    {
      "webhook": { "id": "1234567890123456789", "token": "njGUYIUHiuTYFC" },
      "guildID": "1234567890123456789",
      "feed": { "type": "twitter", "url": "https://twitter.com/discordapp" }
    }
    ```
  - Returns
    ```json
    {
      "success": true
    }
    ```

**POST** `/feeds/delete`
  This will remove a webhook url from the array so that it will no longer be posted to a server.

  - Send
    ```json
    {
      "feed": { "url": "https://reddit.com/r/discordapp/all.rss" },
      "guildID": "1234567890123456789",
      "webhook": { "id": "1234567890123456789", "token": "njGUYIUHiuTYFC" }
    }
    ```
  - Returns
    ```json
    {
      "success": true
    }
    ```