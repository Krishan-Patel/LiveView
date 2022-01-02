import {useState, useEffect, useRef } from 'react';
import './App.css';
import {Row, Container, Badge, Col} from 'react-bootstrap'
import { io } from "socket.io-client";
import Peer from 'peerjs'


function App() {
  let isHost = useRef(false) // used to know if you are the host or not (need to setup p2p with all the user)
  let hostConnection = useRef(null) // the screen sharing stream 
  let myVideo = useRef(null) // your media stream
  let [videoConnections, setVideoConnections] = useState([])
  let videoRefs = useRef([])
  let [videoTiles, setVideoTiles] = useState([])
  let screenVideo = useRef(null)
  let peer = null 
  let socket = null; 

  function initSocketIO() { 
    socket = io("http://localhost:3001") // connects to the server on port 3001 
    
    socket.on('connect', () => { // function called when connection is established 
    })
    // Sets the user based on server response to if the user if the host of the meeting (only called when first joining the meeting)
    socket.on('isHost', (host, id) => { 
      isHost.current = host; 
      if (host) { 
        navigator.mediaDevices.getDisplayMedia().then(stream => { 
          hostConnection.current = stream
          screenVideo.current.srcObject = stream
        }).catch(() => { 
          alert('error getting screen recording make sure that permissions are enabled in your browser and in system settings')
        })
      } else { 
        console.log(`connecting  to host ${id}`)
        const call = peer.call(id, myVideo.current)
        call.on('stream', (stream) => { 
          hostConnection.current = stream
          screenVideo.current.srcObject = stream
        })
      }
    })

    // When the host leaves and you need to re-establish the host connections 
    socket.on('makeHost', () => { 
      isHost.current = true; 
    })

    socket.on('new-member', (id) => { 
      console.log(peer)
      const call = peer.call(id, myVideo.current)
      console.log(`called new user ${id}`)
      call.on('stream', (stream) => {
        let duplicate = false 
        videoConnections.current.forEach((item) => { 
          if (item.id === stream.id) { 
            duplicate = true
          }
        }) 
        if (!duplicate) { 
          videoConnections.current =  [... videoConnections.current, stream]
          setVideoTiles((current) => { 
            let newTile = (
                <Col lg={9} md={9} xs={9} sm={9} key={id} className='bg-primary mr-2'>
                  <video width={'50%'} height={'50%'} autoPlay ref={video => {video.srcObject = stream}} ></video>
                </Col>
            )
            return [... current, newTile]
          })
        }
      })
    })

    socket.on('remove-member', (id) => { 
      setVideoTiles((current) => { 
        let x = current.filter((item) => item.key === id)
        console.log(x)
        return x 
      })
    })
    socket.on('connectHost', (id) => { 
      
    })
 
  }

  function startUp() { 
    navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(stream => { 
      myVideo.current = stream
      videoConnections.current =  [... videoConnections.current, stream]
      setVideoTiles((current) => { 
        let newTile = (
            <Col lg={9} md={9} xs={9} sm={9} key={'self'} className='bg-primary mr-2'>
              <video width={'50%'} height={'50%'} autoPlay ref={video => {video.srcObject = stream}} ></video>
            </Col>
        )
        return [... current, newTile]
      })
      console.log(videoConnections)
      initSocketIO() 
      peer = new Peer() // initialize peer connection object 
      peer.on('open', (id) => { 
        console.log(`Peer ID ${id}`)
        socket.emit('join-room', id)
      })
      peer.on('call', (call) => {
        console.log(call)
        if (!isHost.current) {
          call.answer(myVideo.current)
          call.on('stream', (stream) => { 
            let duplicate = false 
            videoConnections.current.forEach((item) => { 
              if (item.id === stream.id) { 
                duplicate = true
              }
            }) 
            if (!duplicate) { 
              videoConnections.current =  [... videoConnections.current, stream]
              setVideoTiles((current) => { 
                let newTile = (
                    <Col lg={9} md={9} xs={9} sm={9} key={call.peer} className='bg-primary mr-2'>
                      <video width={'50%'} height={'50%'} autoPlay ref={video => {video.srcObject = stream}} ></video>
                    </Col>
                )
                return [... current, newTile]
              })
            }
          })
        } else { 
          console.log(`answered called with ${hostConnection.current}`)
          console.log(hostConnection.current)
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
    console.log('render')
    startUp()
  },[])

  return (
    <Container fluid>
      <Row className='d-flex justify-content-between m-2'>
          <h1>
            <Badge bg="light">Live</Badge>
            <Badge bg="danger">View</Badge>
          </h1>
          <h3>
            Meeting ID:  
            <Badge>AKDJLAKFJGJKLKJAL</Badge>
          </h3>
      </Row>
      <Row className='m-4'>
        <Col lg={9} md={9} xs={9} sm={9} className='bg-primary mr-2'>
          <video width={'100%'} height={'100%'} ref={video => {screenVideo.current = video}} autoPlay controls></video>
        </Col>
        <Col className='bg-secondary'>
        </Col>
      </Row>
      <Row className='m-4'>
        {videoTiles}
      </Row> 
    </Container>
  ); 
}

export default App;
