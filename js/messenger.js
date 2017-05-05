
module.exports = {
    businessServerHost: "localhost",
    businessServerPort: 80,
    businessAPI: null,
    sockets: {},
    users: {},
    libraries: {
        request: null,
        path: null,
        pkg: null,
        apn: null,
        apnProvider: null,
        jwt: null,
    },
    sendError: function sendError(socket, message){
        console.log("Messenger::sendError(" + message + ")");
        if(socket == null){
            console.log("Can't send error. Socket is null");
            return;
        }
        if(message == null){
            console.log("Error message is null. rejecting...");
            return;
        }

        var args = {};
        args.message = message;
        args.type = "error";


        // Send error details to socket
        socket.emit("didReceiveError", args);

    },
    getCurrentTime: function getCurrentTime() {

        function addZero(i) {
            if (i < 10) {
                i = "0" + i;
            }
            return i;
        }

        var currentdate = new Date();
        var dateString = (currentdate.getMonth() + 1) + "/"
            + (currentdate.getDate()) + "/"
            + currentdate.getFullYear() + " @ "
            + addZero(currentdate.getHours()) + ":"
            + addZero(currentdate.getMinutes()) + ":"
            + addZero(currentdate.getSeconds());

        return dateString;
    },
    setupPushNotifications: function setupPushNotifications(){
        console.log("Messenger::setupPushNotifications()");
        if(module.exports.libraries.apn == null){
            module.exports.libraries.apn = require('apn');
        }
        var options = {
          token: {
            key: "tokens/APNsAuthKey_63LC6GJ42E.p8",
            keyId: "63LC6GJ42E",
            teamId: "HU8JS5LAUM"
          },
          production: false
        };
        var apn = module.exports.libraries.apn;
        if(apn == null || apn == undefined){
            console.log("apn is missing");
            return;
        }
        module.exports.apnProvider = new apn.Provider(options);
    },
    sendPushNotification: function sendPushNotification(deviceToken, message, payload, options){
        console.log("Messenger::sendPushNotification()");
        var apn = module.exports.libraries.apn;
        if(apn == null || apn == undefined){
            console.log("apn is missing");
            return;
        }
        if(deviceToken == null){
            console.log("deviceToken is missing");
            return;
        }
        if(message == null){
            console.log("message is missing");
            return;
        }
        console.log("---message: " + message);
        if(payload == null){
            console.log("warning: payload is null");
        }
        if(options == null){
            options = {
                badge: 0
            };
        }
        console.log("---options: ", options);
        var note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        note.badge = options.badge;
        note.sound = "ping.aiff";
        note.alert = message;
        note.payload = payload;

        var apnProvider = module.exports.apnProvider;
        apnProvider.send(note, deviceToken).then( (result) => {
          // see documentation for an explanation of result
          console.log("Push notification sent to " + deviceToken + ". Results: ", result);
          if(result.failed != undefined && result.failed != null){
            var i;
            for(i = 0; i < result.failed.length; i++){
                var obj = result.failed[i];
                console.log('Device: ' + obj.device + "\nStatus: " + obj.status + "\nResponse: ", obj.response);
                if(options.socket){
                    console.log("Sending error to " + options.socket.id);
                    options.socket.emit('handlePushNotificationResponse',{status: "failure", message:"Device: " + obj.device + "\nReason: " + obj.response.reason});
                }
            }
          }
          else{
            options.socket.emit('handlePushNotificationResponse',{status: "success", message:"Successfully sent push notification!"});
          }
        });
    },
    sendTestPushNotification: function sendTestPushNotification(deviceToken){
        console.log("Messenger::sendTestPushNotification(deviceToken = " + deviceToken + ")");
        module.exports.sendPushNotification(deviceToken, "Hello  world.", {foo:"bar"});
    },
    buildBusinessAPI: function buildBusinessAPI() {
        module.exports.libraries.request = require('request-json');
        var request = module.exports.libraries.request;
        module.exports.businessAPI = request.createClient('http://' + module.exports.businessServerHost + ":" + module.exports.businessServerPort);
        return module.exports.businessAPI;
    },
    getInfo: function () {
        if (module.exports.libraries.pkg == null) {
            if (module.exports.libraries.path == null) {
                module.exports.libraries.path = require('path');
            }
            module.exports.libraries.pkg = require(module.exports.libraries.path.join(__dirname + "/../", 'package.json'));
        }
        console.log("Messenger server v" + module.exports.libraries.pkg.version);
    },
    sendCustomRequestResultToUser: function sendCustomRequestResultToUser(args){
        console.log("Messenger::sendCustomRequestResultToUser(args: ", args);
        module.exports.sockets[args.targetSocketId].emit("handleCustomRequestResult",args);
    },
    sendToBusiness: function sendToBusiness(data) {
        console.log("pushToServer: ", data);

        var BusinessAPI = module.exports.businessAPI;
        if (BusinessAPI != null && BusinessAPI != undefined) {
            var obj = {data: data};
            var prefix = '';
            if (module.exports.businessServerHost == "localhost") {
                prefix = "/";
            }
            BusinessAPI.post(prefix + '?cmd=sendToBusiness', obj, function (err, res, body) {
                if (body) {
                    console.log("Body: ", body);
                }
                if (err) {
                    console.log(err);
                    return console.log(err);
                } else {
                    return console.log(res.statusCode);
                }
            });
        }
        else {
            console.log("BusinessAPI is null");
        }
    },
    handleAppointmentAvailability: function handleAppointmentAvailability(args){
        console.log("Messenger::handleAppointmentAvailability()");
        console.log("args: ", args);
        var appointmentId = args.appointmentId;
        var timeslots = args.timeslots;
        if(appointmentId == null){
            console.log("appointmentId is null");
            return;
        }
        var technicians = args.technicians;
        if(technicians == null){
            console.log("technicians is null");
            return;
        }
        var BusinessAPI = module.exports.businessAPI;
        if (BusinessAPI != null && BusinessAPI != undefined) {
            var obj = {appointmentId: appointmentId};
            var prefix = '';
            if (module.exports.businessServerHost == "localhost") {
                prefix = "/";
            }
            var url = prefix + '?cmd=getAppointmentDetails&appointmentId=' + appointmentId;
            console.log("GET: " + url);
            BusinessAPI.get(url, function (err, res, body) {
                if (body) {
                    console.log("Body: ", body);
                    //TODO: Parse out device token and send push notification
                    var deviceToken = body.deviceToken;
                    var salonId = body.appointment.salonId;
                    var serviceId = body.appointment.serviceId;
                    var appointmentId = body.appointment.id;
                    var date = body.appointment.appointmentDate;

                    if(deviceToken == null){
                        console.log("device token is null");
                        return;
                    }
                    
                    var payload = {
                        notificationTitle:"didReceiveAsyncSearchBookingsResult",
                        content:{
                            appointment: {
                                salonId: salonId,
                                serviceId: serviceId,
                                id: appointmentId,
                                date: date},
                            technicians: technicians
                            }
                        };
                    var i;


                    var options = {
                        badge:0,
                        socket: args.socket
                    };
                    var message = "Pick your appointment";
                    module.exports.sendPushNotification(deviceToken, message, payload, options);
                }
                if (err) {
                    console.log(err);
                    return console.log(err);
                } else {
                    return console.log(res.statusCode);
                }
            });
        }
        else {
            console.log("BusinessAPI is null");
        }
        
    },
    sendMessageToUserViaPushNotification: function sendMessageToUserViaPushNotification(args){
        console.log("Messenger::sendMessageToUserViaPushNotification(args:", args);
        if(args.recipientId == null){
            console.log("recipientId is null");
            return;
        }
        var recipientId = args.recipientId;
        if(args.senderId == null){
            console.log("senderId is null");
            return;
        }
        var senderId = args.senderId;
        if(args.message == null){
            console.log("message is null");
            return;
        }
        var message = args.message;
        var BusinessAPI = module.exports.businessAPI;
        if (BusinessAPI != null && BusinessAPI != undefined) {
            var prefix = '';
            if (module.exports.businessServerHost == "localhost") {
                prefix = "/";
            }
            var url = prefix + '?cmd=getMessageDetails&recipientId=' + recipientId + "&senderId=" + senderId;
            console.log("GET: " + url);
            BusinessAPI.get(url, function (err, res, body) {
                if (body) {
                    console.log("Body: ", body);
                    if(body.status == "failure"){
                        console.log("failed to get message details: " + body.message);
                        return;
                    }
                    var deviceTokens = body.deviceTokens;
                    var senderName = body.senderName;

                    if(deviceTokens == null){
                        console.log("device tokens is null");
                        return;
                    }
                    
                    var payload = {
                        notificationTitle:"didReceiveMessage",
                        content:{
                            message:message,
                            recipientId:recipientId,
                            remoteHost:module.exports.businessServerHost,
                            senderId:senderId,
                            senderName:senderName,
                            senderSocketId:"placeholderSocketId"
                        }
                    };
                    var i;


                    var options = {
                        badge:1
                    };
                    for(i = 0; i < deviceTokens.length; i++){
                        var deviceToken = deviceTokens[i].token;
                        module.exports.sendPushNotification(deviceToken, message, payload, options);
                    }
                    
                }
                if (err) {
                    console.log(err);
                    return console.log(err);
                } else {
                    return console.log(res.statusCode);
                }
            });
        }
        else {
            console.log("BusinessAPI is null");
        }
    },
    sendMessageToUser: function sendMessageToUser(args){
        console.log("Messenger::sendMessageToUser(args", args );
        if(args.senderSocketId == null || args.senderSocketId == undefined || args.senderSocketId == ""){
            console.log("senderSocketId is missing");
            return;
        }
        var senderSocket = module.exports.sockets[args.senderSocketId];
        if(senderSocket == null){
            console.log("senderSocket at " + args.senderSocketId + " not found");
            return;
        }

        if(args.message == null || args.message == undefined || args.message == ""){
            module.exports.sendError(senderSocket, "message is missing");
            return;
        }
        if(args.recipientId == null || args.recipientId == undefined || args.recipientId == ""){
            module.exports.sendError(senderSocket, "recipientId is missing");
            return;
        }
        if(args.senderId == null || args.senderId == undefined || args.senderId == ""){
            module.exports.sendError(senderSocket, "senderId is missing");
            return;
        }

        // Send message via push notifications
        module.exports.sendMessageToUserViaPushNotification(args);

  
        
        // Also send to Business to store in DB
        if(args.remoteHost != null && args.remoteHost != undefined){
            checkAndSetBusinessServer(args.remoteHost);
        }
        else{
            console.log("Missing 'remoteHost' field...");
        }
        var BusinessAPI = module.exports.businessAPI;
        if (BusinessAPI != null && BusinessAPI != undefined) {
            var prefix = '';
            if (module.exports.businessServerHost == "localhost") {
                prefix = "/";
            }
            BusinessAPI.post(prefix + '?cmd=processSentMessage', args, function (err, res, body) {
                if (body) {
                    console.log("Body: ", body);
                }
                if (err) {
                    console.log(err);
                    return console.log(err);
                } else {
                    return console.log(res.statusCode);
                }
            });
        }
        else {
            console.log("BusinessAPI is null");
        }
    },

    broadcastUserActivity: function broadcastUserActivity(args){
        console.log("MessengerAPI::broadcastUserActivity: ", args);
        if(args.senderSocketId == null || args.senderSocketId == undefined || args.senderSocketId == ""){
            console.log("senderSocketId is missing");
            return;
        }
        var senderSocket = module.exports.sockets[args.senderSocketId];
        if(senderSocket == null){
            console.log("senderSocket at " + args.senderSocketId + " not found");
            return;
        }
        if(args.message == null || args.message == undefined || args.message == ""){
            module.exports.sendError(senderSocket, "message is missing");
            return;
        }
        if(args.userId == null || args.userId == undefined || args.userId == "" || args.userId == 0){
            module.exports.sendError(senderSocket, "userId is missing");
            return;
        }

        // Broadcast immediately to those listening
        senderSocket.broadcast.emit('didReceiveUserActivity', args);
    }
};

function checkAndSetBusinessServer(remoteHost){
    console.log("MessengerAPI::checkAndSetBusinessServer(remoteHost = " + remoteHost + ")");
    if(remoteHost == undefined || remoteHost == null){
        console.log("****WARNING: No remote host supplied. Using last default value: (" + module.exports.businessServerHost + ")");
        return;
    }
    remoteHost = remoteHost.toLowerCase();
     if(remoteHost.indexOf("localhost") !== -1){
        console.log("Pointing to Localhost.");
        module.exports.businessServerHost = "localhost";
        module.exports.businessServerPort = 8888;
    }
    
    module.exports.buildBusinessAPI();
}