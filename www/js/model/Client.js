var Client = function() {
	// Id
	this.id = null;
	
	// WebSocket connection
	this.webSocketConnection = null;
	
	// User
	this.user = null;
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports.Client = Client;
}