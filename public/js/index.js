
function init(){
	// global vars for (client) init function
	var serverBaseUrl = document.domain;
	var username = '';
	/*
	  On client init, try to connect to socket.IO server.
	  Note we don't specify a port since we set up our server
	  to run on port 8080
	*/
	var socket = io.connect(serverBaseUrl);
	
	// Save session ID for later
	var sessionId = '';
	
	
	/*
	  When the client successfuly connects to the server, an
	  event "connect" is emitted. Get the session ID and log it.
	  Also, let the socket.IO server know there's a new user
	  with a session ID and a name. Then emit the "newUser" event.
	*/
	socket.on('connect', function(){
		sessionId = socket.socket.sessionid;
		console.log('Connected ' + sessionId);
		username = prompt("please input your user name:");
		$('#name').val(username);
		socket.emit('newUser', {id: sessionId, name: $('#name').val()});
	});
	
	/*
	  When the server emits the "newConnection" event, reset the
	  participants section and display the connected clients.
	  Then alert the users someone new has joined
	  NOTE: we are assiging the sessionId as the span ID
	*/
	socket.on('newConnection', function(data){
		updateParticipants(data.participants);
		var alert = $('<b class="green">************* "' + data.newuser + '"  has just joined ************</b> <br />');
		
		// post the update message that a new user has entered
		$('#messages').append(alert);
		scrollToMessage();
	});
	
	/*
	 When the server emits the "userDisconnected" event,
	 remove the span element from the participants element
	 NOTE: name is set to "***" if no name was captured
	 this happens when the server goes down and is restarted
	 since we are not storing users name in redis only in memory on the server
	*/
	socket.on('userDisconnected', function(data){
		if(data.username != "***"){
			$('#' + data.id).remove();
			totalParticipants(data.participants);
			// post the update message that the user has left
			$('#messages').append('<b class="red">************* "' + data.username + '"  has just left ***********</b> <br />');
			scrollToMessage();
		}
	});
	
	/*
	  When the server fires the "nameChanged" event, first we update
	  the users name, then we add a messages alerting the users to the name change
	*/
	socket.on('nameChanged', function(data){
		username = data.name;
		$('#' + data.id).html(data.name + ' ' + (data.id === sessionId ? '(You)' : '') + '<br />');
		
		// send an update message alerting other users to the name change
		$('#messages').append('<b class="orange">******** "' + data.oldname + '"  has changed their name to "' + data.name + '" ********</b> <br />');
		scrollToMessage();
	});
	
	/*
	  When recieving a new chat message with the "incommingMessage" event, 
	  perpend it to the messages section.
	*/
	socket.on('incommingMessage', function(data){
		var message = data.message;
		var name = data.name;
		if(name == username){
			$('#messages').append('<b class="blue">' + name + ':</b> ' + message + '<br />');
		}else{
			$('#messages').append('<b>' + name + ':</b> ' + message + '<br />');
		}
		scrollToMessage();
	});
	
	/*
	  Log an error if unable to connect to server
	*/
	socket.on('error', function(reason){
		console.log('Unable to connect to the server', reason);
	});
	
	
	/************** Functions ****************/
	
	/*
	  Scrolls the screen down the most current message and
	  puts the focus on the input field
	*/
	function scrollToMessage(){
		location.hash = '#' + "end";
		$('#outgoingMessage').focus();
	}
	
	// Helper function to update the participants' list and updates the number
	function updateParticipants(participants){
		$('#participants').html('');
		for(var i = 0; i < participants.length; i++){
				$('#participants').append('<span id="' + participants[i].id + '"'+ (username == participants[i].name ? ' class="blue"' : '') +'>' +
				participants[i].name + ' ' +  (participants[i].id === sessionId ? '(You)' : '') + '<br /></span>');	

		}
		totalParticipants(participants);
	}
	
	function totalParticipants(participants){
		$('#totalPart').html(participants.length);
	}
	
	/*
	  "sendMessage" will do a simple AJAX POST call to the server
	  with whatever message was put in the text area.
	*/
	function sendMessage(){
		var outgoingMessage = $('#outgoingMessage').val();
		var name = $('#name').val();
		$('#outgoingMessage').val('');
		$.ajax({
			url: '/message',
			type: 'POST',
			dataType: 'json',
			data: {message: outgoingMessage, name: name}
		});
	}
	
	/*
	  If the user presses Enter key on textarea, call sendMessage if
	  there is something inside the textarea
	*/
	function outgoingMessageKeyDown(event){
		if(event.which == 13){
			if($('#outgoingMessage').val().trim().length <= 0){ return; }
			sendMessage();
			$('#outgoingMessage').val('');
		}
	}
	
	/*
	  Helper function to toggle Send button
	*/
	function outgoingMessageKeyUp(){
		var outgoingMessageValue = $('#outgoingMessage').val();
		$('#send').attr('disabled', (outgoingMessageValue.trim()).length > 0 ? false : true);
	}
	
	/*
	  When a user updates their name, let the server know by emitting the "nameChanged" event
	*/
	function nameFocusOut(){
		var name = $('#name').val();
		socket.emit('nameChange', {id: sessionId, name: name, oldname: username});
	}
	
	/************** Elements setup ****************/
	$('#outgoingMessage').on('keydown', outgoingMessageKeyDown);
	$('#outgoingMessage').on('keyup', outgoingMessageKeyUp);
	$('#name').on('focusout', nameFocusOut);
	$('#send').on('click', sendMessage);
	
}

$(document).on('ready', init);