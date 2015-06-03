Description
===========

ftpScout is a [node.js](http://nodejs.org/) file watching module that provides automatic ftp upload (using [node-ftp](https://github.com/mscdex/node-ftp) module) and optional minification of .js and .css files using [uglify-js](http://github.com/mishoo/UglifyJS2) and [sqwish](http://github.com/ded/sqwish). It currently only supports ftp protocol.

It requires ftpScoutConfig.json file to work properly. You can use ftpScout's "init" method to start step by step dialog to create it.

**This module is in alpha state. It should be stable, but you are strongly advised to backup any files before using it. You should do a manual backup, which is the safest. Optionally you can also use ''ftpScout backup'' method to create backup of all remote files on the watch list or use ''ftpScout watch --b'' to backup a remote file before it is being updated.**


Requirements
============

* [node.js](http://nodejs.org/) -- v0.8.0 or newer


Install
=======

    npm install ftpscout -g


Use
========

    ftpScout watch [options]

Options
------

* **-safemode, --s** - Checks that file also exists in a remote folder and is older than the one being uploaded.
* **-minify, --m** - Minifys .css (using [sqwish](http://github.com/ded/sqwish)) and .js (using [uglify-js](http://github.com/mishoo/UglifyJS2)) files. Keep in mind that remote file is overwriten with minified version!
* **-info, --i** - Adds arbitrary information (author, contact, release date, description, link, license, etc.) from watcherConfig.json file.
* **-backup, --b** - Creates a backup file before upload.


Methods
========

* **watch** - Starts watching files.
* **add [file/files]** - Adds new file(s) to watchlist.
* **remove [file/files]** - Removes file(s) from watchlist.
* **init** - Starts guided dialog to create and populate watcherConfig.json file.
* **list** - Lists all files that are on the watchlist.
* **check** - Check if files that are on the watchlist still exist.
* **backup** - Creates backup of files that are on the watchlist (from remote folder).
* **help** - Displays help.