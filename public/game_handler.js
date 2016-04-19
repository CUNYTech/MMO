var playerStorage = {};
var FIREBALL_COOLDOWN = 3000;

var bounds;
var game;

function runGame() {
    game = new Phaser.Game(800, 600, Phaser.AUTO, "game",
        { preload: preload, create: create, update: update });

    function preload() {
        game.load.image("background", "images/maplg.png");
        game.load.spritesheet("player", "images/character.png", 64, 64,
            273);
        game.load.spritesheet("fireball", "images/fireball.png", 64, 64,
            64);
        game.load.image('healthBar', 'images/health.png');
        game.load.audio("backGroundMusic", "music/ComeandFindMe.mp3");
        game.load.image("tree", "images/tree.png");
    }
}

function create() {
    var bgm = game.add.audio("backGroundMusic");
    bgm.loop = true;
    bgm.play();
    background = game.add.tileSprite(0, 0, 3200, 2400, "background");
    game.world.setBounds(0, 0, 3200, 2400);
    game.physics.startSystem(Phaser.Physics.ARCADE);

    player = game.add.sprite(
        Math.floor((Math.random() * 3200) + 1),
        Math.floor((Math.random() * 2400) + 1), "player", 130);
    
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
    player.addChild(game.make.sprite(10, -10, "healthBar"));
    

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

    bounds.forEach(function(tree) {
        tree.body.immovable = true;
        tree.body.setSize(30, 30, 50, 50);
    });

    socket.emit("joinGame", { id: id, usn: username,
        position: player.position });
    game.stage.disableVisibilityChange = true;
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
        game.physics.arcade.collide(player, playerStorage[p]);
        if (game.physics.arcade.collide(playerStorage[p],
            fireballs,
            function(player, fireball) {
                fireball.kill();
                playerStorage[p].children[1].crop(new Phaser.Rectangle(0, 0, 
                playerStorage[p].children[1].width - 3, 11));
            },
            function() {
                return true;
            }, this)) {
            //empty
        }
    }
}

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
}

socket.on("spawnPlayer", function(data) {
    if (id > 0) {
        if (data.id === id) { return; }

        if (!(playerStorage[data.id])) {
            var p = game.add.sprite(data.position.x, data.position.y, "player");
            loadAnimationFrames(p);
            game.physics.arcade.enable(p);
            p.body.setSize(32, 48, 16, 14);
            p.body.immovable = true;
            p.body.moves = false;
            p.addChild(game.make.text(10, -30, data.name, {fontSize: 16}));
            p.addChild(game.make.sprite(10, -10, "healthBar"));

            playerStorage[data.id] = p;
        }

        player.bringToTop();
    }
});

socket.on("updatePlayerPosition", function(data) {
    if (id > 0) {
        if (data.id === id) { return; }
        playerStorage[data.id].position = data.position;
        if (data.moving) {
            playerStorage[data.id].animations.play(data.direction);
        } else if (data.attack === "thrust_") {
            playerStorage[data.id].animations.play("thrust_" +
                data.direction);
            var xOffset = playerStorage[data.id].x;
            var yOffset = playerStorage[data.id].y;
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
            var fireball = fireballs.create(
                playerStorage[data.id].x,
                playerStorage[data.id].y, "fireball", index);

            if (data.direction === "left") {
                fireball.body.velocity.x = -1200;
            } else if (data.direction === "right") {
                fireball.body.velocity.x = 1200;
            } else if (data.direction === "up") {
                fireball.body.velocity.y = -1200;
            } else { fireball.body.velocity.y = 1200; }
        } else {
            if (data.direction === "left") {
                playerStorage[data.id].frame = 117;
            } else if (data.direction === "right") {
                playerStorage[data.id].frame = 143;            
            } else if (data.direction === "up") {
                playerStorage[data.id].frame = 104;            
            } else {
                playerStorage[data.id].frame = 130;            
            }
            playerStorage[data.id].animations.stop();        
        }
    }
});

socket.on("removePlayer", function(data) {
    if (id > 0) {
        playerStorage[data.id].destroy();
        delete playerStorage[data.id];
    }
});

socket.on("killPlayer", function(data) {
    if (data.id != id) {
        playerStorage[data.id].kill();
        delete playerStorage[data.id];
        return;
    } else {
        player.kill();
        player = null;
        player = game.add.sprite(
            Math.floor((Math.random() * 3200) + 1),
            Math.floor((Math.random() * 2400) + 1), "player", 130);
        game.physics.arcade.enable(player);
        player.body.collideWorldBounds = true;
        loadAnimationFrames(player);
        player.addChild(game.make.text(10, -30, username, {fontSize: 16}));
        player.addChild(game.make.sprite(10, -10, "healthBar"));
        game.camera.follow(player);
        socket.emit("joinGame", { id: id, usn: username,
            position: player.position });
    }
});