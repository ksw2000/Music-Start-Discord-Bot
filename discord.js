// reference:
// https://b-l-u-e-b-e-r-r-y.github.io/post/DiscordBot02

const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const { token } = require('./token.json');
const client = new Discord.Client();

function sendingError(msg, error) {
    msg.channel.send(`> 錯誤 \n > ${error}`);
}

class Bucket{
    static instant = {};
    // 利用 msg.guild.id
    constructor(msg){
        this.id = msg.guild.id;
        // https://discord.js.org/#/docs/main/stable/class/VoiceConnection
        this.connection = null;
        // https://discord.js.org/#/docs/main/stable/class/StreamDispatcher
        this.dispatcher = null;
        this.queue = new Queue();
        this.playing = false;
        Bucket.instant[msg.guild.id] = this;
    }

    static find(msg){
        if(typeof Bucket.instant[msg.guild.id] === 'undefined'){
            return new Bucket(msg);
        }else{
            return Bucket.instant[msg.guild.id];
        }
    }
}

class Queue {
    constructor(){
        this.list = [];
        this.index = 0;
    }

    isEmpty() {
        this.list.length === 0;
    }

    en(url) {
        this.list.push(url);
    }

    next() {
        if (this.isEmpty) throw ('queue is empty');
        this.index = (this.index + 1) % this.list.length
        return this.list[this.index]
    }

    static show(msg) {
        if (Bucket.find(msg).queue.isEmpty()) {
            msg.reply('無播放清單');
        } else {
            let text = '';
            for (let i = 0; i < this.list.length; i++) {
                text += `> ${i}. ${this.list[i]}\n`
            }
            msg.reply(text);
        }
    }
}

class Music {
    constructor(msg){
        this.msg = msg;
        this.me = Bucket.find(msg);
    }

    play(url) {
        // 如果使用者在語音頻道中
        if (this.msg.member.voice.channel) {
            this.me.queue.en(url);
            if (!this.me.playing){
                this.playQueue(url);
            }
        } else {
            // 如果使用者不在任何一個語音頻道
            this.msg.reply('你必須先加入語音頻道');
        }
    }

    async playQueue(url) {
        try {
            const res = await ytdl.getInfo(url);
            const info = res.videoDetails;
            this.me.dispatcher = this.me.connection.play(ytdl(url, { filter: 'audioonly' }), {
                volume: .64,
                bitrate: 128,
                highWaterMark: 1024,
                plp: 0.5,
                fec: true
            });

            this.msg.channel.send(`> 正在播放：${info.title}`);
            this.me.playing = true;

            this.me.dispatcher.on('finish', () => {
                this.me.playing = false;

                // goto next
                this.playQueue(this.me.queue.next());
            });

            this.me.dispatcher.on('error', () => {
                sendingError(this.msg, e);
            });
        } catch (e) {
            this.me.playing = false;
            sendingError(this.msg, e);
        }
    }

    pause() {
        this.msg.reply('暫停');
        if (this.me.dispatcher) {
            this.me.dispatcher.pause();
        }
    }

    resume() {
        this.msg.reply('繼續播放');
        if (this.me.dispatcher) {
            this.me.dispatcher.resume();
        }
    }

    pauseOrResume() {
        if (this.me.dispatcher.paused) {
            this.resume();
        } else {
            this.pause();
        }
    }
}

// 連上線時的事件
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async (msg) => {
    music = new Music(msg);

    // 如果發送訊息的地方不是語音群（可能是私人），就 return
    if (!msg.guild) return;

    //!!join
    if (msg.content === `.join`) {
        // 如果使用者正在頻道中
        if (msg.member.voice.channel !== null) {
            // Bot 加入語音頻道
            msg.member.voice.channel.join()
                .then(conn => {
                    Bucket.find(msg).connection = conn;
                    msg.channel.send('早安，您好，你這個臭雞雞');
                })
                .catch(e => {
                    sendingError(msg, e);
                });
        } else {
            msg.channel.send('請先進入語音頻道');
        }
    }

    if (msg.content.indexOf('..') > -1) {
        let url = msg.content.slice(2).trim();
        if (url === "") {
            music.pauseOrResume();
        } else {
            music.play(url);
        }
    }

    if (msg.content === `.統神`) {
        music.play('https://www.youtube.com/watch?v=072tU1tamd0');
    }

    if (msg.content === `.bye`) {
        if (Bucket.find(msg).connection && Bucket.find(msg).connection.status === 0) {
            msg.channel.send('ㄅㄅ');
            Bucket.find(msg).connection.disconnect();
        } else {
            msg.channel.send('機器人未加入任何頻道');
        }
    }

    if (msg.content === `.help`) {
        msg.channel.send('^_^ 還沒弄好');
    }
    
    if (msg.content === `.list`) {
        Bucket.find(msg).queue.show(msg);
    }

    if (msg.content.indexOf(`.vol`) > -1) {
        let volume = msg.content.replace(`.vol`, '').trim();

        if (!Bucket.find(msg).dispatcher) {
            msg.reply('^_^ 沒有歌你是在設三小');
        } else if (volume) {
            volume = parseFloat(volume);
            if (isNaN(volume)) {
                msg.reply('Syntax error!');
            } else if (volume < 0 || volume > 1) {
                msg.reply('音量必需介於區間 [0, 1]');
            } else {
                Bucket.find(msg).dispatcher.setVolume(volume);
                if (volume >= 0.9) {
                    msg.reply('tshàu-hī-lâng 逆？');
                }
            }
        }
    }
});

client.login(token);