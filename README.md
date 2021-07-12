# Music-start-discord-bot

A discord bot can play music

+ node: 14.17.3
+ npm: 7.19.1

# Commands

1. `.. [url: String]`
    > 播放音樂，若於播放中則加入播放清單
2. `..`
    > 暫停或繼續
3. `.vol [number: Float]`
    > 設定音量，number 值介由閉區間 [0, 1]
4. `.list`

   `.ls`
    > 顯示播放清單
5. `.next`
    > 跳到下一首歌
6. `.pre`
    > 跳到前一首歌
7. `.jump [number: Int]`

   `.jmp [number: Int]`
    > 跳到某一首歌 (可以搭配 .list)
    >
    > 跳到第一首歌 `.jump 0`
    >
    > 跳到最後一首歌 `.jump -1`
8. `.remove [number:Int]`

   `.rm [number:Int]`

   > 刪除某一首歌，規則與 jump 相同
9. `.bye`
    > terminate bot