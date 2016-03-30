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
    var myEquipment = {};

    $("#connectionCount").hide();
    $("#chat").hide();

    $("#loginUsn").focus();

    var socket = io();

    function runGame() {
        game = new Phaser.Game(800, 600, Phaser.AUTO, "game",
            { preload: preload, create: create, update: update, render:
            render });

        function preload() {
            game.load.image("background", "images/maplg.png");
            game.load.spritesheet("player", "images/base_character.png", 64,
                64, 273);
            game.load.image('healthBar', 'images/health.png');
            
            game.load.spritesheet("spear", "images/spear.png", 64, 64, 273);
            game.load.spritesheet("dagger", "images/dagger.png", 64, 64, 273);
            game.load.spritesheet("bomb", "images/bomb.png", 64, 64, 8);
            game.load.audio("backGroundMusic", "music/ComeandFindMe.mp3");
            game.load.image("tree", "images/tree.png");
        }

        function create() {
        	var bgm = game.add.audio("backGroundMusic");
        	bgm.loop = true;
        	bgm.play();
            background = game.add.tileSprite(0, 0, 3200, 2400, "background");
            game.world.setBounds(0, 0, 3200, 2400);
            game.physics.startSystem(Phaser.Physics.ARCADE);

            //player = game.add.sprite(Math.floor((Math.random() * 3200)),
            //    Math.floor((Math.random() * 2400)), "player", 131);
            player = game.add.sprite(200, 200, "player", 130);
            game.physics.arcade.enable(player);
            player.body.collideWorldBounds = true;

            player.body.setSize(32, 48, 16, 14);

            leftKey = game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
            rightKey = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
            upKey = game.input.keyboard.addKey(Phaser.Keyboard.UP);
            downKey = game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
            spaceKey = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);

            loadAnimationFrames(player);
            spear = game.add.sprite(0, 0, "spear", 130);
            loadAnimationFrames(spear);

            player.addChild(spear);
            
            function addHPBar(sprite, health) {
                // hp defaults to 1 and maxHealth defaults to undefined
                sprite.maxHealth = player.health = health;
                var healthBar = game.make.sprite(10, -10, 'healthBar');
                sprite.addChild(healthBar);
                
                healthBar.update = function() {
                    healthBar.scale.x = sprite.health/sprite.maxHealth;
                };
            }
            
            addHPBar(player, 100);
            
            player.update = function() {
                for(var c=0; c < player.children.length; ++c) {
                    var child = player.children[c];
                        child.update();
                    }
            };

            game.camera.follow(player);

            myEquipment["weapon"] = "spear";

            bounds = game.add.physicsGroup();
            for (var i = -30; i < 3200; i += 90) { //horizontal bounds
                bounds.create(i, -30, "tree");
                bounds.create(i, 2310, "tree");
            }
            for (var i = 60; i < 2300; i += 90) { //vertical bounds
                bounds.create(-30, i, "tree");
                bounds.create(3120, i, "tree");
            }
            bounds.create(300, 300, "tree");
            bounds.forEach(function(tree) {
                tree.body.immovable = true;
            });

            socket.emit("joinGame", { id: id, usn: username,
                position: player.position,
                weapon: "spear", equips: myEquipment });

            //bomb = game.add.sprite(0, 0, "bomb", 0);
            //bomb.animations.add("explode", [1, 2, 3, 4, 5, 6, 7], 15, true);
            //bomb.animations.play("explode");
        }

        var dir = "down";
        var isMoving = false;
        var attacked = false;
        function update() {
            player.body.velocity.x = 0;
            player.body.velocity.y = 0;
            game.physics.arcade.collide(player, bounds);
            if (leftKey.isDown) {
                player.body.velocity.x = -150;
                player.animations.play("left");
                spear.animations.play("left");
                dir = "left";
                isMoving = true;
                attacked = false;
            } else if (rightKey.isDown) {
                player.body.velocity.x = 150;
                player.animations.play("right");
                spear.animations.play("right");
                dir = "right";
                isMoving = true;
                attacked = false;
            } else if (upKey.isDown) {
                player.body.velocity.y = -150;
                player.animations.play("up");
                spear.animations.play("up");
                dir = "up";
                isMoving = true;
                attacked = false;
            } else if (downKey.isDown) {
                player.body.velocity.y = 150;
                player.animations.play("down");
                spear.animations.play("down");
                dir = "down";
                isMoving = true;
                attacked = false;
            } else if (spaceKey.isDown) {
                var atk = getAttackStr(myEquipment.weapon);
                player.animations.play(atk + dir);
                spear.animations.play(atk + dir);
                isMoving = false;
                attacked = true;
            } else {
                player.animations.stop();
                spear.animations.stop();
                isMoving = false;
                attacked = false;
                if (dir === "left") { player.frame = spear.frame = 117; }
                else if (dir === "right") { player.frame = spear.frame = 143; }
                else if (dir === "up") { player.frame = spear.frame = 104; }
                else { player.frame = spear.frame = 130; }
            }
            socket.emit("playerMovement", { id: id, position: player.position,
                direction: dir, moving: isMoving, attacked: attacked, weapon:
                myEquipment.weapon });
            for (var p in playerStorage) { //WTF this is the only way to do it
                game.physics.arcade.collide(player, playerStorage[p].player);
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

    // client receive message
    socket.emit("sendMessage",function(data){
        io.socket.emit("receiveMessage", {

        });
    });

    // client receive message
    socket.on("receiveMessage",function(data){

    });

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

    socket.on("updatePlayerPosition", function(data) {
        if (id > 0) {
            if (data.id === id) { return; }
            playerStorage[data.id].player.position = data.position;
            if (data.moving) {
                playerStorage[data.id].player.animations.play(data.direction);
                playerStorage[data.id].weapon.animations.play(data.direction);
            } else if (data.attacked) {
                var atk = getAttackStr(data.weapon);
                playerStorage[data.id].player.animations.play(atk +
                    data.direction);
                playerStorage[data.id].weapon.animations.play(atk +
                    data.direction);
            } else {
                if (data.direction === "left") {
                    playerStorage[data.id].player.frame = 117;
                    playerStorage[data.id].weapon.frame = 117;
                } else if (data.direction === "right") {
                    playerStorage[data.id].player.frame = 143;
                    playerStorage[data.id].weapon.frame = 143;
                } else if (data.direction === "up") {
                    playerStorage[data.id].player.frame = 104;
                    playerStorage[data.id].weapon.frame = 104;
                } else {
                    playerStorage[data.id].player.frame = 130;
                    playerStorage[data.id].weapon.frame = 130;
                }
                playerStorage[data.id].player.animations.stop();
                playerStorage[data.id].weapon.animations.stop();
            }
        }
    });

    Player = function(id, game, position, equips) {
        this.player = game.add.sprite(position.x, position.y, "player");
        loadAnimationFrames(this.player);
        game.physics.arcade.enable(this.player); //prevent player overlap
        this.player.body.setSize(32, 48, 16, 14); //tree
        this.player.body.immovable = true;
        this.player.body.moves = false;

        this.equips = null;

        for (var e in equips) {
            if (e == "weapon") {
                this.weapon = game.add.sprite(0, 0, equips.weapon, 130);
                loadAnimationFrames(this.weapon);
                this.player.addChild(this.weapon);
            }
        }
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

    // CHAT EVENTS
    // event handler for sending message
    $("#chatBox").on("submit", function(e) {
        socket.emit("sendMessage", {
            msg: $("#message").val()
        });
        return false; //don't reload document
    });

    // event handler for receive message
    socket.on("receiveMessage", function(data) {

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
        socket.emit("closeWindow", { id: id });
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