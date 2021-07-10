// reference:
// https://b-l-u-e-b-e-r-r-y.github.io/post/DiscordBot02

const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const { token } = require('./token.json');
const client = new Discord.Client();

class Bucket {
    static instant = {};
    // 利用 msg.guild.id
    constructor(msg) {
        this.id = msg.guild.id;
        // https://discord.js.org/#/docs/main/stable/class/VoiceConnection
        this.connection = null;
        // https://discord.js.org/#/docs/main/stable/class/StreamDispatcher
        this.dispatcher = null;
        this.queue = new Queue();
        this.playing = false;
        Bucket.instant[msg.guild.id] = this;
    }

    static find(msg) {
        if (typeof Bucket.instant[msg.guild.id] === 'undefined') {
            return new Bucket(msg);
        } else {
            return Bucket.instant[msg.guild.id];
        }
    }
}

class Queue {
    constructor() {
        this.list = [];
        this.index = 0;
    }

    isEmpty() {
        this.list.length === 0;
    }

    en(url) {
        this.list.push(url);
    }

    next(num) {
        if (this.isEmpty()) throw ('Queue is empty');
        this.index = (this.index + num) % this.list.length
        if (this.index < 0) {
            this.index += this.list.length
        }
        return this.list[this.index]
    }

    pre(num) {
        return this.next(num);
    }

    show(msg) {
        if (this.isEmpty()) {
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
    constructor(msg) {
        this.msg = msg;
        this.me = Bucket.find(msg);
    }

    play(url) {
        // 如果使用者在語音頻道中
        if (this.msg.member.voice.channel) {
            this.me.queue.en(url);
            if (!this.me.playing) {
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

            // if not joined yet
            if (this.me.connection === null) {
                await join(this.msg);
            }
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
                this.playQueue(this.me.queue.next(1));
            });

            this.me.dispatcher.on('error', (e) => {
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

function sendingError(msg, error) {
    msg.channel.send(`> 錯誤 \n > ${error}`);
}

async function join(msg) {
    // 如果使用者正在頻道中
    if (msg.member.voice.channel !== null) {
        // Bot 加入語音頻道
        await msg.member.voice.channel.join().then(conn => {
            Bucket.find(msg).connection = conn;
            msg.channel.send('☆歡迎使用 Music Start!☆');
        }).catch(e => {
            sendingError(msg, e);
        });
    } else {
        msg.channel.send('請先進入語音頻道');
    }
}

// 連上線時的事件
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async (msg) => {

    // 如果發送訊息的地方不是語音群（可能是私人），就 return
    if (!msg.guild) return;

    const mu = new Music(msg);
    const me = Bucket.find(msg);

    // .join: Join this bot to voice channel
    if (msg.content === `.join`) {
        join(msg);
    }

    // ..[url] Play music on Youtube by url
    // ..      Pause or Resume
    if (msg.content.indexOf('..') > -1) {
        let url = msg.content.slice(2).trim();
        if (url === "") {
            mu.pauseOrResume();
        } else {
            mu.play(url);
        }
    }

    // .bye End task
    if (msg.content === `.bye`) {
        if (me.connection && me.connection.status === 0) {
            msg.channel.send('ㄅㄅ');
            me.connection.disconnect();
        } else {
            msg.channel.send('機器人未加入任何頻道');
        }
    }

    // .help prints help message
    if (msg.content === `.help`) {
        msg.channel.send('^_^ 還沒弄好');
    }

    if (msg.content === `.next`) {
        mu.playQueue(me.queue.next(1));
    }

    if (msg.content === `.pre`) {
        mu.playQueue(me.queue.pre(1));
    }

    // .list show list
    if (msg.content === `.list`) {
        me.queue.show(msg);
    }

    // .vol can set volume
    if (msg.content.indexOf(`.vol`) > -1) {
        let volume = msg.content.replace(`.vol`, '').trim();

        if (!me.dispatcher) {
            msg.reply('^_^ 沒有歌你是在設三小');
        } else if (volume) {
            volume = parseFloat(volume);
            if (isNaN(volume)) {
                msg.reply('Syntax error!');
            } else if (volume < 0 || volume > 1) {
                msg.reply('音量必需介於區間 [0, 1]');
            } else {
                me.dispatcher.setVolume(volume);
                if (volume >= 0.9) {
                    msg.reply('tshàu-hī-lâng 逆？');
                }
            }
        }
    }

    if (msg.content === `.統神`) {
        mu.play('https://www.youtube.com/watch?v=072tU1tamd0');
    }
});

client.login(token);