var CONFIG = {
    ip: "webrtc-demo-micsti1.c9users.io",
    port: 1337,
    protocol: "wss",
    longTouchTrigger: 600,
    batteryWarningThreshold: 15,
    batteryCriticalThreshold: 7
};

$(document).ready(function() {
    // sections
    var $loginForm = $("#loginForm");
    var $userSelection = $("#userSelection");
    var $videoContainer = $("#videoContainer");
    var $batteryInfo = $("#batteryInfo");
    var $batteryStatus = $("#batteryStatus");
    
    // Contact
    var contacts = [];
    var contactsRetrieved = false;
    
    // Retrieve all contacts from device
    (function() {
        // contacts
        var options = new ContactFindOptions();
        //options.filter = "";
        options.multiple = true;
        options.desiredFields = [navigator.contacts.fieldType.id, navigator.contacts.fieldType.displayName, navigator.contacts.fieldType.name, navigator.contacts.fieldType.phoneNumbers];
        options.hasPhoneNumber = true;
        var fields = [navigator.contacts.fieldType.displayName, navigator.contacts.fieldType.name];
        navigator.contacts.find(fields, function(items) {
            // success callback
            items.forEach(function(item) {
                var contact = {};
                
                contact["id"] = item["id"];
                contact["name"] = item["displayName"];
                contact["phoneNumbers"] = [];
                
                if (item.phoneNumbers !== null) {
                    item.phoneNumbers.forEach(function(number) {
                        contact["phoneNumbers"].push(number);
                    });
                }
                
                contacts.push(contact);
            });
            
            contactsRetrieved = true;
            console.log("FOUND " + contacts.length + " CONTACTS");
        }, function(error) {
            console.error("CONTACT FIND ERROR", error);
        }, options);
    })();
    
    // searches the contact array for a contact with the specified name.
    // if a contact is found it is returned, null otherwise
    var findContact = function(name) {
        var contactCount = contacts.length;
        
        for (var i = 0; i < contactCount; i++) {
            var contact = contacts[i];
            
            if (contact.name === name) {
                return contact;
            }
        }
        
        return null;
    };
    
    // Battery charge
    var batteryCharge = -1;
    var devicePlugged = null;
    
    // at start, only the login form is visible
    $userSelection.hide();
    $videoContainer.hide();
    $loginForm.show();
    $batteryInfo.hide();
    
    // WebSocket connection
    var connection;
    
	// available users
	var $users = $(".users");
    
    // messages
    var $messageContainer = $("#messageContainer");
    var $messages = $(".messages");
    
    // call status
    var $callStatus = $("#callStatus");
    
    // buttons
    var $buttonAccept = $("#accept");
    var $buttonDecline = $("#decline");
    var $buttonHangup = $("#hangup");
	
	// user
	var user = new User();
	user.name = "Crosswalk";
    
    // login button
    $("#login").on("click", function() {
        user.name = $("#username").val().trim();
        
        // hide login form
        $loginForm.hide();
        
        // show UI
        $userSelection.show();
        $batteryInfo.show();
        
        // try to connect to websocket server
        connection = new WebSocket(CONFIG.protocol + "://" + CONFIG.ip);
    	
    	connection.onopen = function() {
    	   console.log("WebSocket connection successfully opened");
    	   
    	   // send user info
    		var message = new Message();
    		   
    		message.topic = message.topics.USER_INFO;
    		message.sender = user;
    		message.recipient = server;
    		message.content = user;
    		message.type = message.types.SERVER;
    
    		connection.send(JSON.stringify(message));
    		
    		// try to get camera access
            getSources(function() {
                var mediaConstraints = {
                	audio: false,
        			video: true
        		};
                
                var bestSuitableSource = tryToFindEnvironmentCamera();
                
                mediaConstraints.video = {
                    optional: [
                            {
                                sourceId: bestSuitableSource["deviceId"]
                            }
                        ]
                };
        		
        		var successCallback = function(stream) {
        			console.log("navigator.getUserMedia success");
                    
                    localStream = stream;
                    
                    localVideo.srcObject = localStream;
        			
        			user.gotUserMedia = true;
        			
        			var message = new Message();
        		   
        			message.topic = message.topics.USER_INFO;
        			message.sender = user;
        			message.recipient = server;
        			message.content = user;
        			message.type = message.types.SERVER;
        
        			connection.send(JSON.stringify(message));
        		};
        		
        		var failedCallback = function() {
        			console.log("navigator.getUserMedia error");
        		};
        		
        		navigator.webkitGetUserMedia(mediaConstraints, successCallback, failedCallback);
            });
    	};
    
    	connection.onerror = function(error) {
    		console.log("WebSocket error", error);
    	};
    
    	// most important part - incoming messages
    	connection.onmessage = function(message) {
    		console.log("Message received", message);
    		
    		// message origin
    		var origin = message.origin;
    		
    		// parse message JSON data
    		var messageData = JSON.parse(message.data);
            
            // cast it to message object
            var messageObject = castObject(messageData, "Message");
            
            switch (messageObject.topic) {
                // user id
                case messageObject.topics.USER_ID:
                    user.id = messageObject.content;
                    
                    break;
                
                // user broadcast
                case messageObject.topics.USER_BROADCAST:
                    // save users to available users array
                    users = messageObject.content;
                    
                    // clear user display first
                    $users.empty();
                    
                    // display the users
                    messageObject.content.forEach(function(_user) {
                        if (user.id !== _user.id) {
                            $user = $("<li>", {
                                class: "user",
                                "data-id": _user.id,
                                "data-name": _user.name,
                                html: _user.name
                            });
                            
                            // determine matching contact
                            var matchedContact = findContact(_user.name);
                            
                            if (matchedContact !== null) {
                                var phoneNumbers = matchedContact["phoneNumbers"];
                                
                                if (phoneNumbers.length > 0) {
                                    $user.append("<div class='phoneNumber'>" + phoneNumbers[0].value + " <a href='tel:" + phoneNumbers[0].value + "'><img src='http://icons.iconarchive.com/icons/icons8/windows-8/512/Mobile-Phone-icon.png' width=16 height=16 /> Call phone</a>" + "</div>");
                                }
                            }
                            
                            $user.on("click", function() {
                                var $this = $(this);
                                
                                var callPeer = function(buttonIndex) {
                                    if (buttonIndex !== 1)
                                        return;
                                    
                                    // switch views
                                    $userSelection.hide();
                                    
                                    $localCanvas.hide();
                                    $localDrawingCanvas.hide();
                                    $buttonHangup.show();
                                    $videoContainer.show();
                                    
                                    $batteryInfo.hide();
                                    
                                    // set title for call status
                                    $callStatus.html("calling <span class='highlight'>" + $this.attr("data-name") + "</span>");
                                    
                                    // keep track of the id of the called user
                                    callingId = $this.attr("data-id");
                                    
                                    // send call message to peer
                                    var message = new Message();
                
                                	message.topic = message.topics.CALL;
                            		message.sender = user;
                            		message.type = message.types.RELAY;
                            		
                            		message.recipient = new User();
                            		message.recipient.id = callingId;
                            		
                            		connection.send(JSON.stringify(message));
                                };
                            
                                var confirmMsg = "";
                                var confirmTitle = "";
                                var confirmNecessary = false;
                                
                                if (batteryCharge <= CONFIG.batteryCriticalThreshold && !devicePlugged) {
                                    confirmTitle = "Battery charge critical";
                                    confirmMsg = "Please note that your battery is about to die. Are you sure you want to complete your call and use your camera?";
                                    confirmNecessary = true;
                                } else if (batteryCharge <= CONFIG.batteryWarningThreshold && !devicePlugged ) {
                                    confirmTitle = "Battery charge low";
                                    confirmMsg = "Please note that your battery has reached a low. Are you sure you want to complete your call and use your camera?";
                                    confirmNecessary = true;
                                }
                                
                                if (confirmNecessary) {
                                    navigator.notification.confirm(confirmMsg, callPeer, confirmTitle);
                                } else {
                                    callPeer(1);
                                }
                            });
                            
                            $users.append($user);
                        }
                    });
                    
                    // phone call handler
                    $(".phoneNumber a").on("click", function(e) {
                        e.stopPropagation();
                    });
                    
                    // hangup
                    $buttonHangup.off("click")
                                .on("click", function() {
                                    hangup();
                                });
                    
                    break;
                    
                case messageObject.topics.SESSION_DESCRIPTION_OFFER:
                    if (!isInitiator && !callStarted) {
                        checkAndStart();
                    }
                    
                    collocutorId = messageObject.sender.id;
                    
                    peerConnection.setRemoteDescription(new RTCSessionDescription(messageObject.content));
                    
                    doAnswer();
                    
                    break;
                    
                case messageObject.topics.SESSION_DESCRIPTION_ANSWER:
                    if (callStarted) {
                        peerConnection.setRemoteDescription(new RTCSessionDescription(messageObject.content));
                    }
                    
                    break;
                    
                case messageObject.topics.ICE_CANDIDATE:
                    var candidate = new RTCIceCandidate({
                        candidate: messageObject.content.candidate
                    });
                    
                    peerConnection.addIceCandidate(candidate);
                    
                    break;
                    
                case messageObject.topics.CALL:
                    if (!callStarted) {
                        $userSelection.hide();
                        $videoContainer.show();
                        
                        $localCanvas.hide();
                        $localDrawingCanvas.hide();
                        
                        $buttonHangup.hide();
                        $buttonAccept.show();
                        $buttonDecline.show();
                        
                        $batteryInfo.hide();
                        
                        $callStatus.html("Incoming call from <span class='highlight'>" + messageObject.sender.name + "</span>");
                        
                        $buttonAccept.off("click")
                                     .on("click", function() {
                                        // send call accept message
                        				var acceptMessage = new Message();
                    		
                    					acceptMessage.topic = acceptMessage.topics.CALL_ACCEPT;
                    					acceptMessage.sender = user;
                    					acceptMessage.type = acceptMessage.types.RELAY;
                    					acceptMessage.recipient = messageObject.sender;
                    					
                    					connection.send(JSON.stringify(acceptMessage));
                                        
                                        // switch buttons
                                        $buttonAccept.hide();
                                        $buttonDecline.hide();
                                        $buttonHangup.show();
                                        
                                        // show canvas
                                        $localCanvas.show();
                                        $localDrawingCanvas.show();
                                     });
                                     
                        $buttonDecline.off("click")
                                      .on("click", function() {
                                        // send call decline message
                        				var declineMessage = new Message();
                    		
                    					declineMessage.topic = declineMessage.topics.CALL_DECLINE;
                    					declineMessage.sender = user;
                    					declineMessage.type = declineMessage.types.RELAY;
                    					declineMessage.recipient = messageObject.sender;
                    					
                    					connection.send(JSON.stringify(declineMessage));
                                        
                                        // clean-up GUI
                                        $videoContainer.hide();
                                        $buttonAccept.hide();
                                        $buttonDecline.hide();
                                        $localCanvas.show();
                                        $localDrawingCanvas.show();
                                        
                                        $userSelection.show();
                                      });
                    }
                    
                    break;
                    
                case messageObject.topics.CALL_ACCEPT:
                    // set collocutor id
                    collocutorId = messageObject.sender.id;
                    
                    isInitiator = true;
                    
                    checkAndStart();
                    
                    // show canvas
                    $localCanvas.show();
                    $localDrawingCanvas.show();
                    
                    break;
                    
                case messageObject.topics.CALL_WITHDRAWN:   
                case messageObject.topics.CALL_DECLINE:
                    $videoContainer.hide();
                    $buttonAccept.hide();
                    $buttonDecline.hide();
                    $localCanvas.hide();
                    $localDrawingCanvas.hide();
                    
                    $userSelection.show();
                    
                    $batteryInfo.show();
                    
                    break;
                    
                case messageObject.topics.BYE:
                    stop();
                    
                    break;
                    
                default:
                    console.log("Unknown message topic " + messageObject.topic);
            }
    	};
    })
	
	// server "user"
	var server = new User();
	server.id = 1;
	server.name = "Server";
    
    // array with all available users
    var users = [];
    
    // media devices
    var audioSources = [];
    var videoSources = [];
    
    var gotSources = false;
    
    var getMediaSources = function() {
        if (!gotSources)
            return;
            
        return {
            audio: audioSources,
            video: videoSources
        }
    };
    
    // timer for long touch trigger
    var longTouchTimer;
    var longTouchActive = false;
    
    // WebRTC stuff
    var isInitiator = false;
    var callStarted = false;
    var videoPaused = false;
    
    var peerConnection = null;
    var collocutorId = null;
    var callingId = null;
    
    var localStream = null;
    var localVideo = document.getElementById("localVideo");
    var localVideoSize = {
        width: null,
        height: null,
        ratio: 4 / 3
    };
    var $localCanvas = $("#localVideoCanvas");
    var $localVideoContainer = $("#localVideoContainer");
    
    var remoteStream = null;
    var remoteVideo = document.getElementById("remoteVideo");
    var remoteVideoSize = {
        width: null,
        height: null,
        ratio: 4 / 3
    };
    var $remoteCanvas = $("#remoteVideoCanvas");
    var $remoteVideoContainer = $("#remoteVideoContainer");
    
    
    var localVideoCanvas = document.getElementById("localVideoCanvas");
    var $localVideoCanvas = $("#localVideoCanvas");
    
    // set up local drawing canvas
    var localDrawingCanvas = document.getElementById("localDrawingCanvas");
    var $localDrawingCanvas = $("#localDrawingCanvas");
    
    // delegate touch events to touch handler method
    localDrawingCanvas.addEventListener("touchstart", function(event) {
        return touchHandler("touchstart", event);
    });
                                                
    localDrawingCanvas.addEventListener("touchmove", function(event) {
        return touchHandler("touchmove", event);
    });
    
    localDrawingCanvas.addEventListener("touchend", function(event) {
        return touchHandler("touchend", event);
    });
    
    // padding for the video canvas
    var CANVAS_PADDING_DIFF = 16;
    
    localVideo.addEventListener("loadedmetadata", function() {
        localVideoSize.width = this.videoWidth;
        localVideoSize.height = this.videoHeight;
        localVideoSize.ratio = this.videoWidth / this.videoHeight;
        
        // set canvas size
        $localCanvas.attr("width", screenSize.width - CANVAS_PADDING_DIFF)
                    .attr("height", (screenSize.width - CANVAS_PADDING_DIFF) / (localVideoSize.ratio));
    });
    
    remoteVideo.addEventListener("loadedmetadata", function() {
        remoteVideoSize.width = this.videoWidth;
        remoteVideoSize.height = this.videoHeight;
        remoteVideoSize.ratio = this.videoWidth / this.videoHeight;
        
        // set canvas size
        $remoteCanvas.attr("width", screenSize.width - CANVAS_PADDING_DIFF)
                     .attr("height", (screenSize.width - CANVAS_PADDING_DIFF) / (remoteVideoSize.ratio));
                     
        // position drawing canvas
        positionDrawingCanvas();
    });
    
    // screen size
    var screenSize = {
        width: $(window).width(),
        height: $(window).height()
    };
    
    // data channel
    var sendChannel = null;
    var receiveChannel = null;
    
    var $sendMessage = $("#sendMessageButton");
    var $input = $("#sendMessageContent");
    
    $sendMessage.on("click", function() {
        var text = $input.val();
        
        sendTextMessage(text);
        
        // clear input
        $input.val("");
    });
    
    // battery status
    var onBatteryStatus = function(status) {
        console.log("BATTERY STATUS | Level: " + status.level + ", isPlugged: " + status.isPlugged);
        
        batteryCharge = status.level;
        devicePlugged = status.isPlugged;
        
        $batteryStatus.text(batteryCharge + "%");
        
        // add color according to battery status
        $batteryInfo.removeClass("battery-status-ok, battery-status-low, battery-status-critical");
        
        if (batteryCharge <= CONFIG.batteryCriticalThreshold) {
            $batteryInfo.addClass("battery-status-critical");
        } else if (batteryCharge <= CONFIG.batteryWarningThreshold) {
            $batteryInfo.addClass("battery-status-low");
        } else {
            $batteryInfo.addClass("battery-status-ok");
        }
    };
    
    window.addEventListener("batterystatus", onBatteryStatus, false);
    
    // add onunload listener in order to close open connections when user leaves the app
    window.onunload = function() {
        if (peerConnection !== null) {
            hangup();
        }
    };
    
    /**
    	Casts a generic JS object to the specified object type.
	*/
	var castObject = function(object, type) {
		var returnObject = null;
		
		switch (type) {
			case "Message":
				returnObject = new Message();
				break;
				
			case "User":
				returnObject = new User();
				break;
				
			case "Client":
				returnObject = new Client();
				break;
				
			default:
				break;
		}
		
		if (returnObject !== null) {
			for (var property in object) {
				if (object.hasOwnProperty(property)) {
					returnObject[property] = object[property];
				}
			}
		}
		
		return returnObject;
	};
    
    /**
     * Creates a WebRTC peer connection
    */
    var createPeerConnection = function() {
        var config = {
            'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]
        };
        
        var constraints = {
    		'optional': [
				{'DtlsSrtpKeyAgreement': true}
			]
		};
        
        try {
            peerConnection = new webkitRTCPeerConnection(config, constraints);
            
            peerConnection.addStream(localStream);
            
            peerConnection.onicecandidate = function(event) {
                if (event.candidate === null)
                    return;
                
                var candidateMessage = new Message();
    			
				candidateMessage.type = candidateMessage.types.RELAY;
				candidateMessage.topic = candidateMessage.topics.ICE_CANDIDATE;
				candidateMessage.sender = user;
				
				candidateMessage.recipient = new User();
				candidateMessage.recipient.id = collocutorId;
				
				candidateMessage.content = {
					
				};
				
				connection.send(JSON.stringify(candidateMessage));
            };
            
            console.log("successfully created peer connection");
        } catch (ex) {
            console.error("could not create peer connection", ex);
        }
        
        peerConnection.onaddstream = function(event) {
            remoteStream = event.stream;
            
            remoteVideo.srcObject = event.stream;
            
            // start update canvas interval
            setInterval(function() { return updateCanvas("localVideoCanvas", "localVideo"); }, 24);
            
            // show local video container
            $localVideoContainer.show();
            
            console.log("Remote stream attached");
            
            // set title for call status
            var peer = findByAttribute(users, "id", collocutorId);
            
            $callStatus.html("speaking with <span class='highlight'>" + peer.name + "</span>");
        };
        
        peerConnection.onremovestream = function() {
            console.log("Remote stream removed");
        };
        
        if (isInitiator) {
            // create a reliable data channel
            try {
                sendChannel = peerConnection.createDataChannel("appSendDataChannel", { reliable: true });
                
                sendChannel.onopen = function() { onDataChannelOpened(); return handleDataChannelStateChange(sendChannel); };
                sendChannel.onmessage = handleDataChannelMessage;
                sendChannel.onclose = function() { onDataChannelClosed(); return handleDataChannelStateChange(sendChannel); };
                
                console.log("created send data channel");
            } catch (ex) {
                console.log("create data channel failed " + JSON.stringify(ex));
            }
        } else {
            peerConnection.ondatachannel = function(event) {
                console.log("received data channel");
                
                receiveChannel = event.channel;
                
                receiveChannel.onmessage = handleDataChannelMessage;
                
                receiveChannel.onopen = function() { onDataChannelOpened(); return handleDataChannelStateChange(receiveChannel); };
                receiveChannel.onclose = function() { onDataChannelClosed(); return handleDataChannelStateChange(receiveChannel); };
            };
        }
     };
     
     /**
      * Handles an incoming data channel message
      */
     var handleDataChannelMessage = function(event) {
        // parse message JSON data
        var messageData = JSON.parse(event.data);
        
        // cast it to message object
        var message = castObject(messageData, "Message");
        
        switch (message.topic) {
            case message.topics.P2P_TEXT:
                addChatMessage(message);
                
                break;
                
            case message.topics.P2P_SUPPORT:
                drawSupportPath(message.content);
                
                break;
                
            case message.topics.P2P_MODE:
                
                break;
                
            case message.topics.P2P_BACK_OFFICE:
                
                break;
                
            case message.topics.P2P_CLEAR_CANVAS:
                // clear local drawing canvas
    			clearCanvas(localDrawingCanvas);
                
                break;
                
            case message.topics.P2P_DRAW_STATE:
                videoPaused = message.content;
                
                break;
                
            default:
                break;
        }
     };
     
     /**
      * Adds a chat message to the messages section.
      * The new message gets prepended, is shown as the first message.
      */
     var addChatMessage = function(message) {
         var sender = message.sender.id === user.id ? "You" : message.sender.name;
         var myselfClass = message.sender.id === user.id ? "message-myself" : "";
                  
         var $message = $("<div>", {
            class: "message " + myselfClass,
            html: "<div class='message-sender'>" + sender + "</div>" + "<div class='message-content'>" + message.content + "</div>"
         });
        
        $messages.prepend($message);
     };
     
     /**
      * Handler that is called when a data channel has been created.
      */
     var onDataChannelOpened = function() {
        // send a back office request to the peer
        var requestMessage = new Message();
		requestMessage.sender = user;
		requestMessage.topic = requestMessage.topics.P2P_REQUEST_BACK_OFFICE;
		requestMessage.type = requestMessage.types.P2P;
		
		requestMessage.recipient = new User();
		requestMessage.recipient.id = collocutorId;
		
		sendDataChannelMessage(JSON.stringify(requestMessage));
     };
     
     /**
      * Cleans up the GUI after a data channel has been closed.
      */
     var onDataChannelClosed = function() { 
        // hide message container and empty it
        $messageContainer.hide();
        $messages.empty();
     };
     
     /**
      * Handler that is called when the ready state of the receive channel changes.
      */
     var handleDataChannelStateChange = function(dataChannel) {
        if (dataChannel === null)
            return;
         
        var readyState = dataChannel.readyState;
        
        console.log("data channel state is " + readyState);
        
        switch (readyState) {
            case "open":
                // show the container
                $messageContainer.show();
                
                break;
                
            case "closed":
                dataChannel = null;
                
                break;
                
            default:
                break;
        }
     };
     
     /**
      * Creates a text message and delegates it to the method sendDataChannelMessage.
      */
     var sendTextMessage = function(text) {
         // compose message object
         var message = new Message();
         
         message.sender = user;
		 message.recipient = collocutorId;
		 message.content = text;
		 message.type = message.types.P2P;
		 message.topic = message.topics.P2P_TEXT;
         
         // send message
         sendDataChannelMessage(JSON.stringify(message));
         
         // append it to the chat messages
         addChatMessage(message);
     };
     
     /**
      * Sends a data channel message over an opened channel.
      * If no channel is open, the message is not sent.
      */
     var sendDataChannelMessage = function(messageString) {
         if (sendChannel !== null) {
             sendChannel.send(messageString);
         } else if (receiveChannel !== null) {
             receiveChannel.send(messageString);
         } else {
             console.log("No data channel open: " + messageString);
         }
     };
     
     /**
      * Places a call to another peer
      */
     var placeCall = function() {
         var setLocalAndSendMessageOffer = function(sessionDescription) {
            peerConnection.setLocalDescription(sessionDescription);
             
            var sessionDescriptionMessage = new Message();
    		sessionDescriptionMessage.type = sessionDescriptionMessage.types.RELAY;
			sessionDescriptionMessage.topic = sessionDescriptionMessage.topics.SESSION_DESCRIPTION_OFFER;
			sessionDescriptionMessage.sender = user;
			
			sessionDescriptionMessage.recipient = new User();
			sessionDescriptionMessage.recipient.id = collocutorId;
			
			sessionDescriptionMessage.content = sessionDescription;
			
			console.log("sending session description offer");
			
			connection.send(JSON.stringify(sessionDescriptionMessage));
         };
         
         var onSignalingError = function(error) {
             console.error("failed to create signaling message", error);
         };
         
         var sdpConstraints = {};
         
         peerConnection.createOffer(setLocalAndSendMessageOffer, onSignalingError, sdpConstraints);
     };
     
     /**
      * Sends an answer to a session description of a peer.
      */
     var doAnswer = function() {
         console.log("sending answer to peer");
         
         var setLocalAndSendMessageAnswer = function(sessionDescription) {
            peerConnection.setLocalDescription(sessionDescription);
    		
			var sessionDescriptionMessage = new Message();
			sessionDescriptionMessage.type = sessionDescriptionMessage.types.RELAY;
			sessionDescriptionMessage.topic = sessionDescriptionMessage.topics.SESSION_DESCRIPTION_ANSWER;
			sessionDescriptionMessage.sender = user;
			
			sessionDescriptionMessage.recipient = new User();
			sessionDescriptionMessage.recipient.id = collocutorId;
			
			sessionDescriptionMessage.content = sessionDescription;
			
			console.log("sending session description answer");
			
			connection.send(JSON.stringify(sessionDescriptionMessage));
         };
         
         var onSignalingError = function() {
             console.error("failed to create signaling answer", error);
         };
         
         var sdpConstraints = {};
         
         peerConnection.createAnswer(setLocalAndSendMessageAnswer, onSignalingError, sdpConstraints);
     };
     
     /**
      * Checks and start.
      */
     var checkAndStart = function() {
         if (!callStarted && typeof localStream !== 'null') {
             createPeerConnection();
             
             callStarted = true;
             
             if (isInitiator)
                placeCall();
         }
     };
     
     /**
      * Stops a call - either because the session was terminated by ourselves or the remote peer.
      */
     var stop = function() {
        if (sendChannel !== null) {
            sendChannel.close();
            sendChannel = null;
        }
        
        if (receiveChannel !== null) {
            receiveChannel.close();
            receiveChannel = null;
        }
         
        if (peerConnection !== null)
            peerConnection.close();
            
        peerConnection = null;
        
        callStarted = false;
        isInitiator = false;
        collocutorId = null;
        callingId = null;
        
        // reset GUI
        remoteStream = null;
        remoteVideo.srcObject = undefined;
        
        $videoContainer.hide();
        $userSelection.show();
        $localCanvas.hide();
        $localDrawingCanvas.hide();
        $batteryInfo.show();
     };
     
     /**
      * Perform call hangup.
      */
     var hangup = function() {
        if (callStarted) {      
            // send bye message to peer (via server)
            var byeMessage = new Message();
    		byeMessage.type = byeMessage.types.RELAY;
    		byeMessage.topic = byeMessage.topics.BYE;
    		byeMessage.sender = user;
    		
    		byeMessage.recipient = new User();
    		byeMessage.recipient.id = collocutorId;
    		
    		console.log("Sending bye message");
    		
    		connection.send(JSON.stringify(byeMessage));
            
            // call stop method
            stop();
        } else {
            // call hasn't started yet, we just withdraw the call offer
			var withdrawnMessage = new Message();
			withdrawnMessage.sender = user;
			withdrawnMessage.topic = withdrawnMessage.topics.CALL_WITHDRAWN;
			withdrawnMessage.type = withdrawnMessage.types.RELAY;
			
			withdrawnMessage.recipient = new User();
			withdrawnMessage.recipient.id = callingId;
			
			connection.send(JSON.stringify(withdrawnMessage));
            
            // we use the clean-up code from the stop() method
            stop();
        }
     };
     
     /**
      * Updates the canvas with the specified id with the current image from the video with the specified id.
      */
     var updateCanvas = function(canvasId, videoId) {
         // do not update if video has been paused
    	if (videoPaused) {
			return;
		}
        
        var canvasWidth = screenSize.width - CANVAS_PADDING_DIFF;
        var canvasHeight = canvasWidth / localVideoSize.ratio;
		
		var canvas = document.getElementById(canvasId);
		var ctx = canvas.getContext('2d');
		var video = document.getElementById(videoId);
		ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
     };
     
     /**
      * Returns the first element in an array that matches the specified attribute/value pair.
      * If no matching element is found, null is returned.
      */
     var findByAttribute = function(set, attribute, value) {
         var size = set.length;
         
         for (var i = 0; i < size; i++) {
             var item = set[i];
             
             if (item[attribute] === value)
                return item;
         }
         
         return null;
     };
     
    /**
    	Gets all sources that are present on the device.
	*/
	var getSources = function(onSuccess) {
		if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
			console.log("enumerateDevices() not supported");
			return;
		}
		
		// enumerate all cameras and microphones
		navigator.mediaDevices
				 .enumerateDevices()
				 .then(function(devices) {
					  devices.forEach(function(device) {
						  switch (device.kind) {
							case "audioinput":
								audioSources.push(device);
								break;
							
							case "videoinput":
								videoSources.push(device);
								
								break;
								
							default:
								break;
						}
					  });
					  
					  // set got sources flag to true
					  gotSources = true;
					
					  // call onSuccess handler
					  if (onSuccess !== undefined && typeof onSuccess === 'function')
						  onSuccess();
				  })
				  .catch(function(err) {
					  console.log(err.name + ":" + err.message);
				  });
	};
    
    /**
     * Tries to find an environment-facing camera in the video sources array.
     * If none is found, the last camera from the video source array is returned.
     * If there is no camera in the video source array, an exception is thrown.
     */
    var tryToFindEnvironmentCamera = function() {
    	var count = videoSources.length;
		
		if (count == 0) {
			throw "No video sources found!";
		}
		
		for (var i = 0; i < count; i++) {
			var source = videoSources[i];
			
			if (source.facing !== undefined && source.facing === "environment")
				return source;
		}
		
		// if none is found, the last camera in the array is returned
		return videoSources[count - 1];
	};
    
    /**
     * Handles the touch logic on the canvas.
     */
    var touchHandler = function(type, event) {
        // we only care about the first touch
        var touch = event.touches[0];
        
        switch (type) {
            case "touchstart":
                // long touch timer to detect long touches
                longTouchTimer = setTimeout(function() {
                    // set long touch active flag
                    longTouchActive = true;
                    
                    // clear canvas
                    clearCanvas(localDrawingCanvas);
                    
                    // send clear canvas message to peer
                    var message = new Message();
    		
            		message.sender = user;
            		message.recipient = collocutorId;
            		message.type = message.types.P2P;
            		message.topic = message.topics.P2P_CLEAR_CANVAS;
            		
            		sendDataChannelMessage(JSON.stringify(message));
                }, CONFIG.longTouchTrigger);
                
                break;
                
            case "touchmove":
                // clear long touch timeout
                clearTimeout(longTouchTimer);
                
                break;
                
            case "touchend":
                // clear long touch timeout
                clearTimeout(longTouchTimer);
                
                if (longTouchActive) {
                    longTouchActive = false;
                    return;
                }
                
                // toggle video paused flag
                videoPaused = !videoPaused;
                
                // send status message to peer
                var message = new Message();
                    
        		message.sender = user;
        		message.recipient = collocutorId;
        		message.content = videoPaused;
        		message.type = message.types.P2P;
        		message.topic = message.topics.P2P_DRAW_STATE;
        		
        		sendDataChannelMessage(JSON.stringify(message));
                
                break;
        }
    };
    
    /**
    	Draws the support info on the canvas.
	*/
	var drawSupportPath = function(drawingInfo) {
		var canvas = localDrawingCanvas;
		var ctx = canvas.getContext('2d');
		
		ctx.beginPath();
		ctx.moveTo(drawingInfo.previous.x, drawingInfo.previous.y);
		ctx.lineTo(drawingInfo.current.x, drawingInfo.current.y);
		ctx.strokeStyle = drawingInfo.color;
		ctx.lineWidth = drawingInfo.size;
		ctx.stroke();
		ctx.closePath();
	};
    
    /**
     * Sets the dimensions for the drawing canvas and positions it on top of the video canvas.
     */
    var positionDrawingCanvas = function() {
        $localDrawingCanvas.attr("width", $localVideoCanvas.attr("width"))
                           .attr("height", $localVideoCanvas.attr("width") / localVideoSize.ratio)
                           .css($localVideoCanvas.offset());
    };
    
    /**
    	Clears the canvas from all drawn lines.
	*/
	var clearCanvas = function(canvas) {
		var ctx = canvas.getContext('2d');
		
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	};
});