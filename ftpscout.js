#! /usr/bin/env node

/*===============================
=            REQUIRE            =
===============================*/
/*==========  common  ==========*/
var fs = require('fs');
var path = require('path');
var readline = require('readline');

/*==========  CLI  ==========*/
var parser = require('nomnom');

/*==========  FTP  ==========*/
var ftpClient = require('ftp');

/*==========  minifyers  ==========*/
var ucss = require('sqwish'); // css minifier
var ujs = require("uglify-js");
/*-----  End of REQUIRE  ------*/

/**
*
* PRIVATE METHODS !!!
*
**/

/*======================================
=            HELPER METHODS            =
======================================*/
/*==========  onConfigReady  ==========*/
var config;
var configFile = "ftpScoutConfig.json";
var onConfigReady = function(callback) {
	// check if config is already stored in memory
	if (typeof config != 'undefined') {
		callback(config);
	// ask for config and call callback when config becomes ready
	} else {
		fs.readFile(configFile, function (error, data) {
			if (error) {
				if (fs.existsSync(configFile)) {
					throw new Error("Config file '" + configFile + "' cannot be read! Are you sure it exists?");
				} else {
					console.log("> It seems config file '" + configFile + "' doesn't exists.");
					console.log("> Starting 'init' method to create config file.");
					init();
				}
			} else {
				config = JSON.parse(data);
				callback(config);
			}
		});
	}
}

/*==========  writeConfigFile  ==========*/
var writeConfigFile = function () {
	if(typeof config != 'undefined') {
		fs.writeFile(configFile, JSON.stringify(config, null, 2), function (error) {
			// check if gitignore file exists and add config file to list
			if (fs.existsSync('.gitignore')) {
				fs.appendFileSync('.gitignore', "\r\nftpScoutConfig.json");
			}
			if(error) {
				throw new Error("There was a problem with writing config file '" + configFile + "'!");
			} else {
				console.log("> config file was written to: '" + configFile + "'!");
			}
		});
	} else {
		throw new Error("Config data doesn't exists!");
	}
}

/*==========  addInfoTo  ==========*/
var addInfoTo = function(content) {
	// method presumes config is already set (by parent), otherwise we couldn't run this method.
	var addContent = "";
	addContent += "/*=============================*/\n";
	addContent += "/*=            ABOUT          =*/\n";
	addContent += "/*=============================*/\n";
	addContent += "/*\n";

	for(var key in config.info) {
		if (config.info[key] != "") {
			addContent += key + ": " + config.info[key] + "\n";
		}
	}

	addContent += "*/\n";
	addContent += "/*-----  End of ABOUT  ------*/\n";

	return addContent + content;
}

/*==========  fileWatcher  ==========*/
// update global values
var gminify;
var ginfo;
var gsafe;
var gbackup;
var fileWatcher = function(file, gminify, ginfo, gsafe, gbackup) {
	if(gminify) {
		var ext = path.extname(file), name = path.basename(file, ext);
		if (ext === '.js' || ext === '.css') {
			minifyAndUpdate(file, ginfo, gsafe, gbackup);
		} else {
			justUpdate(file, ginfo, gsafe, gbackup);
		}
	} else {
		justUpdate(file, ginfo, gsafe, gbackup);
	}
}

/*-----  End of HELPER METHODS  ------*/

/*==========================================
=            FTP HELPER METHODS            =
==========================================*/
var ftpPut = function(ftp, file, callback) {
	ftp.put(file, config.server.folder + file, function (error) {
      	if (error) {
      		if (fs.existsSync(file)) {
				console.log("> file '" + file + "' does not exists in local folder!");
				ftp.destroy();
			} else {
				console.log("> there seems to be a problem with ftp upload. Error says: " + error);
				ftp.destroy();
      		}
      	} else {
      		ftp.end();
      		callback(file);
      	}
    });
}
var safeUpload = function(file, backup, callback) {
	onConfigReady(function(config) {
		var ftp = new ftpClient();

		ftp.connect({
			host: config.server.host,
	  		port: config.server.port,
	  		user: config.server.username,
	  		password: config.server.password
		});

		ftp.on('ready', function(){
			ftp.list(config.server.folder + file, function(err, res){			
				if (typeof res[0] !== undefined && typeof res[0] !== 'undefined'){
					if (Date.parse(fs.statSync(file).mtime) >= Date.parse(res[0].date)) {
						if (backup) {
							var ext = path.extname(file), name = path.basename(file, ext);
							ftp.get(config.server.folder + file, function (error, stream) {
						    	if (error) {
						    		throw error;
						    	} else {
						    		stream.pipe(fs.createWriteStream(name + "_backup_" + Date.now() + ext));
						    		ftpPut(ftp, file, callback);
						    	}
						    });
						} else {
							ftpPut(ftp, file, callback);
						}
					} else {
						console.log("> local file '" + file + "' is older than the one in remote folder!");
						ftp.destroy();
					}
				} else {
					console.log("> file '" + config.server.folder + file + "' does not exists on server!");
					ftp.destroy();
				}
			});
		});
	});
}

var normalUpload = function(file, backup, callback) {
	onConfigReady(function(config) {
		var ftp = new ftpClient();

		ftp.connect({
			host: config.server.host,
	  		port: config.server.port,
	  		user: config.server.username,
	  		password: config.server.password
		});

		ftp.on('ready', function(){
			if (backup) {
				var ext = path.extname(file), name = path.basename(file, ext);
				ftp.get(config.server.folder + file, function (error, stream) {
			    	if (error) {
			    		throw new Error("There was a problem with uploading file " + file + ". Are you sure that remote path is correct?");
			    	} else {
			    		stream.pipe(fs.createWriteStream(name + "_backup_" + Date.now() + ext));
			    		ftpPut(ftp, file, callback);
			    	}
			    });
			} else {
				ftpPut(ftp, file, callback);
			}
		});
	});
}
/*-----  End of FTP HELPER METHODS  ------*/

/*=============================================
=            UPLOAD HELPER METHODS            =
=============================================*/
var upload = function (file, safe, backup, callback) {
	if (safe) {
		safeUpload(file, backup, callback);
	} else {
		normalUpload(file, backup, callback);
	}
}
var minifyAndUpdate = function(file, info, safe, backup) {
	var ext = path.extname(file), name = path.basename(file, ext);
	var orgFile = name + "_org" + ext;
	fs.unwatchFile(file);
	var content = fs.readFileSync(file).toString();
	fs.renameSync(file, orgFile);

	// minify file
	if (ext === '.js') {
		var newContent = ujs.minify(content, {fromString: true}).code;
	} else if (ext === '.css') {
		var newContent = ucss.minify(content);
	}

	// add information
	if (info) newContent = addInfoTo(newContent);

	// write new file
	fs.writeFile(file, newContent, function (error) {
		if (error) throw error;

		// upload new file
		upload(file, safe, backup, function(file){
			fs.unlinkSync(file);
			fs.renameSync(orgFile, file);
			fs.watchFile(file, function(curr, prev){
				fileWatcher(file, gminify, ginfo, gsafe);
			});

			var now = new Date(Date.now()).toTimeString();
			console.log("> file " + file + " uploaded at: " + now);
		});
	});
}

var justUpdate = function(file, info, safe, backup) {
	var ext = path.extname(file), name = path.basename(file, ext);
	var orgFile = name + "_org" + ext;
	if (info && (ext === '.js' || ext === '.css')) {
		fs.unwatchFile(file);

		// add info
		var content = fs.readFileSync(file).toString();
		content = addInfoTo(content);

		fs.renameSync(file, orgFile);
		fs.writeFileSync(file, content);

		// upload new file
		upload(file, safe, backup, function(file){
			var now = new Date(Date.now()).toTimeString();
			console.log("> file " + file + " was uploaded successfully at: " + now);
			fs.unlinkSync(file);
			fs.renameSync(orgFile, file);
			fs.watchFile(file, function(curr, prev){
				fileWatcher(file, gminify, ginfo, gsafe);
			});
		});
	} else {
		// upload file 
		upload(file, safe, backup, function(file){
			var now = new Date(Date.now()).toTimeString();
			console.log("> file " + file + " was uploaded successfully at: " + now);
		});
	}
}
/*-----  End of UPLOAD HELPER METHODS  ------*/

/**
*
* PUBLIC METHODS !!!
*
**/

/*=============================================
=            PUBLIC HELPER METHODS            =
=============================================*/
/*==========  INIT  ==========*/
var init = function() {
	if (typeof config == 'undefined' && !fs.existsSync(configFile)) {
		var now = new Date(Date.now());
		config = {
			info: {},
			server: {},
			watchlist: []
		};

		// start dialog to get data
		var rl = readline.createInterface(process.stdin, process.stdout, null);

		// get data
		rl.setPrompt('➜');
		console.log("\n\n /*** watchlist ***/");
		rl.question("Write filepaths of files that you want to add to watch list (using ',' or ' ' as divider): ", function(answer){
			if (answer != "") {
				var filepaths = answer.split(" ") || answer.split(",");
				filepaths.forEach(function(item) {
					if (fs.existsSync(item)) {
						config.watchlist.push(item);
					} else {
						console.log("> File '" + item + "' was not found and was not added to watchlist!");
					}
				});

				console.log("\n\n /*** server settings ***/");
				rl.question("Server host: ", function(answer){
					config.server.host = answer;

					rl.question("Server username: ", function(answer){
						config.server.username = answer;

						rl.question("Server password: ", function(answer){
							config.server.password = answer;

							rl.question("Server port: (21) ", function(answer){
								if (answer == "") answer = 21;
								config.server.port = answer;

								rl.question("Server (project) folder: (/) ", function(answer){
									if (answer == "") answer = "/";
									config.server.folder = answer;
									rl.close();
								});
							});
						});
					});
				});
			} else {
				throw new Error("Please put at least one file to watch!");
			}
		});

		// create and write data to file
		rl.on('close', function(){
			fs.readFile("package.json", function(error, packageRaw){
				if (error) {
					if (fs.existsSync("package.json")) {
						console.log("> package.json file exists, but cannot be read. You can add information to '" + configFile + "' manually.");
					} else {
						console.log("> package.json file doesn't exists. You can add information to '" + configFile + "' manually.");
					}
					config.info = {
						author: "",
						published: now.toLocaleDateString(),
						description: "",
						license: "",
						contact: "",
						link: ""
					}
				} else {
					var packageJSON = JSON.parse(packageRaw);
					config.info = {
						author: packageJSON.author || "",
						description: packageJSON.description || "",
						license: packageJSON.license || "",
						contact: "",
						link: ""
					};
				}
				writeConfigFile();
			});	
		});
	} else {
		console.log("> File '" + configFile + "'' already exists!");
		console.log("> You can use add and remove methods to update it.");
	}
};

/*==========  ADD  ==========*/
var add = function(filepaths) {
	onConfigReady(function(config) {
		var count = 0;
		if (typeof filepaths === 'string') filepaths = filepaths.split(" ") || filepaths.split(",");
		filepaths.forEach(function(item) {
			if (fs.existsSync(item)) {
				if (config.watchlist.indexOf(item) == -1) {
					config.watchlist.push(item);
					count++;
				} else {
					console.log("> File '" + item + "' is already on the watchlist.");
				}
			} else {
				console.log("> File '" + item + "' was not found!");
			}
		});

		console.log(count == 1 ? "> 1 item was added to the watchlist." : "> " + count + " items were added to the watchlist.");
		
		if (count > 0) writeConfigFile();
	});
};

/*==========  REMOVE  ==========*/
var remove = function(filepaths) {
	onConfigReady(function(config) {
		var count = 0;
		if (typeof filepaths === 'string') filepaths = filepaths.split(" ") || filepaths.split(",");
		
		filepaths.forEach(function(item) {
			var i = config.watchlist.indexOf(item);
			if (i > -1) {
				config.watchlist.splice(i, 1);
				count++;
			} else {
				console.log("> File '" + item + "' was not on the watchlist!");
			}
		});
			
		console.log(count == 1 ? "> 1 item was removed from the watchlist." : "> " + count + " items were removed from the watchlist.");
		
		if (count > 0) writeConfigFile();
	});
};

/*==========  LIST  ==========*/
var list = function() {
	onConfigReady(function(config) {
		var files = config.watchlist;
		console.log(files.length == 1 ? "> there is currently only one file on the watchlist:" : "> there are currently " + files.length + " files on the watchlist:")
		files.forEach(function(file, index){
			console.log("> '" + file + "'");
		});
	});
}

/*==========  CHECK  ==========*/
var check = function() {
	onConfigReady(function(config) {
		var count = 0;
		var files = config.watchlist;
		console.log(files.length == 1 ? "> there is currently only one file on the watchlist:" : "> there are currently " + files.length + " files on the watchlist:")
		files.forEach(function(file, index){
			if (fs.existsSync(file)) {
				console.log("> file '" + file + "' exists.");
			} else {
				console.log("> file '" + file + "' doesn't exists. It will be removed from watchlist");
				remove(file);
			}
		});
	});
}

/*==========  BACKUP  ==========*/
var backup = function() {
	onConfigReady(function(config) {
		var count = 0;
		var files = config.watchlist;
		var ftp = new ftpClient();

		ftp.connect({
			host: config.server.host,
	  		port: config.server.port,
	  		user: config.server.username,
	  		password: config.server.password
		});

		ftp.on('ready', function(){
			files.forEach(function(file, index){
				var ext = path.extname(file), name = path.basename(file, ext), dir = path.dirname(file);
				ftp.get(config.server.folder + file, function (error, stream) {
			    	if (error) {
			    		throw error;
			    	} else {
			    		count++;
			    		if (index == files.length - 1) {
			    			stream.once('close', function() { ftp.end(); });
			    			console.log(count == 1 ? "> one file was downloaded." : "> " + count + " files were downloaded.");
			    		}
			    		stream.pipe(fs.createWriteStream(dir + "/" + name + "_backup_" + Date.now() + ext));
			    	}
			    });
			});
		});
	});
}
/*-----  End of PUBLIC HELPER METHODS  ------*/

/*======================================
=            PUBLIC METHODS            =
======================================*/
var watch = function(minify, info, safe, backup){
	gminify = minify;
	ginfo = info;
	gsafe = safe;
	gbackup = backup;
	console.log("> now watching files!");
	onConfigReady(function(){
		config.watchlist.forEach(function(file, index) {
			fs.watchFile(file, function(curr, prev){
				fileWatcher(file, gminify, ginfo, gsafe, gbackup);
			});
		});
	});
}
/*-----  End of PUBLIC METHODS  ------*/

/**
*
* PARSER
*
**/

/*==============================
=            PARSER            =
==============================*/
parser.script("ftpscout");
parser.command('watch')
	.option('safemode', {
		abbr: 's',
		flag: true,
		help: "checks that file also exists in a remote folder and is older than the one being uploaded"
	})
	.option('minify', {
		abbr: 'm',
		flag: true,
		help: "minifys .css and .js. Remote file is overwriten with minified version!"
	})
	.option('info', {
		abbr: 'i',
		flag: true,
		help: "adds information (author, contact, release date, description, link, license) from watcherConfig.json file"
	})
	.option('backup', {
		abbr: 'b',
		flag: true,
		help: "creates a backup file before upload"
	})
	.callback(function(opts) {
		var minify = opts.minify || false;
		var info = opts.info || false;
		var safe = opts.safemode || false;
		var backup = opts.backup || false;

		watch(minify, info, safe, backup);
	})
	.help("start watching files");

parser.command('add')
	.callback(function(opts) {
		opts.path.shift();
		add(opts.path);
	})
	.option('path', {
		position: 0,
		list: true,
		help: "file(s) to add"
	})
	.help("add new file(s) to watchlist");

parser.command('remove')
	.callback(function(opts) {
		opts.path.shift();
		remove(opts.path);
	})
	.option('path', {
		position: 0,
		list: true,
		help: "file to remove"
	})
	.help("remove file(s) from watchlist");

parser.command('init')
	.callback(function(opts) {
		init();
	})
	.help("start guided dialog to create and populate watcherConfig.json file");

parser.command('list')
	.callback(function(opts) {
		list();
	})
	.help("list files that are on the watchlist");

parser.command('check')
	.callback(function(opts) {
		check();
	})
	.help("check if files that are on the watchlist still exist");

parser.command('backup')
	.callback(function(opts) {
		backup();
	})
	.help("creates backup of files that are on the watchlist");

parser.parse();
/*-----  End of PARSER  ------*/

/**
*
* EXPORTS !!!
*
**/

/*===============================
=            EXPORTS            =
===============================*/
module.exports.watch = watch;
module.exports.init = init;
module.exports.add = add;
module.exports.remove = remove;
module.exports.list = list;
module.exports.check = check;
module.exports.backup = backup;
/*-----  End of EXPORTS  ------*/