import * as mediasoup from 'mediasoup';

interface Peer {
  Sendingtranspors?: mediasoup.types.WebRtcTransport[];
  Recievingtransports?: mediasoup.types.WebRtcTransport[];
  producers: mediasoup.types.Producer[];
  consumers: mediasoup.types.Consumer[];
}

export interface Room {
  router: mediasoup.types.Router;
  peers: Map<string, Peer>;
}

let worker: mediasoup.types.Worker;
let rooms = new Map<string, Room>();

(async () => {
  worker = await mediasoup.createWorker();
  console.log('Mediasoup worker created');
})();

async function createRouter(): Promise<mediasoup.types.Router> {
  const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000
      }
    }
  ];

  try {
    const router = await worker.createRouter({ mediaCodecs });
    return router;
  } catch (error) {
    console.error('Failed to create router:', error);
    throw error;
  }
}

async function createWebRtcTransport(router: mediasoup.types.Router): Promise<mediasoup.types.WebRtcTransport> {
  try {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '127.0.0.1', announcedIp: '' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true
    });
    return transport;
  } catch (error) {
    console.error('Failed to create WebRTC transport:', error);
    throw error;
  }
}

async function findTransportById(transportId: string, roomId: string): Promise<mediasoup.types.WebRtcTransport | null> {
  const room = rooms.get(roomId);
  if (!room) {
    console.error('Room not found');
    return null;
  }

 

  for (const peer of room.peers.values()) {
    // Check in Sendingtranspors
   
    if (peer.Sendingtranspors) {
      const transport = peer.Sendingtranspors.find(t => t.id === transportId);
      if (transport) {
        return transport;
      }
    }

    // Check in Recievingtransports
    if (peer.Recievingtransports) {
      const transport = peer.Recievingtransports.find(t => t.id === transportId);
      if (transport) {
        return transport;
      }
    }
  }

  console.error('Transport not found');
  return null;
}

export {
  worker,
  rooms,
  createRouter,
  createWebRtcTransport,
  findTransportById
};
