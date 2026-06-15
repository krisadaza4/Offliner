var wget = require('../wget');
var archiver = require('../archiver');

module.exports = (io) => {
  io.on('connection', function (socket) {
    socket.on('request', function (data) {
      console.log("Request connection received %s", data.token);
      if (socket.wgetProcess) {
        try {
          socket.wgetProcess.kill();
        } catch (e) {}
      }
      socket.wgetProcess = wget(io, data, socket);
    });

    socket.on('disconnect', function () {
      console.log("User disconnected, keeping processes running to allow automatic resume on reconnect.");
    });
  });
};
