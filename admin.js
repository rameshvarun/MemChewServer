var httpauth = require("http-auth"); // Authentication
var moment = require('moment-timezone'); // Time handling
var nunjucks = require('nunjucks');
var _ = require("underscore");
var fs = require("fs");
var path = require("path");

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

var OVERRIDE_HEADER = "// Dining Halls: manz, arrillaga, lag, flomo, branner, ricker, stern, wilbur \
// Close a dining hall for the week with close(flomo) \
// Close a dining hall for the day with close(manz.monday) \
// Close a specific meal with close(manz.monday.breakfast) \
// Set a meal description with manz.tuesday.dinner.mealdesc = 'Italian Braised Beef with Roasted Potatoes'";

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

	app.post('/admin/createoverride', auth, function(req, res) {
		var filename = req.param('date') + ".js";
		var filepath = path.join(OVERRIDE_DIR, filename);

		if(!fs.existsSync(filepath)) {
			fs.writeFileSync(filepath, OVERRIDE_HEADER);
			console.log("Created override file " + filepath);
		} else console.log("Override " + filepath + " already exists...");

		res.redirect("/admin/edit?file=" + filename)
	});

	app.get('/admin/edit', auth, function(req, res) {
		var filename = req.query.file;
		var filepath = path.join(OVERRIDE_DIR, filename);

		res.render("edit.html", {
			filename : filename,
			content : fs.readFileSync(filepath, "utf8")
		});
	});

	app.post('/admin/edit', auth, function(req, res) {
		var filename = req.query.file;
		var filepath = path.join(OVERRIDE_DIR, filename);

		fs.writeFileSync(filepath, req.param('content'));
		res.redirect(req.url);
	});
}