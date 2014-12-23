var moment = require('moment-timezone'); // Time handling
var fs = require('fs');

if(!fs.existsSync("./overrides")) { fs.mkdirSync("overrides") };

module.exports.generateSchedule = function() {
	var schedule = JSON.parse( fs.readFileSync("./schedulebase.json") );

	var now = moment().tz(TIME_ZONE);
	var week = now.startOf("week").format("MM-DD-YYYY");
	var overrideFile = __dirname + "/overrides/" + week + ".js";

	if(fs.existsSync(overrideFile)) {
		var scope = {};

		scope.halls = schedule;
		for(var i in schedule) scope[schedule[i].id] = schedule[i];

		with(scope) eval(fs.readFileSync(overrideFile, "utf8"));
	}

	return schedule;
}