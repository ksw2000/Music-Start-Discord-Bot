const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const token = require('process').env.DiscordToken || require('./token.json').token;
const fs = require('fs');

class Util {
    // @params mu: Music
    static left(msg, mu) {
        if (Bucket.find(msg).connection && Bucket.find(msg).connection.status === 0) {
            msg.channel.send('ㄅㄅ');
            mu.pause();
            Bucket.find(msg).connection.disconnect();
        }
    }

    static help(msg) {
        let helpText = fs.readFileSync('help.md', {
            encoding: 'utf-8',
            flag: 'r'
        });
        msg.channel.send(helpText);
    }

    // @param num: Integer
    static humanReadNum(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    static async attach(msg) {
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
        return emojis[~~(Math.random() * emojis.length)];
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

    // volume: Float [0, 1]
    static setVolume(msg, volume) {
        volume = parseFloat(volume);
        if (isNaN(volume)) {
            this.sendErr(msg, 'Syntax error!');
        } else if (volume < 0 || volume > 1) {
            this.sendErr(msg, '音量必需介於區間 [0, 1]');
        } else {
            Bucket.find(msg).volume = volume;
            Bucket.find(msg).dispatcher.setVolume(volume);
        }
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
        this.volume = .64;
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

    get info() {
        return this.list[this.index];
    }

    _genericIndex(index) {
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

    remove(index) {
        index = this._genericIndex(index);
        if (index <= this.index) {
            this.index--;
        }
        this.list.splice(index, 1);
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

    shuffle() {
        for (let i = 0; i < this.len; i++) {
            let j = ~~(Math.random() * i);
            if (i != j && i != this.index && j != this.index) {
                // swap i and j
                let tmp = this.list[i]
                this.list[i] = this.list[j]
                this.list[j] = tmp
            }
        }
    }

    reset() {
        this.list = [];
        this.index = 0;
    }

    sort(){
        this.list.sort((a, b)=>{
            return a.title.localeCompare(b.title)
        });
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
        this.startAt = 0;
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
    async playQueue(q, callback) {
        let queue = q || this.me.queue;
        let info = queue.info;
        try {
            // if not joined yet
            if (this.me.connection === null) {
                await Util.attach(this.msg);
            }

            const src = ytdl(info.url, { filter: 'audioonly' });
            this.me.dispatcher = this.me.connection.play(src, {
                seek: this.startAt,
                volume: this.me.volume,
                bitrate: 'auto',
                highWaterMark: 1024,
                plp: .1,
                fec: true
            });

            this.me.playing = true;
            if(callback){
                callback(info);
            }

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

    showInfoCard(info){
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
    }

    pause() {
        if (this.me.dispatcher) {
            this.me.dispatcher.pause();
            this.me.pauseAt = this.me.dispatcher.streamTime;
        }
    }
    
    resume() {
        if (this.me.dispatcher) {
            this.seek(this.me.pauseAt / 1000)
        }
    }
    
    pauseOrResume() {
        if (this.me.dispatcher.paused) {
            this.msg.reply('繼續播放');
            this.resume();
        } else {
            this.msg.reply('暫停');
            this.pause();
        }
    }
    
    async stop() {
        this.me.queue.jump(0);
        await this.playQueue(this.me.queue, this.showInfoCard);
        this.pause();
        this.me.pauseAt = 0;
    }

    // @param time: Number (unit: seconds)
    async seek(time){
        if (this.me.dispatcher) {
            this.me.dispatcher.pause();
            this.startAt = time;
            this.playQueue(this.me.queue, (info)=>{
                this.showInfoCard(info);
                this.startAt = 0;
            });
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
        case 'attach':
            Util.attach(msg);
            break;
        case 'bye':
            Util.left(msg, mu);
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
        case 'ls':
            me.queue.show(msg);
            break;
        case 'shuffle': //shuffle the queue
            me.queue.shuffle();
            break;
        case 'clear': // reset the queue
            me.queue.reset();
            msg.channel.send(`已刪除播放清單！`);
            break;
        case 'sort':
            me.queue.sort();
            break;
        case 'stop':
            mu.stop();
            msg.channel.send('> 停止播放，輸入 .. 以恢復');
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

    // .vol can set or get volume
    if (msg.content.startsWith(`.vol`)) {
        let vol = msg.content.replace(`.vol`, '').trim();
        if (vol === "") {
            msg.channel.send(`目前音量：${Bucket.find(msg).volume}`)
        } else {
            Util.setVolume(msg, vol);
            msg.channel.send(`已設定音量為：${Bucket.find(msg).volume}`)
        }
    }

    // .seek
    if (msg.content.startsWith(`.seek`)) {
        let time = msg.content
            .replace('.seek', '')
            .trim();
        let timepart = time.split(':');
        let secs = 0;
        for(let i=timepart.length-1, j=0; i>=0; i--, j++){
            secs += Number(timepart[i]) * (60 ** j);
        }
        
        try {
            mu.seek(secs)
        } catch (e) {
            Util.senderr(msg, e);
        }
    }
});

client.login(token);