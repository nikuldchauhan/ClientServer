
var app = require('express')();
var path = require('path');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var pkg = require( path.join(__dirname, 'package.json') );
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var port = 8080;
io.set('origins', '*:*');

var MessengerAPI = require('./js/messenger.js');
var BusinessAPI = MessengerAPI.buildBusinessAPI();
MessengerAPI.setupPushNotifications();
io.on('connection', function (socket) {
    socket.emit('join', socket['id']);
    var serverInfo = {version:pkg.version,name:"Messenger"};
    socket.emit('serverInfo', serverInfo);
    MessengerAPI.sockets[socket['id']] = socket;
    console.log("[" + MessengerAPI.getCurrentTime() + "] "+ socket['id'] + ' has connected!');

    socket.on('sendPopupToUser', function(data){
        console.log("sendPopupToUser triggered: ", data);
        io.emit("showPopup", data);
    });

    socket.on('sendAnimationToUser', function(data){
        console.log("sendAnimationToUser triggered: ", data);
        io.emit("showAnimation", data);
    });

    socket.on('sendCustomRequestResultToUser', function (args) {
        console.log("sendCustomRequestResultToUser triggered by " + socket['id'] + ": ", args);
        args.targetSocketId = args.request.socketId;
        MessengerAPI.sendCustomRequestResultToUser(args);
    });

    socket.on('broadcastSalonServiceUpdate', function (args){
        console.log('[' + socket.id + '] broadcastSalonServiceUpdate');
        //Notify all connected clients
        socket.broadcast.emit('salonServiceUpdate', args);
        console.log("Broadcasted 'salonServiceUpdate'");
    });

    socket.on('broadcastSalonDataImport', function (args){
        console.log('[' + socket.id + '] broadcastSalonDataImport');
        //Notify all connected clients
        socket.broadcast.emit('salonDataImport', args);
    });

    socket.on("sendMessageToUser", function(args){
        console.log("sendMessageToUser", args);
        args.senderSocketId = socket["id"];
        MessengerAPI.sendMessageToUser(args);
    });

    socket.on("broadcastUserActivity", function (args){
        console.log("[" + socket.id + "] broadcastUserActivity: ", args);
        args.senderSocketId = socket.id;
        MessengerAPI.broadcastUserActivity(args);
    });

    socket.on('updateCurrentUser', function (args) {
        console.log("[" + socket["id"] + "] " + "updateCurrentUser triggered: ", args);
        //BookingAPI.cancelRequest(args);
        var user = {};
        user.firstName = args.firstName;
        user.lastName = args.lastName;
        user.email = args.email;
        user.id = args.userId;
        user.sockedId = socket["id"];
        user.isAdmin = args.isAdmin;
        if(user.isAdmin == "yes"){
            console.log("****" + user.firstName + " " + user.lastName + " is an Admin");
        }
        MessengerAPI.users[socket["id"]] = user;
        console.log(MessengerAPI.getCurrentTime() + " --  User #" + user.id + " / " + user.firstName + " " + user.lastName + " (" + user.email + ") is using Socket " + socket.id);

    });

    socket.on('handlePushNotificationRequest', function(args){
        console.log("[" + socket.id + "] handlePushNotificationRequest: ", args);
        var deviceToken = args.deviceToken;
        var message = args.message;
        
        var payload = JSON.parse(args.payload);
        var options = JSON.parse(args.options);
        options.socket = socket;
        MessengerAPI.sendPushNotification(deviceToken, message, payload, options);
        console.log("handled push notification request");
    });

    socket.on('didReceiveAvailability', function(args){
        console.log('didReceiveAvailability: ', args);
        args.socket = socket;
        MessengerAPI.handleAppointmentAvailability(args);
        //socket.emit('availabilityReceived', {});
    });

    socket.on('disconnect', function () {
        socket.broadcast.emit('disappear', socket['id']);
        delete MessengerAPI.sockets[socket['id']];
        if(MessengerAPI.sockets[socket['id']] != null && MessengerAPI.sockets[socket['id']] != undefined){
            console.log("Deleting socket " + socket.id + " from socket cache");
            delete MessengerAPI.sockets[socket['id']];
        }
        if(MessengerAPI.users[socket['id']] != null && MessengerAPI.users[socket['id']] != undefined){
            var user = MessengerAPI.users[socket['id']];
            console.log("Deleting user/socket mapping (User #" + user.id + "/Socket: " + socket.id + ") from user cache" );
            delete MessengerAPI.users[socket['id']];
        }
        console.log(MessengerAPI.getCurrentTime() + " socket: " + socket['id'] + ' has disconnected!');
    });

});


app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');;
});

app.post('/sendPushNotification', function(req, res){
    console.log("/sendPushNotification endpoint triggered");
    console.log("Result Body: ", req.body);
    var userId = req.body.userId;
    var deviceToken = req.body.deviceToken;
    var message = req.body.message;
    var payload = JSON.parse(req.body.payload);
    var options = JSON.parse(req.body.options);

    MessengerAPI.sendPushNotification(deviceToken, message, payload, options);
    console.log("end /sendPushNotification");
});


http.listen(port, function(){
    console.log("#####################################################################");
    console.log("# Messenger - a real-time message/notification delivery service. #");
    console.log("# v" + pkg.version);
    console.log("# Build Settings:");
    console.log('Listening on *:' + port);
});