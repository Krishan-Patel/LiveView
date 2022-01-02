import {useState, useEffect, useRef } from 'react';
import './App.css';
import {Row, Container, Badge, Col, Button, Form} from 'react-bootstrap'
import { io } from "socket.io-client";
import Peer from 'peerjs'
import {ChatBox} from 'react-chatbox-component';
import './chatbox.css'

// Constraints for the Media and Display Streams 
const USER_VIDEO_CONFIG = { 
  video: true, 
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100
  }
}

const SCREEN_VIDEO_CONFIG = { 
  video: {
    cursor: "always"
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100
  }
}

function App() {
  let isHost = useRef(false) // track if current user is the host
  let hostConnection = useRef(null) // the screen-sharing MediaStream obtained from the host 
  let myVideo = useRef(null) // the user's Video/Audio MediaStream
  let [videoConnections, setVideoConnections] = useState([]) // Video/Audio MediaStreams of all other users in room 
  let videoRefs = useRef([]) // DOM References to Video Elements 
  let screenVideo = useRef(null) // Dom Reference to Screen Sharing Video Element
  let peer = null // The user's PeerJS Object 
  let socket = useRef(null); // The user's Socket-IO instance 
  let changeButton = useRef(); // Dom Ref to 'Change Stream' button
  let [messages, setMessages] = useState([]); // array of chat-box messsages 
  let [displayName, setDisplayName] = useState('') // user's display-name for the chatbox 
    

  function initSocketIO() { 
    socket.current = io() // connects to the server on port 3001 
    
    socket.current.on('connect', () => { 
    })
    // Determine if the user is the host of the room 
    socket.current.on('isHost', (host, id) => { 
      isHost.current = host; 
      changeButton.current.disabled = !isHost.current
      if (host) { 
        // Obtain a Screen Recording of the host's display
        navigator.mediaDevices.getDisplayMedia(SCREEN_VIDEO_CONFIG).then(stream => { 
          hostConnection.current = stream
          screenVideo.current.srcObject = stream
        }).catch(() => { 
          alert('error getting screen recording make sure that permissions are enabled in your browser and in system settings')
        })
      } else { 
        // Establish a Peer-to-Peer connection with the host and obtain their display MediaStream 
        console.log(`connecting  to host ${id}`)
        const call = peer.call(id, myVideo.current)
        call.on('stream', (stream) => { 
          hostConnection.current = stream
          screenVideo.current.srcObject = stream
        })
      }
    })

    // Alert for when a new user enters the room 
    socket.current.on('new-member', (id) => { 
      // Establish a Peer-to-Peer connection with the new user and exchange video/audio MediaStreams
      const call = peer.call(id, myVideo.current)
      //console.log(`called new user ${id}`)
      call.on('stream', (stream) => {
        // Add the new users MediaStream to the collection of video connections
        setVideoConnections((current) => {
          // Check for duplicate MediaStreams
          let duplicate = false 
          current.forEach((connection) => { 
            if (connection[0].id === stream.id) { 
              duplicate = true 
            }
          })
          if (duplicate) return current
          return [...current, [stream, id]]
        })
      })
    })

    // Alert for when a user leaves the room 
    socket.current.on('remove-member', (id) => { 
      setVideoConnections((current) => current.filter((item) => item[1] !== id))
    })

    // Make the Current user the new host of the room 
    socket.current.on('ready-host', () => { 
      isHost.current = true 
      changeButton.current.disabled = !isHost.current
      // Obtain a Screen Recording of the user's display
      navigator.mediaDevices.getDisplayMedia(SCREEN_VIDEO_CONFIG).then(stream => { 
        hostConnection.current = stream
        screenVideo.current.srcObject = stream
        socket.current.emit('host-ready') // send a message to the server that the host is ready to broadcast their screen
      }).catch(() => { 
        alert('error getting screen recording make sure that permissions are enabled in your browser and in system settings')
      })
    })

    // Connect the user to the host and obtain their display MediaStream
    socket.current.on('connectHost', (id) => { 
      console.log(`connecting  to host ${id}`)
      const call = peer.call(id, myVideo.current)
      call.on('stream', (stream) => { 
        hostConnection.current = stream
        screenVideo.current.srcObject = stream
      })
    })

    // Add a message to the Chat Box 
    socket.current.on('gotMessage', (msg) => { 
      setMessages((current) => [...current, msg])
    })
 
  }

  // Send a Chat Box message to all other users 
  const sendMessage = (msg) => { 
    socket.current.emit('message', msg)
  }

  function startUp() { 
    // Obtain the user's video/audio MediaStream
    navigator.mediaDevices.getUserMedia(USER_VIDEO_CONFIG).then(stream => { 
      myVideo.current = stream
      setVideoConnections((current) => [...current, [stream, 'self']])
      initSocketIO() 
      peer = new Peer() // initialize a PeerJS object
      peer.on('open', (id) => { 
        //console.log(`Peer ID ${id}`)
        socket.current.emit('join-room', id) // Send a Message to the server to join the room 
      })
      // Handles Receiving a P2P connection request 
      peer.on('call', (call) => {
        if (!isHost.current) {
          call.answer(myVideo.current) // answers the connection request with the user's own MediaStream
          call.on('stream', (stream) => { 
            setVideoConnections((current) => { // Add the other users MediaStream to the collection of video connections
              // check for duplicate MediaStreams
              let duplicate = false 
              current.forEach((connection) => { 
                if (connection[0].id === stream.id) { 
                  duplicate = true 
                }
              })
              if (duplicate) return current
              return [...current, [stream, call.peer]]
            })
          })
        } else { 
          console.log(`answered called with ${hostConnection.current}`)
          call.answer(hostConnection.current)
          call.on('stream', (stream) => { 
          })
        }
      })
    }).catch(() => { 
      alert('error getting media devices, please make sure that you have audio and vide enabled and the browser as acces to your audio and video in system settings')
    })
  }

  useEffect(() => { 
    startUp()
  },[])

  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videoConnections.length);
    videoRefs.current.forEach((node, i) => node.srcObject = videoConnections[i][0])
    if (videoRefs.current.length > 0) { 
      videoRefs.current[0].muted = true; 
    }
 }, [videoConnections]);

  return (
    <Container fluid>
      <Row className='d-flex justify-content-between align-items-center m-1' style={{maxHeight: '8vh'}}>
          <h1>
            <Badge bg="light">Live</Badge>
            <Badge bg="danger">View</Badge>
          </h1>
          <Button bg="danger" onClick={() => { 

            navigator.mediaDevices.getDisplayMedia(USER_VIDEO_CONFIG).then(stream => { 
              if (hostConnection.current) { 
                const tracks = hostConnection.current.getTracks(); 
                tracks.forEach((track) => { 
                  track.stop(); 
                })
              }
              hostConnection.current = stream
              screenVideo.current.srcObject = stream
              socket.current.emit('host-ready')
            }).catch((error) => {
              console.log(error) 
            })
          }} ref={button => changeButton.current = button}>Change Stream</Button>
          <Form className='d-flex align-items-center' onSubmit={(e) => { 
            e.preventDefault(); 
            try { 
              socket.current.emit('name-change', displayName); 
            }catch(error) { 
              console.log(error)
            }    
          }}>
            <Form.Group>
              <Form.Control 
              type="text" 
              placeholder='Display Name'
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}/>
            </Form.Group>
          </Form>
      </Row>
      <Row className='m-1' style={{height: '70vh'}} >
        <Col className='mr-2 p-0' style={{flex: 8, backgroundColor: 'black', height: '100%'}}>
          <video width={'100%'} height={'100%'} ref={video => {screenVideo.current = video;}} autoPlay controls></video>
        </Col>
        <Col style={{flex: 3, padding: 0, height: "100%"}}>
        <h3 className='bg-white m-0 text-center' style={{borderRadius:'10px 10px 0 0'}}>Chat</h3>
          <ChatBox
          messages={messages}
          user={{"uid" : socket.current ? socket.current.id : "1"}}
          onSubmit={(msg) => sendMessage(msg)}
          /> 
        </Col>
      </Row>
      <Row className='m-2' style={{height: '20vh'}}>
       <div style={{height: '100%', overflow: 'scroll', display: 'flex', width: '100%'}}>
          {videoConnections.map((stream, i) => { 
            return <video ref={(video) => videoRefs.current[i] = video} key={i} autoPlay width={'100%'} height={'100%'}></video>  
          })}

       </div>
      </Row> 
    </Container>
  ); 
}

export default App;
