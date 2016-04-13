//Server setup
var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io").listen(server);
var crypto = require("crypto");
var config = require("./config.json");

//DB
var pg = require("pg");
var conString = config.db;
var client = new pg.Client(conString);

//Email
var transporter = require("nodemailer").createTransport(config.email);

//Open port
server.listen(8000);
app.use(express.static(__dirname + "/public"));
console.log("Listening on port 8000");

//Global variables
var open_connections = 0;
var players_online = 0;
var clients = {};

pg.connect(conString, function(err, client, done) {
    if (err != null) { console.log(err); }
    client.query("UPDATE accounts SET logged_in=FALSE", function(err) {
        if (err != null) { console.log(err); }
        done();
    });
});

//Session opened
io.on("connection", function(socket) { // event handler on connection
    
    open_connections++;
    io.sockets.emit("adjustPopulation", { population: open_connections,
        players_online: players_online });

    //WTF refactor this ugly shit
    //Account creation handler
    socket.on("createAccount", function(data) {
        pg.connect(conString, function(err, client, done) {
            if (err != null) { console.log(err); }
            var query = client.query({
                text: "SELECT COUNT(*) FROM accounts WHERE username=$1",
                values: [data.usn]
            }, function(err) { if (err != null) { console.log(err); } });
            query.on("row", function(row, result) { result.addRow(row); });
            query.on("end", function(result) {
                var usernameExists = false;
                if (result.rows[0].count > 0) { usernameExists = true; }
                else {
                    var salt = makeSalt(64);
                    var hash = sha512(data.pwd, salt);
                    client.query({
                        text: "INSERT INTO accounts(username, password, salt" +
                            ", email) VALUES($1, $2, $3, $4)",
                            values: [data.usn, hash.hash, salt, data.em]
                    }, function(err) {
                        if (err != null) { console.log(err); }
                    });
                }
                socket.emit("registerResponse", usernameExists ?
                    { status: "Username already exists" } :
                    { status: "Success" }
                );
                done();
            });
        });
    });
    
    //WTF refactor this ugly shit
    //Refactor this hacky method; problem: can have only one emit call
    //Login handler
    socket.on("login", function(data) {
        
        var handleLogin = function(callback) {
            pg.connect(conString, function(err, client, done) {
                if (err != null) { console.log(err); }
                var query = client.query({
                    text: "SELECT id, salt, password, banned, admin, " +
                        "logged_in FROM accounts WHERE username=$1",
                    values: [data.usn]
                }, function(err) { if (err != null) { console.log(err); } });
                query.on("row", function(row, result) { result.addRow(row); });
                query.on("end", function(result) {
                    var status = "WTF";
                    try {
                        if (sha512(data.pwd, result.rows[0].salt).hash ===
                            result.rows[0].password) {
                            client.query({
                                text: "UPDATE accounts SET last_login=" +
                                    "CURRENT_TIMESTAMP, logged_in=TRUE WHERE" +
                                    " username=$1",
                                values: [data.usn]
                            }, function(err) {
                                if (err != null) { console.log(err); }
                            });
                            if (result.rows[0].banned) {
                                status = "You have been banned";
                            } else if (result.rows[0].logged_in) {
                                status = "You are already logged in";
                            } else {
                                status = "Authenticated successfully";
                                players_online++;
                                socket.broadcast.emit("userLogin",{
                                    username: data.usn
                                });
                                client.query({
                                    text: "UPDATE accounts SET last_known_ip" +
                                        "=$1 WHERE username=$2",
                                    values: [data.ip, data.usn]
                                }, function(err) {
                                    if (err != null) { console.log(err); }
                                });
                                client.query({
                                    text: "INSERT INTO ip_log(account_id, ip" +
                                        ", authenticated) VALUES($1, $2, $3)",
                                    values: [result.rows[0].id, data.ip,
                                        "TRUE"]
                                }, function(err) {
                                    if (err != null) { console.log(err); }
                                });
                            }
                        } else {
                            status = "Wrong password";
                            client.query({
                                text: "INSERT INTO ip_log(account_id, ip, " +
                                    "authenticated) VALUES ($1, $2, $3)",
                                values: [result.rows[0].id, data.ip, "FALSE"]
                            }, function(err) {
                                if (err != null) { console.log(err); }
                            });
                        }
                        socket.emit("loginResponse", {
                            status: status,
                            id: result.rows[0].id,
                            banned: result.rows[0].banned,
                            admin: result.rows[0].admin,
                            username: data.usn
                        });
                    } catch (ex) {
                        status = "Username does not exist";
                        console.log(ex);
                        socket.emit("loginResponse", { status: status });
                    }
                    done();
                    callback && callback();
                });
            });
        }

        var emitLast = function() {
            io.sockets.emit("adjustPopulation", { population: open_connections,
                players_online: players_online });
        };

        handleLogin(function() { emitLast(); });
    });

    //Change password handler
    socket.on("changePassword", function(data) {
        pg.connect(conString, function(err, client, done) {
            var salt;
            if (err != null) { console.log(err); }
            var query = client.query({
                text: "SELECT salt FROM accounts WHERE id=$1",
                values: [data.id]
            }, function(err) { if (err != null) { console.log(err); } });
            query.on("row", function(row, result) { result.addRow(row); });
            query.on("end", function(result) {
                salt = result.rows[0].salt;
                var newHash = sha512(data.pwd, salt).hash;
                client.query({
                    text: "UPDATE accounts SET password=$1 WHERE id=$2",
                    values: [newHash, data.id]
                }, function(err) { if (err != null) { console.log(err); } });
                socket.emit("changePasswordResponse", { status: true });
                done();
            })
        });
    });

    //Forgot password handler
    socket.on("forgotPassword", function(data) {
        pg.connect(conString, function(err, client, done) {
            if (err != null) { console.log(err); }
            var query = client.query({
                text: "SELECT salt FROM accounts WHERE email=$1",
                values: [data.em]
            }, function(err) { if (err != null) { console.log(err); } });
            query.on("row", function(row, result) { result.addRow(row); });
            query.on("end", function(result) {
                var status = "Email is not registered";
                if (result.rows[0] != undefined) {
                    status = "Check your email";
                    var tempPwd = makeSalt(8);
                    var tempHash = sha512(tempPwd, result.rows[0].salt).hash;
                    client.query({
                        text: "UPDATE accounts SET password=$1 WHERE email=$2",
                        values: [tempHash, data.em]
                    }, function(err) {
                        if (err != null) { console.log(err); }
                    });
                    var msg = {
                        from: "combatlifehelp@gmail.com",
                        to: data.em,
                        subject: "Combat Life Password Reset",
                        text: "Your temporary password is " + tempPwd
                    }
                    transporter.sendMail(msg, function(err, info) {
                        if (err) { console.log(err); }
                    });
                }
                socket.emit("forgotPasswordResponse", { status: status });
                done();
            });
        });
    });

    // CHAT
    // receive message
    socket.on('sendMessage', function (data) {
        // we tell the client to execute 'new message'
        io.sockets.emit('new message', {
            usn: data.usn,
            message: data.message
        });
    });

    //Join game handler
    socket.on("joinGame", function(data) {
        console.log("Player " + data.id + " joined the game");
        clients[data.id] = { id: data.id, username: data.usn,
            position: data.position, hp: 100 };

        for (var c in clients) {
            io.sockets.emit("spawnPlayer", { id: clients[c].id,
                position: clients[c].position });
        }
    });

    socket.on("takeDamage", function(data) {
        clients[data.id].hp -= 10;
        if (clients[data.id].hp <= 0) {
            io.sockets.emit("killPlayer", { id: data.id });
        }
    });

    //Player movement handler
    socket.on("playerMovement", function(data) {
        if (data.id > 0 && data.id != undefined)  {
            clients[data.id].position = data.position;
            io.sockets.emit("updatePlayerPosition", { id: data.id, position:
                data.position, direction: data.direction,
                moving: data.moving, attack: data.attack });
        }
    });

    //Session closed
    //WTF something is wrong with this; doesn't work with one person online
    socket.on("closeWindow", function(data) {

        var handleClose = function(callback) {
            open_connections--;
            if (data.id > 0) {
                players_online--;
                pg.connect(conString, function(err, client, done) {
                    if (err != null) { console.log(err); }
                    client.query({
                        text: "UPDATE accounts SET logged_in=FALSE WHERE " +
                            "id=$1",
                         values: [data.id]   
                    }, function(err) {
                        if (err != null) { console.log(err); }
                    });
                    done();
                });
                console.log("Player " + data.id + " disconnected");
                delete clients[data.id];
                
            }
            callback && callback();
        };

        var removeAfter = function(callback) {
            io.sockets.emit("removePlayer", { id: data.id });
            callback && callback();
        };

        var emitLast = function() {
            io.sockets.emit("adjustPopulation", { population: open_connections,
                players_online: players_online });
        };

        socket.broadcast.emit("userLeft", { username: data.username });

        handleClose(function() {
            removeAfter(function() {
                emitLast();
            });
        });
    });
});

//Crypto methods
var makeSalt = function(len){
    return crypto.randomBytes(Math.ceil(len/2)).toString("hex").slice(0, len);
};

var sha512 = function(password, salt){
    var hash = crypto.createHmac("sha512", salt).update(password).digest(
        "hex");
    return { salt: salt, hash: hash };
};