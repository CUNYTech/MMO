// client setup

$(function() {

    //Back-end variables
    var id = -1;
    var admin = false;
    var username;
    var ip = "";
    $.getJSON("https://api.ipify.org?format=jsonp&callback=?", function(json) {
        ip = json.ip;
    });
    var browser = "Unknown";
    if ((!!window.opr && !!opr.addons) || !!window.opera ||
        navigator.userAgent.indexOf(' OPR/') >= 0) { browser = "Opera"; }
    else if (typeof InstallTrigger !== "undefined") { browser = "Firefox"; }
    else if (Object.prototype.toString.call(window.HTMLElement).indexOf(
        "Constructor") > 0) { browser = "Safari"; }
    else if (false || !!document.documentMode) { browser = "IE"; }
    else if (!!window.StyleMedia) { browser = "Edge"; }
    else if (!!window.chrome && !!window.chrome.webstore) { browser="Chrome"; }
    else { browser = "Blink"; }

    //Game variables
    var playerStorage = {};
    var FIREBALL_COOLDOWN = 3000;

    $("#connectionCount").hide();
    $("#chat").hide();

    $("#loginUsn").focus();

    var socket = io();

    function addHPBar(sprite, health) {
        // hp defaults to 1 and maxHealth defaults to undefined
        sprite.maxHealth = player.health = health;
        var healthBar = game.make.sprite(10, -10, 'healthBar');
        sprite.addChild(healthBar);
        
        healthBar.update = function() {
            healthBar.scale.x = sprite.health/sprite.maxHealth;
        };
    }

    function runGame() {
        game = new Phaser.Game(800, 600, Phaser.AUTO, "game",
            { preload: preload, create: create, update: update, render:
            render });

        function preload() {
            game.load.image("background", "images/maplg.png");
            game.load.spritesheet("player", "images/character.png", 64, 64,
                273);

            game.load.spritesheet("fireball", "images/fireball.png", 64, 64,
                64);
            game.load.image('healthBar', 'images/health.png');
            game.load.audio("backGroundMusic", "music/ComeandFindMe.mp3");
            game.load.image("tree", "images/tree.png");
            game.load.image("poisonnessTerrain", "images/poisonessTerrain.jpg");
        }

        function create() {
        	var bgm = game.add.audio("backGroundMusic");
        	bgm.loop = true;
        	bgm.play();
            background = game.add.tileSprite(0, 0, 3200, 2400, "background");
            game.world.setBounds(0, 0, 3200, 2400);
            game.physics.startSystem(Phaser.Physics.ARCADE);

            var style = { font: "bold 32px Arial", fill: "#fff", boundsAlignH: "center", boundsAlignV: "middle" };

		    //  The Text is positioned at 0, 100
		    text = game.add.text(100, 100, "Arrow Keys to move \n[ j ] poke \n[ k ] shoot stuffs \n[ l ] defend (developing)", style);

            //player = game.add.sprite(Math.floor((Math.random() * 3200)),
            //    Math.floor((Math.random() * 2400)), "player", 131);
            /*var randLocation = Math.floor(Math.random() * 4);
            if (randLocation == 0)
            {
            	player = game.add.sprite(200, 200, "player", 130);	
            }
            else if (randLocation == 1)
            {
            	player = game.add.sprite(3000, 200, "player", 130);
            }
            else if (randLocation == 2)
            {
            	player = game.add.sprite(200, 2200, "player", 130);
            }
            else
            {
            	player = game.add.sprite(3000, 2200, "player", 130);
            }*/

            player = game.add.sprite(100, 100, "player", 130);
            
            game.physics.arcade.enable(player);
            player.body.collideWorldBounds = true;

            fireballs = game.add.physicsGroup();

            player.body.setSize(32, 48, 16, 14);

            leftKey = game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
            rightKey = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
            upKey = game.input.keyboard.addKey(Phaser.Keyboard.UP);
            downKey = game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
            jKey = game.input.keyboard.addKey(Phaser.Keyboard.J);
            kKey = game.input.keyboard.addKey(Phaser.Keyboard.K);

            loadAnimationFrames(player);
            
            // add nametag
            // todo: center this properly
            player.addChild(game.make.text(10, -30, username, {fontSize: 16}));
            
            
            addHPBar(player, 100);
            
            player.update = function() {
                for(var c=0; c < player.children.length; ++c) {
                    var child = player.children[c];
                        child.update();
                    }
            };

            game.camera.follow(player);

            bounds = game.add.physicsGroup();
            for (var i = -30; i < 3200; i += 90) { //horizontal bounds
                bounds.create(i, -30, "tree");
                bounds.create(i, 2310, "tree");
            }
            for (var i = 60; i < 2300; i += 90) { //vertical bounds
                bounds.create(-30, i, "tree");
                bounds.create(3120, i, "tree");
            }
            
            var counter = 2100;

            for (var i = 300; i < 2100; i += 100)
            {
            	if (!(i >= 1200 &&  i <= 1400))
            	{
            		bounds.create(i, i, "tree");
            		bounds.create (counter, i, "tree");
            		bounds.create (i, 1500, "tree");
            		bounds.create (1200, i, "tree");
            	}
            	
            	counter -= 100;
            } 

            bounds.create(1200, 1200, "poisonnessTerrain");

            bounds.forEach(function(tree) {
                tree.body.immovable = true;
                tree.body.setSize(30, 30, 50, 50);
            });

            socket.emit("joinGame", { id: id, usn: username,
                position: player.position });

            //bomb = game.add.sprite(0, 0, "bomb", 0);
            //bomb.animations.add("explode", [1, 2, 3, 4, 5, 6, 7], 15, true);
            //bomb.animations.play("explode");
        }

        var dir = "";
        var isMoving = false;
        var attack = null;
        var lastShot = new Date().getTime();
        function update() {
            if (game.physics.arcade.collide(player, fireballs,
                function(player, fireball) {
                    player.children[1].crop(new Phaser.Rectangle(0, 0, 
                        player.children[1].width - 3, 11));
                    socket.emit("takeDamage", { id: id });
                    fireball.kill();
                },
                function(player, fireball) {
                    return true;
                }, this)) {
                //empty
            }
            player.body.velocity.x = 0;
            player.body.velocity.y = 0;
            game.physics.arcade.collide(player, bounds);
            if (leftKey.isDown) {
                player.body.velocity.x = -150;
                player.animations.play("left");
                dir = "left";
                isMoving = true;
                attack = false;
            } else if (rightKey.isDown) {
                player.body.velocity.x = 150;
                player.animations.play("right");
                dir = "right";
                isMoving = true;
                attack = false;
            } else if (upKey.isDown) {
                player.body.velocity.y = -150;
                player.animations.play("up");
                dir = "up";
                isMoving = true;
                attack = false;
            } else if (downKey.isDown) {
                player.body.velocity.y = 150;
                player.animations.play("down");
                dir = "down";
                isMoving = true;
                attack = false;
            } else if (jKey.isDown) {
                player.animations.play("thrust_" + dir);
                isMoving = false;
                attack = "thrust_";
                var xOffset = player.x;
                var yOffset = player.y;
                if (dir === "left") { xOffset -= 32; }
                else if (dir === "right") { xOffset += 32; }
                else if (dir === "up") { yOffset -= 32; }
                else { yOffset += 32; }
                var strikeHitbox = fireballs.create(xOffset, yOffset,
                    "player", 7);
                setTimeout(function() {
                    strikeHitbox.kill();
                }, 70);
            } else if (kKey.isDown) {
                var now = new Date().getTime();
                if (now - lastShot > FIREBALL_COOLDOWN) {
                    lastShot = now;
                    var index;
                    if (dir === "left") { index = 0; }
                    else if (dir === "right") { index = 32; }
                    else if (dir === "up") { index = 16; }
                    else { index = 48; }
                    //var fireball = game.add.sprite(player.x, player.y, "fireball",
                    //    index);
                    var fireball = fireballs.create(player.x, player.y, "fireball",
                        index);
                    if (dir === "left") { fireball.body.velocity.x = -1200; }
                    else if (dir === "right") { fireball.body.velocity.x = 1200; }
                    else if (dir === "up") { fireball.body.velocity.y = -1200; }
                    else { fireball.body.velocity.y = 1200; }
                    isMoving = false;
                    attack = "shoot_";
                } else {
                    attack = "none_";
                }
            } else {
                player.animations.stop();
                isMoving = false;
                attack = false;
                if (dir === "left") { player.frame = 117; }
                else if (dir === "right") { player.frame  = 143; }
                else if (dir === "up") { player.frame  = 104; }
                else { player.frame  = 130; }
            }
            socket.emit("playerMovement", { id: id, position: player.position,
                direction: dir, moving: isMoving, attack: attack });
            for (var p in playerStorage) { //WTF this is the only way to do it
                game.physics.arcade.collide(player, playerStorage[p].player);
                if (game.physics.arcade.collide(playerStorage[p].player,
                    fireballs,
                    function(player, fireball) {
                        fireball.kill();
                    },
                    function() {
                        return true;
                    }, this)) {
                    //empty
                }
            }
        }
        

        function render() {
            //game.debug.body(player);
            //for (var p in playerStorage) {
            //    game.debug.body(playerStorage[p].player);
            //}
             game.debug.text('Elapsed seconds: ' + Math.floor(this.game.time.totalElapsedSeconds()), 32, 32);

        }
    }

    //determine attack based on weapon
    function getAttackStr(weapon) {
        var ret = "";
        switch (weapon) {
            case "spear": ret = "thrust_"; break;
            case "dagger": ret = "slash_"; break;
        }
        return ret;
    }

    socket.on("spawnPlayer", function(data) {
        if (id > 0) {
            if (data.id === id) { return; }

            var p = new Player(data.id, game, data.position, data.equips);
            playerStorage[data.id] = p;

            player.bringToTop();
        }
    });

    socket.on("removePlayer", function(data) {
        if (id > 0) {
            playerStorage[data.id].player.destroy();
            delete playerStorage[data.id];
        }
    });

    socket.on("killPlayer", function(data) {
        if (data.id != id) {
            playerStorage[data.id].player.kill();
            return;
        } else {
            alert("lol noob");
            player.kill();
            player = null;
            player = game.add.sprite(100, 100, "player", 130);
            game.physics.arcade.enable(player);
            player.body.collideWorldBounds = true;
            loadAnimationFrames(player);
            player.addChild(game.make.text(10, -30, username, {fontSize: 16}));
            game.camera.follow(player);
            addHPBar(player, 100);
            socket.emit("joinGame", { id: id, usn: username,
                position: player.position });
        }
    });

    socket.on("updatePlayerPosition", function(data) {
        if (id > 0) {
            if (data.id === id) { return; }
            playerStorage[data.id].player.position = data.position;
            if (data.moving) {
                playerStorage[data.id].player.animations.play(data.direction);
            } else if (data.attack === "thrust_") {
                playerStorage[data.id].player.animations.play("thrust_" +
                    data.direction);
                var xOffset = playerStorage[data.id].player.x;
                var yOffset = playerStorage[data.id].player.y;
                if (data.direction === "left") { xOffset -= 32; }
                else if (data.direction === "right") { xOffset += 32; }
                else if (data.direction === "up") { yOffset -= 32; }
                else { yOffset += 32; }
                var strikeHitbox = fireballs.create(xOffset, yOffset,
                    "player", 7);
                setTimeout(function() {
                    strikeHitbox.kill();
                }, 70);
            } else if (data.attack === "shoot_") {
                if (data.direction === "left") { index = 0; }
                else if (data.direction === "right") { index = 32; }
                else if (data.direction === "up") { index = 16; }
                else { index = 48; }
                /*var fireball = game.add.sprite(
                    playerStorage[data.id].player.x,
                    playerStorage[data.id].player.y, "fireball", index);
                game.physics.enable(fireball, Phaser.Physics.ARCADE);*/
                var fireball = fireballs.create(
                    playerStorage[data.id].player.x,
                    playerStorage[data.id].player.y, "fireball", index);

                if (data.direction === "left") {
                    fireball.body.velocity.x = -1200;
                } else if (data.direction === "right") {
                    fireball.body.velocity.x = 1200;
                } else if (data.direction === "up") {
                    fireball.body.velocity.y = -1200;
                } else { fireball.body.velocity.y = 1200; }
            } else {
                if (data.direction === "left") {
                    playerStorage[data.id].player.frame = 117;
                } else if (data.direction === "right") {
                    playerStorage[data.id].player.frame = 143;            
                } else if (data.direction === "up") {
                    playerStorage[data.id].player.frame = 104;            
                } else {
                    playerStorage[data.id].player.frame = 130;            
                }
                playerStorage[data.id].player.animations.stop();        
            }
        }
    });

    Player = function(id, game, position) {
        this.player = game.add.sprite(position.x, position.y, "player");
        loadAnimationFrames(this.player);
        game.physics.arcade.enable(this.player); //prevent player overlap
        this.player.body.setSize(32, 48, 16, 14); //tree
        this.player.body.immovable = true;
        this.player.body.moves = false;
    };

    function loadAnimationFrames(mapObject) {
        mapObject.animations.add("left", [118, 119, 120, 121, 122, 123,
            124, 125], 15, true);
        mapObject.animations.add("right", [144, 145, 146, 147, 148, 149,
            150, 151], 15, true);
        mapObject.animations.add("up", [105, 106, 107, 108, 109, 110,
            111,112], 15, true);
        mapObject.animations.add("down", [131, 132, 133, 134, 135, 136,
            137, 138], 15, true);

        mapObject.animations.add("thrust_left", [66, 67, 68, 69, 70, 71, 72],
            15, true);
        mapObject.animations.add("thrust_right", [92, 93, 94, 95, 96, 97,
            98], 15, true);
        mapObject.animations.add("thrust_up", [53, 54, 55, 56, 57, 58, 59],
            15, true);
        mapObject.animations.add("thrust_down", [79, 80, 81, 82, 83, 84, 85],
            15, true);

        mapObject.animations.add("slash_up", [157, 158, 159, 160, 161],
            15, true);
        mapObject.animations.add("slash_left", [170, 171, 172, 173, 174],
            15, true);
        mapObject.animations.add("slash_down", [183, 184, 185, 186, 187],
            15, true);
        mapObject.animations.add("slash_right", [196, 197, 198, 199, 200],
            15, true);
    }

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

    //Adjust population
    socket.on("adjustPopulation", function(data) {
        if (admin) {
            document.getElementById("connectionCount").innerHTML =
                "Connections open: " + data.population;
        }
        document.getElementById("playerCount").innerHTML =
            "Players online: " + data.players_online;
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
});