// --------------------------------------------------
//
// timing.js
// simple functions for timing filter render speeds
// (not part of the core PaintbrushJS, safe to delete)
//
// This project lives on GitHub:
//    http://github.com/mezzoblue/PaintbrushJS
//
// --------------------------------------------------
//

var runTimer = true;

function startTimer() {
	var s = new Date();
	return(s.getTime());	
}
function endTimer(s) {
	// set an end timer and log the delta
	var e = new Date();
	document.getElementById("copyright").innerHTML += (" " + (e.getTime() - s) / 1000 + "s to execute all filters on this page.");
}
