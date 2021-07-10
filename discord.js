// reference:
// https://b-l-u-e-b-e-r-r-y.github.io/post/DiscordBot02

const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const { token } = require('./token.json');
const client = new Discord.Client();

// 連上線時的事件
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// https://discord.js.org/#/docs/main/stable/class/VoiceConnection
let connection = {};

// https://discord.js.org/#/docs/main/stable/class/StreamDispatcher
let dispatcher = {};

let playing = {};

function sendingError(msg, error) {
    msg.channel.send(`> 錯誤 \n > ${error}`);
}

class Bucket{
    static instant = {};
    // 利用 msg.guild.id
    constructor(msg){
        this.id = msg.guild.id;
        this.dispatcher = null;
        this.connection = null;
        this.queue = null;
        this.playing = false;
        instant[msg.guild.id] = this;
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
    static map = {};

    static isEmpty(msg) {
        if (typeof Queue.map[msg.guild.id] === 'undefined') return true;
        return Queue.map[msg.guild.id].length === 0;
    }

    static en(msg, url) {
        if (Queue.isEmpty(msg)) Queue.map[msg.guild.id] = {
            list: [],
            index: 0
        };
        Queue.map[msg.guild.id].list.push(url);
    }

    static next(msg) {
        if (Queue.isEmpty(msg)) throw ('queue is empty');
        Queue.map[msg.guild.id].index = (Queue.map[msg.guild.id].index + 1) % Queue.map[msg.guild.id].list.length
        return Queue.map[msg.guild.id].list[Queue.map[msg.guild.id].index]
    }

    static show(msg) {
        if (Queue.isEmpty(msg)) {
            msg.reply('無播放清單');
        } else {
            let text = '';
            for (let i = 0; i < Queue.map[msg.guild.id].list.length; i++) {
                text += `> ${i}. ${Queue.map[msg.guild.id].list[i]}\n`
            }
            msg.reply(text);
        }
    }
}

class Music {
    static play(msg, url) {
        // 如果使用者在語音頻道中
        if (msg.member.voice.channel) {
            Queue.en(msg, url);
            if (!Music.isNowPlaying(msg)){
                Music.playQueue(msg, url);
            }
        } else {
            // 如果使用者不在任何一個語音頻道
            msg.reply('你必須先加入語音頻道');
        }
    }

    static async playQueue(msg, url) {
        try {
            const res = await ytdl.getInfo(url);
            const info = res.videoDetails;
            dispatcher[msg.guild.id] = connection[msg.guild.id].play(ytdl(url, { filter: 'audioonly' }), {
                volume: .64,
                bitrate: 128,
                highWaterMark: 1024,
                plp: 0.5,
                fec: true
            });

            msg.channel.send(`> 正在播放：${info.title}`);
            playing[msg.guild.id] = true;

            dispatcher[msg.guild.id].on('finish', () => {
                playing[msg.guild.id] = false;
                
                // goto next
                Music.playQueue(msg, Queue.next(msg));
            });

            dispatcher[msg.guild.id].on('error', () => {
                sendingError(msg, e);
            });
        } catch (e) {
            playing[msg.guild.id] = false;
            sendingError(msg, e);
        }
    }

    static isNowPlaying(msg){
        if (typeof playing[msg.guild.id] === 'undefined') return false;
        return playing[msg.guild.id];
    }

    static pause(msg) {
        msg.reply('暫停');
        if (dispatcher[msg.guild.id]) {
            dispatcher[msg.guild.id].pause();
        }
    }

    static resume(msg) {
        msg.reply('繼續播放');
        if (dispatcher[msg.guild.id]) {
            dispatcher[msg.guild.id].resume();
        }
    }

    static pauseOrResume(msg) {
        if (dispatcher[msg.guild.id].paused) {
            Music.resume(msg);
        } else {
            Music.pause(msg);
        }
    }
}

client.on('message', async (msg) => {
    // 如果發送訊息的地方不是語音群（可能是私人），就 return
    if (!msg.guild) return;

    //!!join
    if (msg.content === `.join`) {
        // 如果使用者正在頻道中
        if (msg.member.voice.channel !== null) {
            // Bot 加入語音頻道
            msg.member.voice.channel.join()
                .then(conn => {
                    connection[msg.guild.id] = conn;
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
            Music.pauseOrResume(msg);
        } else {
            Music.play(msg, url);
        }
    }

    if (msg.content === `.いたい` || msg.content === `.統神`) {
        Music.play(msg, 'https://www.youtube.com/watch?v=072tU1tamd0');
    }

    if (msg.content === `.bye`) {
        if (connection[msg.guild.id] && connection[msg.guild.id].status === 0) {
            msg.channel.send('ㄅㄅ');
            connection[msg.guild.id].disconnect();
        } else {
            msg.channel.send('機器人未加入任何頻道');
        }
    }

    if (msg.content === `.help`) {
        msg.channel.send('^_^ 還沒弄好');
    }
    
    if (msg.content === `.list`) {
        Queue.show(msg);
    }

    if (msg.content.indexOf(`.vol`) > -1) {
        let volume = msg.content.replace(`.vol`, '').trim();

        if (!dispatcher[msg.guild.id]) {
            msg.reply('^_^ 沒有歌你是在設三小');
        } else if (volume) {
            volume = parseFloat(volume);
            if (isNaN(volume)) {
                msg.reply('Syntax error!');
            } else if (volume < 0 || volume > 1) {
                msg.reply('音量必需介於區間 [0, 1]');
            } else {
                dispatcher[msg.guild.id].setVolume(volume);
                if (volume >= 0.9) {
                    msg.reply('tshàu-hī-lâng 逆？');
                }
            }
        }
    }
});

client.login(token);