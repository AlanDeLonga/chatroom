/* 
  Module dependencies:
  
  - Express
  - Http (to run Express)
  - Underscore
  - Socket.IO (Note: need a web server to attach Socket.IO to)
  
*/
var express = require("express")
  , app = express()
  , http = require("http").createServer(app)
  , io = require("socket.io").listen(http)
  , redis = require('redis')
  , _ = require("underscore");

/*
  The list of participants in our chatroom.
  The format of each participant will be:
  {
	id: "sessionId",
	name: "participantName"
  }
*/
var participants = [];
var redisMessages = redis.createClient();

/*********** Server config ***********/

// Server's IP address
app.set("ipaddr", "127.0.0.1");

// Server's port number 
app.set("port", 8080);

// Specify the views folder 
app.set("views", __dirname + "/views");

// View engine is Jade
app.set("view engine", "jade");

// Specify where the static content is
app.use(express.static("public", __dirname + "/public"));

// Tells server to support JSON, urlencoded, and multipart requests
app.use(express.bodyParser());

/*********** Server routing ************/

// Handle route "GET /", as in "http://localhost:8080/"
app.get("/", function(request, response) {

  // Render the index view
  response.render("index");
});

// Post method to create a chat message
app.post("/message", function(request, response){
	
	// The request body expects a param named "message"
	var message = request.body.message;
	
	// If the message is empty or wasn't sent it's a bad request
	if(_.isUndefined(message) || _.isEmpty(message.trim())){
		return response.json(400, {error: "Message is invalid"});
	}
	
	// Grab the sender's name of the message
	var name = request.body.name;
	
	// store the message for later use
	storeMessage(name, message);
	
	// Trigger an event when a user has made a new message
	io.sockets.emit("incommingMessage", {message: message, name: name});
	
	// If it went through let the client know
	response.json(200, {message: "Message recieved"});
});

/*********** Socket.IO events ************/

io.on("connection", function(socket){
	/*
	  When a new user connects to the server, we expect an event called "newUSer"
	  and then we'll emit an event called "newConnection" with a list of all
	  participants to all connected clients
	
	  Also loop through all previous messages saved (set to 10) and emit them
	  to the newly logged on user. This way they can see the last 10 messages
	  sent before they entered the room.
	*/
	socket.on("newUser", function(data){
		participants.push({id: data.id, name: data.name});
		
		redisMessages.lrange("messages", 0, 9, function(err, messages){
			// reverse messages so the newest is on the bottom
			messages = messages.reverse();
			
			messages.forEach(function(message){
				message = JSON.parse(message);
				socket.emit("incommingMessage", {name: message.name, message: message.data});
			});
		});
		
		console.log(participants);
		io.sockets.emit("newConnection", {participants: participants, newuser: data.name});
	});
	
	/*
	  When a user changes their name, we are expecting an event called "nameChange"
	  and then we'll emit an event called "nameChanged" to all participants with
	  the id and new name of the user who emitted the original message
	*/
	socket.on("nameChange", function(data){
		// find the participant by their id and update their name
		_.findWhere(participants, {id: socket.id}).name = data.name;
		io.sockets.emit("nameChanged", {id: data.id, name: data.name, oldname: data.oldname});
	});
	
	/*
	  When a client disconnects from the server, the event "disconnect" is automatically
	  captured by the server. It will then emit an event called "userDisconnected" to
	  all participants with the id of the client that disconnected.
	*/
	socket.on("disconnect", function(){
		var disUser = _.findWhere(participants, {id: socket.id}) || {name: "***"};
		participants = _.without(participants, disUser);
		io.sockets.emit("userDisconnected", {id: socket.id, sender: "system", username: disUser.name, participants: participants});
	});

});

/********* helper functions ********/
/*
  Storing messages to be displayed to new users logging on 
*/
var storeMessage = function(name, data){
	var message = JSON.stringify({name: name, data: data});
	
	redisMessages.lpush("messages", message, function(err, messages){
		// only storing the last 20 messages
		redisMessages.ltrim("messages", 0, 19);
	});
	console.log(data);
}

/*
 Will be used to post alerts to the message board when users
 join, leave and change their name
*/
function alertMessage(data){

}

// Start the http server at port and IP defined above
http.listen(app.get("port"), app.get("ipaddr"), function() {
  console.log("Server up and running. Go to http://" + app.get("ipaddr") + ":" + app.get("port"));
});