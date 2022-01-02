const internal = require('stream');
const express = require('express');
const app = express(); 
const http = require('http').createServer(app);
const PORT = process.env.PORT  || 3001 ;
const io = require('socket.io')(http)

// Serve React FrontEnd 
app.use(express.static('client/build'))

// Global Variables 
let rooms = {};
let MESSAGES = 0;

// Socket IO Connection and Event Handlers 
io.on('connection', socket => {
  console.log(`Connected to Socket ${socket.id}`)
  // initialize all event handlers for the socket 

  socket.on('join-room', (peerID) => { 
    //console.log(`Peer ID ${peerID}`)
    // determine if the user is the call host
    const room = io.of("/").adapter.rooms.get('one');
    //console.log(room)
    if (!room || room.length == 0) { 
      // first user in the meeting 
      //console.log('first user')
      MESSAGES = 0 
      rooms['one'] = socket.id
      socket.emit('isHost', true, undefined) // tells the user they are the host
    } else { 
      socket.emit('isHost', false, io.sockets.sockets.get(rooms['one']).peerID)
    } 
    socket.join('one')
    socket.peerID = peerID
    socket.to('one').emit("new-member", peerID)
  })

  socket.on("disconnect", (reason) => {
    console.log(`${socket.id} is disconnecting`)
    // check if the user is the meeting Host 
    if (socket.id === rooms['one']) { 
      //console.log('host is gone')
      socket.to('one').emit("remove-member", socket.peerID)  // signal to all users to remove the video from feed 
      let user = io.sockets.sockets.values().next().value
      if (user) { 
        //console.log(user.id)  // gets the socket ID of the next user 
        rooms['one'] = user.id
        socket.to(user.id).emit('ready-host')
      }
     
    } else { 
      socket.to('one').emit("remove-member", socket.peerID) // signals all other users to remove the video feed 
      
    }
  })

  socket.on('host-ready', () => { 
    // signal to all users other than host to connect to new hosts screen recording 
    socket.to('one').emit("connectHost", io.sockets.sockets.get(rooms['one']).peerID) 
  })

  socket.on('message', (msg) => { 
    MESSAGES += 1; 
    const message = {
      "text": msg,
      "id": MESSAGES,
      "sender": {
        "name": socket.name ? socket.name : socket.id,
        "uid": socket.id,
        "avatar": "https://images.vexels.com/media/users/3/129733/isolated/preview/a558682b158debb6d6f49d07d854f99f-casual-male-avatar-silhouette.png",
      },
    }
    io.to('one').emit('gotMessage', message); 
  })
   
  socket.on('name-change', (name) => { 
    socket.name = name; 
  })
})

  

http.listen(PORT, function() {
  console.log(`listening on port ${PORT}`)
})