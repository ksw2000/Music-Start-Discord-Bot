# Music Start!


Music Start 是一個可以於 Discord 語音頻道播放 Youtube 音樂的 Discord 機器人，該專案依賴於 [Discord.js](https://github.com/discordjs/discord.js/releases/tag/12.5.3) v12 該版本尚未支援 slash command。

目前已經有另一個專案支援 slash command：[Music Start Pro](https://github.com/liao2000/Music-Start-Discord-Bot-Pro)

因此，這個專案**即將停止更新**

## 將機器人加入至 Discord 群組

+ [點此將機器人加入 Discord 群組](https://discordapp.com/oauth2/authorize?&client_id=863100206333165628&scope=bot&permissions=8) 注意：營運此機器人的 Server 不穩定，可能會在線可能離線

控制機器人的相關語法，請見 [help.md](./help.md).

## 開發方法

### STEP 1 安裝環境

+ node: 14.17.3
+ npm: 7.19.1

```sh
# 使用 npm install 做初始化
npm install

# 安裝 ffmpeg
npm i ffmpeg-static
```

### STEP 2 申請 Discord Application

申請 Application 後複製 APP 的 Token，並於根目錄新增 `token.js`

```js
{
    "token": "你的TOKEN"
}
```

+ /
    + node_modules
    + discord.ts
    + **token.json**
    + ... 其他

### STEP 3 啟動

```sh
npm start
```

### 其他實用腳本

如果你在 Linux 環境開發，可以直接呼叫 `build.sh` 做環境建置。另外，開發完成後可以呼叫 `deploy.sh` 這個腳本會自動於背景運行 `discord.ts`，若前一次的程式仍在運行，`deploy.sh`會先 kill 掉先前的程式，才做佈署
