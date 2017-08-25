var checkError = require('check-error');
var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var youtube_apikey = require('./youtube.json');
var ytdl = require('ytdl-core');
var request = require('superagent');
var url = require('url');
var Saved = require('./lib/saved.js');
var Util = require ('./lib/util.js');
const util = require('util');

logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, { colorize : true });
logger.level = 'debug';

var bot = new Discord.Client({
	token: auth.token,
	autorun: true
});

var currentVideo = false;
var lastVideo = false;
var botMention = false;
var shouldStockpile = false;
var stockpile = '';

var apiKey = youtube_apikey.apikey;

var dmName = 'Misterchainsaw';

bot.on('warn', (m) => logger.info('[warn]', m));
bot.on('debug', (m) => logger.info('[debug]', m));

bot.on('ready', function(evt) {
	logger.info('Connected');
	logger.info('Logged in as: ');
	logger.info(bot.username + ' - (' + bot.id + ')');
	botMention = 'NotStu';
	//logger.info(util.inspect(bot, {showHidden: false, depth: 1 }));
});

bot.on('message', (user, userID, channelID, message, evt)  => {
	m = evt.d;
	logger.info(util.inspect(m, {showHidden: false, depth: 1}));
	if ( !botMention ) return;
	if ( bot.id == m.author.id) return;
	if ( !m.content.startsWith(`${botMention} `) ) return;
	
	if ( m.content.startsWith(`${botMention} i`)) {
		if ( checkCommand(m, 'init')) return;
		if ( boundchannel) return;
		var userChannel = m.author.voiceChannel;
		var channelToJoin = spliceArguments(m.content)[1];
		for ( var channel of m.channel.server.channels ){
			if ( channel instanceof Discord.VoiceChannel) {
				if ( !chanelToJoin ) {
					boundChannel = m.channel;
					if ( userChannel) {
						bot.reply(m, `Binding to text channel <#${boundChannel.id}> and voice channel **${userChannel.name}** \`(${userChannel.id})\``);
						bot.joinVoiceChannel(userChannel).catch(error);
					} else {
						bot.reply(m, `Binding to text channel <#${boundChannel.id}> and voice channel **{channel.name}** \`(${channel.id})\``);
						bot.joinVoiceChannel(channel).catch(error);
					}
					break;
				}
			}
		}
	}
	if ( m.content.startsWith(`${botMention} d`)) {
		if ( checkCommand(m, 'destroy')) return;
		if ( !boundChannel) return;
		bot.reply(m, `Unbinding from <#{boundChannel.id}> and destroying voice connection`);
		playQueue = [];
		bot.internal.leaveVoiceChannel();
		boundChannel = false;
		currentStream = false;
		currentVideo = false;
	}
	if ( m.content.startsWith(`${botMention} q`)) {
		if ( checkCommand(m, 'query')) return;
		if ( !apikey ) {
			bot.reply(m, 'apikey not set up.');
			return;
		}
		
		var args = spliceArguments(m.content)[1];
		
		if (!args) {
			bot.reply(m, 'You need to specify a search parameter.');
			return;
		}
		
		var requestUrl = 'https://www.googleapis.com/youtube/v3/search' +
			`?part=snippet&q=${escape(args)}&key=${apikey}`;
			
		request(RequestUrl, (error, response) => {
			if (!error && response.statusCode == 20) {
				var body = rseponse.body;
				if ( body.items.length == 0 ){
					bot.reply(m, 'Your query gave 0 results.');
					return;
				}
				
				for ( var item of body.items) {
					if ( item.id.kind === 'youtube#video') {
						var vid = item.id.videoId;
						getInfoAndQueue(vid, m);
						return;
					}
				}
				
				bot.reply(m, 'No video has been found!');
			} else {
				bot.reply(m, 'Error while searching.');
				return;
			}
		});
		
		return;
	}
	
	if ( m.content.startsWith(`${botMention} y`) ) {
		if(!checkCommand(m, 'yt')) return;
		
		var vidList = spliceArguments(m.content)[1];
		
		var vids = vidList.split(',');
		var suppress = 0;
		vids.forEach((vid, idx) => {
			if (idx == 1) suppress = vids.length -2;
			if (idx == 2) suppress = -1;
			parseVidAndQueue(vid, m, suppress);
		});
		return;
	}
}
);

function spliceArguments(message, after) {
	after = after || 2;
	var rest = message.split(' ');
	var removed = rest.splice(0, after);
	return [removed.join(' '), rest.join(' ')];
}

function checkCommand(m, command) {
	//Handle whether they have permissions
	return true;
}
