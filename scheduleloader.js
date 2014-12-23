var moment = require('moment-timezone'); // Time handling
var _ = require("underscore");
var fs = require('fs');

global.OVERRIDE_DIR = __dirname + "/overrides";

if(!fs.existsSync("./overrides")) { fs.mkdirSync("overrides") };

global.DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

module.exports.generateSchedule = function() {
	var schedule = JSON.parse( fs.readFileSync("./schedulebase.json") );

	var now = moment().tz(TIME_ZONE);
	var week = now.startOf("week").format("MM-DD-YYYY");
	var overrideFile = OVERRIDE_DIR + "/" + week + ".js";

	if(fs.existsSync(overrideFile)) {
		var scope = {};

		scope.halls = schedule;
		_.each(schedule, function (hall) {
			scope[hall.id] = hall;
			_.each(DAY_NAMES, function(day, index) {
				scope[hall.id][day] = {};
				_.each(hall.schedule[index], function(meal) {
					scope[hall.id][day][meal.meal] = meal;
				});
			});
		});

		scope.close = function(item) { item.closed = true; }


		with(scope) eval(fs.readFileSync(overrideFile, "utf8"));
	}

	return schedule;
}