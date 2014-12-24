var httpauth = require("http-auth");
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

	// Use this route to list all of the comments on a given meal
	app.get('/admin', auth, function(req, res){
		var filenames = _.filter(fs.readdirSync(OVERRIDE_DIR), function(filename) {
			return filename.match(/^\d\d-\d\d-\d\d\d\d.js$/);
		});

		res.render("home.html", {
			files : filenames
		});
	});
}