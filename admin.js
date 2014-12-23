var httpauth = require("http-auth");

var basic = httpauth.basic({
  realm: "Admin area.",
  file: __dirname + "/.htpasswd",
});
var auth = httpauth.connect(basic);

module.exports = function(app) {
	// Use this route to list all of the comments on a given meal
	app.get('/admin', auth, function(req, res){
		res.end("Hello " + req.user);
	});
}