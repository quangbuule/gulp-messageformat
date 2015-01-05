var gutil = require('gulp-util');
var path = require('path');
var MessageFormat = require('messageformat');
var	EOL = require('os').EOL;
var through = require('through2');


module.exports = function (options) {

	var parsedFile = [];
	var resultFile;

	options = options || {};

	if (!options.locale) {
		throw new gutil.PluginError('gulp-messageformat', 'Options `locale` is required.');
	}

	options.namespace = options.namespace || 'i18n';
	options.global = options.global || 'this';

	var mf = new MessageFormat(options.locale.trim(), false, options.namespace);

	function parse(file, encoding, next) {

		if (file.isNull()) {
			this.push(file);
			next();
			return;
		}

		if (file.isStream()) {
			next(new gutil.PluginError('gulp-messageformat', 'Streaming not supported' ,{
				fileName: file.path,
				showStack: false
			}));
			return;
		}

		if (!resultFile) {
			resultFile = new gutil.File({
				path: path.join(file.base, options.locale + '.js'),
				base: file.base,
				cwd: file.cwd,
				contents: new Buffer('')
			});
		}

		try {
			var fileName = path.basename(file.path, path.extname(file.path));
			var parsed = options.namespace+'["'+fileName+'"] = '+mf.precompileObject(JSON.parse(file.contents.toString())) + ';';
			parsedFile.push(parsed);
		} catch (errs) {
			var message = '';

			if (errs.join) {
				message = errs.join('\n');
			} else {
				message = errs.name + ': ' +  errs.message + '. File: ' + file.relative;
			}

			this.emit('error', new gutil.PluginError('gulp-messageformat', message, {
				fileName: file.path,
				showStack: false
			}));
		}

		next();
	}

	function flush(cb) {
		if(!resultFile) {
			cb();
			return;
		}

    var result;

		if (options.module) {
			result = [
				'var i18n = ' + mf.functions() + ';',
				parsedFile.join(EOL),
				'module.exports = i18n;'
			].join(EOL);

		} else {
			result = [
				'(function(g){',
				'var ' + options.namespace + ' = ' + mf.functions() + ';',
				parsedFile.join(EOL),
				'return g["' + options.namespace + '"] = ' + options.namespace + ';',
				'})(' + options.global + ');'
			].join(EOL);
		}

		resultFile.contents = new Buffer(result);

		this.push(resultFile);

		cb();
		}

	return through.obj(parse, flush);

};
