var httpauth = require("http-auth");
var nunjucks = require('nunjucks');
var _ = require("underscore");
var fs = require("fs");

var basic = httpauth.basic({
  realm: "Admin area.",
  file: __dirname + "/.htpasswd",
});
var auth = httpauth.connect(basic);

module.exports = function(app) {
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