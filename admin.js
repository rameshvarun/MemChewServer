var httpauth = require("http-auth"); // Authentication
var moment = require('moment-timezone'); // Time handling
var nunjucks = require('nunjucks');
var _ = require("underscore");
var fs = require("fs");

// Default auth - accept anybody
var none = httpauth.basic({
        realm: "Admin area."
    }, function (username, password, callback) { // Custom authentication method.
        callback(true);
    }
);
var auth = httpauth.connect(none);

// If there is a .htpasswd file, use that for authentication
if(fs.existsSync(__dirname + "/.htpasswd")) {
	var basic = httpauth.basic({
	  realm: "Admin area.",
	  file: __dirname + "/.htpasswd",
	});
	auth = httpauth.connect(basic);
}

module.exports = function(app) {
	// Configure templating engine
	nunjucks.configure('templates', {
		autoescape: true,
		express: app,
		watch: true
	});

	// TODO: create a route to view and edit an override file /admin/edit?file=...
	// GET will let you view the file, while POST will replace the file's content

	// TODO: create a route to make override files, given a date.

	// This route is the admin homepage
	app.get('/admin', auth, function(req, res){
		var filenames = _.filter(fs.readdirSync(OVERRIDE_DIR), function(filename) {
			return filename.match(/^\d\d-\d\d-\d\d\d\d.js$/);
		});

		res.render("home.html", {
			files : filenames
		});
	});
}