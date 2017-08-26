var checkError = require('check-error');
var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var youtube_apikey = require('./youtube.json');
var ytdl = require('ytdl-core');
var request = require('superagent');
var url = require('url');
var Saved = require('./lib/saved.js');
//Saved.read();
var YoutubeTrack = require('./lib/youtube-track.js');
var Util = require ('./lib/util.js');
const util = require('util');
var fs = require('fs');

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
var boundChannel = false;
var playQueue = [];
var apikey = youtube_apikey.apikey;

var dmName = 'Misterchainsaw';

bot.on('warn', (m) => logger.info('[warn]', m));
bot.on('debug', (m) => logger.info('[debug]', m));

bot.on('ready', function(evt) {
	logger.info('Connected');
	logger.info('Logged in as: ');
	logger.info(bot.username + ' - (' + bot.id + ')');
	botMention = 'NotStu';
	logger.info(util.inspect(bot, {showHidden: false, depth: 1 }));
});

bot.on('message', (user, userID, channelID, message, evt)  => {
	m = evt.d;
	if ( !botMention ) return;
	if ( bot.id == m.author.id) return;
	logger.info(util.inspect(evt, { showHidden: false, depth: 1}));
	logger.info(user + " - " + userID );
	logger.info("in " + channelID);
	logger.info(message);
	logger.info("----------------");
	if ( !m.content.startsWith(`${botMention} `) ) return;
	if ( m.content.startsWith(`${botMention} i`)) {		
		if ( !checkCommand(m, 'init')) return;
		if ( boundChannel) return;
		logger.info("Initializing...");
		var userChannel = m.author.voiceChannel;
		var channelToJoin = spliceArguments(m.content)[1];
		//logger.info(util.inspect(bot.channels, {showHidden: false, depth: 3}));
		
		//logger.info(util.inspect(channelID, {showHidden: false, depth: 1}));
		for ( var channelName in bot.channels ) {
			logger.info("looking at: " + channelName);
			
			var channel = bot.channels[channelName];
			//logger.info(util.inspect(channel, {showHidden: false, depth: 3 }));
			for ( var memberName in channel.members ) {
				var member = channel.members[memberName];
				logger.info('member: ' + util.inspect(member, {showHidden: false, depth: 1} ));
				if ( member.user_id == userID ) {
					boundChannel = channel;
					bot.sendMessage({
						to : userID,
						message :  `Binding to text channel <#${boundChannel.id}> and voice channel **${channel.name}** \`(${channel.id})\``
						});
					bot.joinVoiceChannel(channel.id);
					break;
				} else {
					bot.sendMessage({
						to : userID, 
						message : "Couldn't join voice channel!"
					});
				}
			}
		}	
	}
	if ( m.content.startsWith(`${botMention} d`)) {
		if ( !checkCommand(m, 'destroy')) return;
		if ( !boundChannel) return;
		bot.sendMessage({ to: userID, message: `Unbinding from <#${boundChannel.id}> and destroying voice connection`});
		playQueue = [];
		bot.leaveVoiceChannel();
		boundChannel = false;
		currentStream = false;
		currentVideo = false;
	}
	if ( m.content.startsWith(`${botMention} q`)) {
		if ( !checkCommand(m, 'query')) return;
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
			
		request(requestUrl, (error, response) => {
			if (!error && response.statusCode == 200) {
				var body = response.body;
				if ( body.items.length == 0 ){
					bot.sendMessage({ to: userID, message: 'Your query gave 0 results.'});
					return;
				}
				
				for ( var item of body.items) {
					if ( item.id.kind === 'youtube#video') {
						var vid = item.id.videoId;
						getInfoAndQueue(vid, m);
						return;
					}
				}
				
				bot.sendMessage({to: userID, message: 'No video has been found!'});
			} else {
				logger.info(util.inspect(response, {showHidden: false, depth: 3 }));
				logger.info(util.inspect(error, {showHidden: false, depth: 3 }));
				bot.sendMessage({to: userID, message: 'Error while searching.'});
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

function getInfoAndQueue(vid, m, suppress) {
	YoutubeTrack.getInfoFromVid(vid, m, (err, video) => {
		if (err) handleYTError(err);
		else {
			logger.info("Queueing " + m.author.id);
			possiblyQueue(video, m.author.id, m, suppress);
		}
	});
}

function parseVidAndQueue(vid, m, suppress) {
	vid = resolve(vid, m);
	if ( !vid) {
		client.sendMessage({to: userID, message : "You need to specify a video!"});
	}
	
	getInfoAndQueue(vid, m, suppress);
}

function possiblyQueue(video, userId, m, suppress) {
	video.userId = userId;
	suppress = (suppress === undefined) ? false : suppress;
	playQueue.push(video);
	if ( suppress == 0 ) fancyReply(m, `Queued ${video.prettyPrint()}`);
	else if (suppress > -1) fancyReply(m, `Queued ${video.prettyPrint()} and ${suppress} other videos`);
	
	if ( !currentVideo) nextInQueue();
}

function handleYTError(err) {
	if ( err.toString().indexOf('Code 150') > -1 ) {
		boundChannel.sendMessage('This video is unavailable in the country in which the bot is running! Please try a different video.');
	} else if ( err.message == 'Could not extract signature deciphering actions') {
		boundChannel.sendMessage('Youtube streams have change their formats, please update `ytdl-core` to account for the change!');
	} else if (err.message == 'status code 404') {
		boundChannel.sendMessage('That video does not exist!');
	} else {
		boundChannel.sendMessage('An error occured while getting video information! Please try a different video.');
	}
	
	logger.error(err.toString() );
}

function playStopped() {
	if ( bot.voiceConnection ) bot.voiceConnection.stopPlaying();
	
	boundChannel.sendMessage(`Finished playing **${currentVideo.title}**`);
	bot.setStatus('online', null);
	lastVideo = currentVideo;
	currentVideo = false;
	nextInQueue();
}

function play(video) {
	currentVideo = video;
	logger.info("Playing video.");
	if ( boundChannel) {
		var res = [];
		for( var m in boundChannel) {
			if( typeof boundChannel[m] == "function" ) {
				logger.info(m);
			}
		}
		logger.info(util.inspect(boundChannel, {showHidden: false, depth: 2}));
		currentStream = video.getStream();
		bot.getAudioContext({channelID: boundChannel.id, maxStreamSize: 50 * 1024}, (error, stream) => {
			if ( error ) {
				logger.error("Error setting up context.");
				logger.error(error);
			} else {
				stream.pipe(stream, {end: false});
				//boundChannel.sendMessage(`Playing ${video.prettyPrint()}`);
				//bot.setStatus('online', video.title);
			}
		});
		currentStream.on('error', (err) => {
			if ( err.code === 'ECONNRESET') {
				boundChannel.sendMessage(`There was a network error during playback! The connection to YouTube may be unstable. Auto-skipping to the next video...`);
			} else {
				boundChannel.sendMessage(`There was an error during playback! **${err}**`);
			}
			
			playStopped();
		});
		
		currentStream.on('end', () => setTimeout(playStopped, 8000));
		connection.playRawStream(currentStream).then(intent => {
			boundChannel.sendMessage(`Playing ${video.prettyPrint()}`);
			bot.setStatus('online', video.title);
		});
	} else {
		logger.info(util.inspect(bot, {showHidden: false, depth: 2}));
		logger.error("Bot is not connected to voice.");
	}
}
function nextInQueue() {
	if ( playQueue.length > 0 ) {
		logger.info("Playing next song...");
		next = playQueue.shift();
		play(next);
	}
}

function fancyReply(m, message) {
	if ( shouldStockpile ) {
		stockpile += message + '\n';
	} else {
		bot.sendMessage({ to: m.author.id, message: message});
	}
}
