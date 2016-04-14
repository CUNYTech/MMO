//get ip
$.getJSON("https://api.ipify.org?format=jsonp&callback=?", function(json) {
    ip = json.ip;
});

//get browser
if ((!!window.opr && !!opr.addons) || !!window.opera ||
    navigator.userAgent.indexOf(' OPR/') >= 0) { browser = "Opera"; }
else if (typeof InstallTrigger !== "undefined") { browser = "Firefox"; }
else if (Object.prototype.toString.call(window.HTMLElement).indexOf(
    "Constructor") > 0) { browser = "Safari"; }
else if (false || !!document.documentMode) { browser = "IE"; }
else if (!!window.StyleMedia) { browser = "Edge"; }
else if (!!window.chrome && !!window.chrome.webstore) { browser="Chrome"; }
else { browser = "Blink"; }

//hide forms
$("#connectionCount").hide();
$("#chat").hide();
$("#loginUsn").focus();

function flashMessage(msg) {
    var $d = $("<h1 id='fadingMsg'>" + msg + "</h1>");
    $("#logo").append($d);
    setTimeout(function() {
        $("#fadingMsg").remove();
    }, 5000);
}

//Event handler for authentication
$("#loginForm").on("submit", function(e) {
    socket.emit("login", {
        usn: $("#loginUsn").val(),
        pwd: $("#loginPwd").val(),
        ip: ip,
        browser: browser
    });
    return false; //don't reload document
});

$(document).on("click", "#forgotPwd", function(e) {
    $("#loginForm").hide();
    $("#noAccount").hide();
    $("#forgotPwd").hide();
    var $f = $("<form id='forgotPwdForm'></form>");
    $f.append("<p>Enter the email you used to register</p>");
    $f.append("<input type='text' maxlength='64' id='forgotPwdEmail' " +
        "pattern='^.*@.*$' placeholder='Email' required><br>");
    $f.append("<button type='button' id='closeForgotPwd'>Back</button>");
    $f.append("<button type='submit' id='submitForgotPwd'>OK</button>");
    $("#loadPageForms").append($f);
    $("#forgotPwdEmail").focus();
    $f.submit(function(e) {
        socket.emit("forgotPassword", { em: $("#forgotPwdEmail").val() });
        $("#forgotPwdForm").remove();
        $("#loginForm").show();
        $("#noAccount").show();
        $("#forgotPwd").show();
        return false;
    });
    $("#closeForgotPwd").click(function() {
        $("#forgotPwdForm").remove();
        $("#loginForm").show();
        $("#noAccount").show();
        $("#forgotPwd").show();
        $("#loginUsn").focus();
    });
});

//Event handler for registration
$(document).on("click", "#register", function(e) {
    $("#loginForm").hide();
    $("#noAccount").hide();
    $("#forgotPwd").hide();
    var $f = $("<form id='registerForm'></form>");
    $f.append("<input type='text' maxlength='64' id='registerUsn' " +
        "pattern='^[A-Za-z0-9]+$' placeholder='Username' required><br>");
    $f.append("<input type='password' id='registerPwd' " +
        "placeholder='Password' required><br>");
    $f.append("<input type='text' maxlength='64' id='registerEmail' " +
        "pattern='^.*@.*$' placeholder='Email' required><br>");
    $f.append("<button type='button' id='closeRegister'>Back</button>");
    $f.append("<button type='submit' id='submitRegister'>OK</button>");
    $("#loadPageForms").append($f);
    $("#registerUsn").focus();
    $f.submit(function(e) {
        socket.emit("createAccount", {
            usn: $("#registerUsn").val(),
            pwd: $("#registerPwd").val(),
            em: $("#registerEmail").val()
        });
        $("#registerForm").remove();
        $("#loginForm").show();
        $("#noAccount").show();
        $("#forgotPwd").show();
        return false; //don't reload document
    });
    $("#closeRegister").click(function() {
        $("#registerForm").remove();
        $("#loginForm").show();
        $("#noAccount").show();
        $("#forgotPwd").show();
        $("#loginUsn").focus();
    });
});

//Event handler for when server sends registration status response
socket.on("registerResponse", function(data) {
    if (data.status === "Username already exists") {
        $("#loadPageOptions").show();
    }
    flashMessage(data.status);
});

//Change password handler
var showChangePwd = false;
$(document).on("click", "#changePwd", function(e) {
    if (showChangePwd) {
        showChangePwd = false;
        var $f = $("<form id='changePwdForm'></form>");
        $f.append("<input type='password' id='newPassword' " +
            "placeholder='New Password' required><br>");
        $f.append("<button type='submit'>OK</button>");
        $("#changePwd").append($f);
        $f.submit(function(e) {
            socket.emit("changePassword", {
                id: id,
                pwd: $("#newPassword").val()
            });
            $("#changePwd").hide();
            $("#changePwdForm").remove();
            showChangePwd = true;
            return false; //don't reload document
        });
    }
});

//Event handler for when server sends password change response
socket.on("changePasswordResponse", function(data) {
    if (data.status) {
        flashMessage("Your password has been changed");
    }
});

//Event handler for when server sends response for forgotten password
socket.on("forgotPasswordResponse", function(data) {
    flashMessage(data.status);
});

//Adjust population
socket.on("adjustPopulation", function(data) {
    if (admin) {
        document.getElementById("connectionCount").innerHTML =
            "Connections open: " + data.population;
    }
    document.getElementById("playerCount").innerHTML =
        "Players online: " + data.players_online;
});

//Event handler for when server sends login status response
socket.on("loginResponse", function(data) {
    if (data.banned) {
        alert("Your account has been banned");
        window.location.reload(true);
    }
    else if (data.status === "Username does not exist" ||
        data.status === "Wrong password") {
        $("#loadPageOptions").show();
    } else if (data.status === "You are already logged in") {
        window.location.reload(true);
    } else { //successful authentication
        id = data.id;
        admin = data.admin;
        username = data.username;
        if (data.admin) { $("#connectionCount").show(); }

        $("#chat").show();
        var message = "Welcome to Combat Life!";
        log(message, {
            prepend: true
            });

        //Account options
        var $f = $("<p id='showUsn'>" + data.username + "</p>");
        var $d = $("<div id='changePwd'>Change password</div>");
        $("#userInfo").append($f);
        $("#userInfo").append($d);
        $("#changePwd").hide();
        $("#userInfo").hover(
            function() {
                $("#changePwd").show();
                showChangePwd = true;
            },
            function() {
                $("#changePwd").hide();
                $("#changePwdForm").remove();
                showChangePwd = false;
            }
        );

        $("#loadPageOptions").hide();
        runGame();
    }
    flashMessage(data.status);
});

//Close window handler
$(window).on("beforeunload", function() {
    if (id > 0) { player.destroy(); }
    socket.emit("closeWindow", { 
        username: username,
        id: id 
    });
});

//Exhaustive handlers for when server disconnects while clients are still
//connected
socket.on("connect_error", function(err) {
    window.location.reload(true);
});

socket.on("connection_timeout", function(err) {
    window.location.reload(true);
});

socket.on("reconnect_attempt", function(err) {
    window.location.reload(true);
});

socket.on("reconnect_error", function(err) {
    window.location.reload(true);
});

socket.on("reconnect_failed", function(err) {
    window.location.reload(true);
});