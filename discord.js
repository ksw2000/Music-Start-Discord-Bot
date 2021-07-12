const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const token = require('process').env.DiscordToken || require('./token.json').token;

class Util {
    static bye(msg) {
        if (Bucket.find(msg).connection && Bucket.find(msg).connection.status === 0) {
            msg.channel.send('ㄅㄅ');
            Bucket.find(msg).connection.disconnect();
        } else {
            msg.channel.send('機器人未加入任何頻道');
        }
    }

    static help(msg) {
        msg.channel.send('^_^ 還沒弄好');
    }

    // @param num: Integer
    static humanReadNum(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    static async join(msg) {
        // 如果使用者正在頻道中
        if (msg.member.voice.channel !== null) {
            // Bot 加入語音頻道
            await msg.member.voice.channel.join().then(conn => {
                Bucket.find(msg).connection = conn;
                msg.channel.send(`☆歡迎使用 Music Start! ${Util.randomHappy()} ☆`);
            }).catch(e => {
                Util.sendErr(msg, e);
            });
        } else {
            msg.channel.send('請先進入語音頻道');
        }
    }

    static randomHappy() {
        const emojis = ['(*´∀`)~♥', 'σ`∀´)σ', '(〃∀〃)', '(శωశ)', '(✪ω✪)', '(๑´ㅂ`๑)', '(◕ܫ◕)', '( • ̀ω•́ )'];
        return emojis[Math.floor(Math.random() * emojis.length)];
    }

    static sendEmbed(msg, title, description) {
        const embed = new Discord.MessageEmbed()
            .setTitle(title)
            .setColor(0x33DFFF)
            .setDescription(description);
        msg.channel.send(embed);
    }

    static sendErr(msg, error) {
        msg.channel.send(`> 錯誤 \n > ${error}`);
    }
}

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
        return Bucket.instant[msg.guild.id] || new Bucket(msg);
    }
}

class Queue {
    constructor() {
        // this.list: Array(MusicInfo)
        this.list = [];
        this.index = 0;
    }

    get len() {
        return this.list.length;
    }

    get info(){
        return this.list[this.index];
    }

    _genericIndex(index){
        index = index % this.len;
        return (index < 0) ? index + this.len : index;
    }

    isEmpty() {
        this.len === 0;
    }

    en(url) {
        this.list.push(url);
    }

    next(num) {
        return this.jump(this.index + num);
    }

    // @param index can be any integer.
    jump(index) {
        if (this.isEmpty()) throw ('播放清單是空的');
        this.index = this._genericIndex(index);
        return this.list[this.index];
    }
    
    remove(index){
        this.list.splice(this._genericIndex(index), 1);
    }

    show(msg) {
        if (this.isEmpty()) {
            sendEmbed(msg, '無播放清單', '');
        } else {
            let text = '';
            for (const [index, info] of this.list.entries()) {
                if (index == this.index && Bucket.find(msg).playing) {
                    text += `**${index}.\t${info.title}**\n`;
                } else {
                    text += `${index}.\t${info.title}\n`;
                }
            }
            Util.sendEmbed(msg, '播放清單', text);
        }
    }
}

class MusicInfo {
    constructor(url, title, likes, viewCount) {
        this.url = url;
        this.title = title;
        this.likes = likes;
        this.viewCount = viewCount;
    }

    static fromDetails(detail) {
        if (!detail.videoId) return null;
        let url = `https://www.youtube.com/watch?v=${detail.videoId}`;
        let title = detail.title || "";
        let viewCount = detail.viewCount || -1;
        let likes = detail.likes || -1;
        return new MusicInfo(url, title, likes, viewCount);
    }
}

class Music {
    constructor(msg) {
        this.msg = msg;
        this.me = Bucket.find(msg);
    }

    async play(url) {
        // 如果使用者在語音頻道中
        if (this.msg.member.voice.channel) {
            try {
                const res = await ytdl.getInfo(url);
                const info = MusicInfo.fromDetails(res.videoDetails);
                if (info === null) throw ('無法載入音樂');

                this.me.queue.en(info);

                if (!this.me.playing) this.playQueue();
            } catch (e) {
                Util.sendErr(this.msg, e);
            }
        } else {
            // 如果使用者不在任何一個語音頻道
            this.msg.reply('你必須先加入語音頻道');
        }
    }

    // @param q: Queue
    async playQueue(q) {
        let queue = q || this.me.queue;
        let info = queue.info;
        try {
            // if not joined yet
            if (this.me.connection === null) {
                await Util.join(this.msg);
            }

            const src = ytdl(info.url, { filter: 'audioonly' });
            this.me.dispatcher = this.me.connection.play(src, {
                volume: .64,
                bitrate: 128,
                highWaterMark: 1024,
                plp: 0.5,
                fec: true
            });

            let description = '';

            if (info.viewCount != -1) {
                description += `:eyes:　${Util.humanReadNum(info.viewCount)}`;
            }
            if (info.likes != -1) {
                if (info.likes != -1) {
                    description += '　';
                }
                description += `:heart:　${Util.humanReadNum(info.likes)}`;
            }

            Util.sendEmbed(this.msg, info.title, description)
            this.me.playing = true;

            this.me.dispatcher.on('finish', () => {
                this.me.playing = false;

                // goto next
                queue.next(1);
                this.playQueue();
            });

            this.me.dispatcher.on('error', (e) => {
                Util.sendErr(this.msg, e);
            });
        } catch (e) {
            this.me.playing = false;
            Util.sendErr(this.msg, e);
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

const client = new Discord.Client();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async (msg) => {
    // 如果發送訊息的地方不是語音群（可能是私人），就 return
    if (!msg.guild) return;
    if (!msg.content.startsWith('.')) return;

    const mu = new Music(msg);
    const me = Bucket.find(msg);
    const content = msg.content.slice(1).trim();

    // Handle ..*
    // ..[url] Play music on Youtube by url
    // ..      Pause or Resume
    if (msg.content.startsWith('..')) {
        let url = msg.content.slice(2).trim();
        if (url === "") {
            mu.pauseOrResume();
        } else {
            mu.play(url);
        }
    }

    // Handle .*
    switch (content) {
        // Join this bot to voice channel
        case 'join':
            Util.join(msg);
            break;
        case 'bye':
            Util.bye(msg);
            break;
        case 'help':
            Util.help(msg);
            break;
        case 'next':
            me.queue.next(1)
            mu.playQueue();
            break;
        case 'pre':
            me.queue.next(-1)
            mu.playQueue();
            break;
        case 'list':
            me.queue.show(msg);
            break;
        case '統神':
            mu.play('https://www.youtube.com/watch?v=072tU1tamd0');
            break;
    }

    // .jmp, .jump jump to the # of songs in the queue
    if (msg.content.startsWith(`.jmp`) || msg.content.startsWith(`.jump`)) {
        let index = msg.content
            .replace('.jmp', '')
            .replace('.jump', '')
            .trim();
        try {
            me.queue.jump(parseInt(index));
            mu.playQueue();
        } catch (e) {
            Util.senderr(msg, e);
        }
    }

    // .rm, .remoev remove the # of songs
    if (msg.content.startsWith(`.rm`) || msg.content.startsWith(`.remove`)) {
        let index = msg.content
            .replace('.rm', '')
            .replace('.remove', '')
            .trim();
        try {
            me.queue.remove(parseInt(index));
        } catch (e) {
            Util.senderr(msg, e);
        }
    }

    // .vol can set volume
    if (msg.content.startsWith(`.vol`)) {
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
});

client.login(token);