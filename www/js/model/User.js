var User = function() {
	// Id
	this.id = null;
	
	// Name
	this.name = null;
	
	// E-Mail
	this.mail = null;
	
	// Color
	this.color = null;
	
	// has the user granted access to getUserMedia?
	this.gotUserMedia = null;
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports.User = User;
}