// CHAT section
// tell the chat clients when a user has logged in
socket.on("userLogin", function (data) {
    log(data.username + ' joined');
});

// tell the chat clients when a user has logged out
socket.on("userLeft", function (data) {
    log(data.username + ' left');
});

// receives message with the username and message from backend
socket.on("new message", function(data){
    if(username != data.usn){
        addChatMessage({
            username: data.usn + ": ",
            message: data.message
        });
    }
});

// prevents markup from being injected into message
function cleanInput (input) {
    return $('<div/>').text(input).text();
}

// creates log messages (welcome message, user sign in/out)
function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    if(id > -1)
        addMessageElement($el, options);
}

function addChatMessage (data, options) {
    options = options || {};
    
    var $usernameDiv = $('<strong><span class="username"/></strong>')
        .text(data.username);
    var $messageBodyDiv = $('<span class="messageBody">')
        .text(data.message);

    var $messageDiv = $('<li class="message"/>')
        .data('username', data.username)
        .append($usernameDiv, $messageBodyDiv);

    if(id > -1)
        addMessageElement($messageDiv, options);
}

function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
        options = {};
    }
    if (typeof options.prepend === 'undefined') {
        options.prepend = false;
    }

    if (options.prepend) {
        $("#messages").prepend($el);
    } else {
        $("#messages").append($el);
    }
    $("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
}

function sendMessage () {
    var message = $("#inputMessage").val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message) {
        $("#inputMessage").val('');
        addChatMessage({
            username: username + ": ",
            message: message
        });
        // tell server to execute 'new message' and send along one parameter
        socket.emit('sendMessage',{ usn: username, message: message });
    }
}

// sending message on enter
$(window).keydown(function (event) {
// When the client hits ENTER on their keyboard
    if (event.which === 13) {
        sendMessage();
    }
});