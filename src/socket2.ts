import { Server as HttpServer } from "http";
import { Socket, Server as SocketIOServer } from "socket.io";
import {
  createRouter,
  createWebRtcTransport,
  rooms,
  findTransportById,
} from "./mediasoup";
import mediaSoup from "mediasoup";

const socketRoomMap = new Map<string, string>();

function setupSocket(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      allowedHeaders: ["*"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log("Client Connected ", socket.id);

    socket.on(
      "createRoom",
      async (
        callback: (response: {
          roomId?: string;
          success: boolean;
          error?: any;
        }) => void
      ) => {
        try {
          const roomId = Math.random().toString(36).substr(2, 9);
          const router = await createRouter();
          rooms.set(roomId, { router, peers: new Map() });
          const room = rooms.get(roomId);
          if (!room) {
            callback({
              success: false,
              error: "Error while creating a room",
            });
            return;
          }
          room.peers.set(socket.id, {
            Sendingtranspors: [],
            Recievingtransports: [],
            consumers: [],
            producers: [],
          });

          callback({
            roomId,
            success: true,
          });
        } catch (error) {
          callback({
            success: false,
            error: error,
          });
        }
      }
    );

    socket.on(
      "joinRoom",
      async (
        { roomId }: { roomId: string },
        callback: (response: {
          success: boolean;
          routerRtpCapabilities?: mediaSoup.types.RtpCapabilities;
        }) => void
      ) => {
        const room = rooms.get(roomId);
        if (!room) {
          callback({
            success: false,
          });
          return;
        }
        socket.join(roomId);
        socketRoomMap.set(socket.id, roomId);
        callback({
          success: true,
          routerRtpCapabilities: room.router.rtpCapabilities,
        });

        socket.on("disconnect", () => {
          room.peers.delete(socket.id);
          socketRoomMap.delete(socket.id);
          if (room.peers.size === 0) {
            rooms.delete(roomId);
          }
        });
      }
    );

    socket.on(
      "connectTransport",
      async (
        {
          transportID,
          dtlsParameters,
        }: {
          transportID: string;
          dtlsParameters: mediaSoup.types.DtlsParameters;
        },
        callback: (response: {
          success: boolean;
          message?: string;
          error?: any;
        }) => void
      ) => {
        try {
          const roomId = socketRoomMap.get(socket.id);
          if (!roomId) {
            console.error("RoomID not found");
            callback({
              success: false,
            });
            return;
          }

          const transport = await findTransportById(transportID, roomId);
          if (!transport) {
            console.log("Transport Not Found");
            callback({
              success: false,
            });
            return;
          }
          await transport.connect({ dtlsParameters });
          callback({
            success: true,
            message: "Transport connected",
          });
        } catch (error) {
          callback({
            success: false,
            error,
          });
        }
      }
    );

    socket.on(
      "createSendTransport",
      async (
        callback: (response: {
          success: boolean;
          iceParameters?: mediaSoup.types.IceParameters;
          iceCandidates?: mediaSoup.types.IceCandidate[];
          dtlsParameters?: mediaSoup.types.DtlsParameters;
          transportID?: string;
          error?: any;
        }) => void
      ) => {
        try {
          const roomId = socketRoomMap.get(socket.id);
          if (!roomId) {
            console.error("RoomID not found");
            callback({
              success: false,
            });
            return;
          }
          const room = rooms.get(roomId);
          if (!room) {
            console.error("Room not found");
            callback({
              success: false,
            });
            return;
          }
          const SendTransport = await createWebRtcTransport(room.router);

          // Ensure the peer object exists
          let peer = room.peers.get(socket.id);
          if (!peer) {
            peer = {
              Sendingtranspors: [],
              Recievingtransports: [],
              producers: [],
              consumers: [],
            };
            room.peers.set(socket.id, peer);
          }

          peer.Sendingtranspors?.push(SendTransport);
          console.log("peer", peer);

          callback({
            success: true,
            dtlsParameters: SendTransport.dtlsParameters,
            iceCandidates: SendTransport.iceCandidates,
            iceParameters: SendTransport.iceParameters,
            transportID: SendTransport.id,
          });
        } catch (error) {
          callback({
            success: false,
            error,
          });
        }
      }
    );

    socket.on(
      "createRecievingTransport",
      async (
        callback: (response: {
          success: boolean;
          iceParameters?: mediaSoup.types.IceParameters;
          iceCandidates?: mediaSoup.types.IceCandidate[];
          dtlsParameters?: mediaSoup.types.DtlsParameters;
          error?: any;
          transportId?: string;
        }) => void
      ) => {
        try {
          ("recieve Transport emit hua");
          const roomId = socketRoomMap.get(socket.id);
          if (!roomId) {
            console.error("RoomID not found");
            callback({
              success: false,
            });
            return;
          }
          const room = rooms.get(roomId);
          if (!room) {
            console.error("Room not found");
            callback({
              success: false,
            });
            return;
          }
          const RecieveTransport = await createWebRtcTransport(room.router);

          // Ensure the peer object exists
          let peer = room.peers.get(socket.id);
          if (!peer) {
            peer = {
              Sendingtranspors: [],
              Recievingtransports: [],
              producers: [],
              consumers: [],
            };
            room.peers.set(socket.id, peer);
          }

          peer.Recievingtransports?.push(RecieveTransport);
          callback({
            success: true,
            dtlsParameters: RecieveTransport.dtlsParameters,
            iceCandidates: RecieveTransport.iceCandidates,
            iceParameters: RecieveTransport.iceParameters,
            transportId: RecieveTransport.id,
          });
        } catch (error) {
          callback({
            success: false,
            error,
          });
        }
      }
    );

    socket.on(
      "produceMedia",
      async (
        {
          kind,
          rtpParameters,
          transportId,
        }: {
          kind: mediaSoup.types.MediaKind;
          rtpParameters: mediaSoup.types.RtpParameters;
          transportId: string;
        },
        callback: (response: {
          success: boolean;
          producerId?: string;
          error?: any;
        }) => void
      ) => {
        try {
          const roomId = socketRoomMap.get(socket.id);
          if (!roomId) {
            console.error("RoomId not found");
            callback({
              success: false,
            });
            return;
          }
          const room = rooms.get(roomId);
          if (!room) {
            console.error("Room not found");
            callback({
              success: false,
            });
            return;
          }
          const transport = await findTransportById(transportId, roomId);

          if (!transport) {
            callback({
              success: false,
            });
            console.log("Transport Not Found");
            return;
          }

          const producer = await transport.produce({ kind, rtpParameters });

          room.peers.get(socket.id)?.producers.push(producer);
          callback({
            success: true,
            producerId: producer.id,
          });

          socket.broadcast.to(roomId).emit("newProducer", {
            producerId: producer.id,
            socketId: socket.id,
          });
          producer.observer.on("close", () => console.log("Producer closed"));
        } catch (error) {
          callback({
            success: false,
            error,
          });
        }
      }
    );

    socket.on(
      "consumeMedia",
      async (
        {
          transportId,
          producerId,
          rtpCapabilities,
        }: {
          transportId: string;
          producerId: string;
          rtpCapabilities: mediaSoup.types.RtpCapabilities;
        },
        callback: (response: {
          success: boolean;
          id?: string;
          producerId?: string;
          kind?: mediaSoup.types.MediaKind;
          rtpParameters?: mediaSoup.types.RtpParameters;
          error?: any;
        }) => void
      ) => {
        try {
          console.log("consume media emit huaa");

          const roomId = socketRoomMap.get(socket.id);
          if (!roomId) {
            console.error("RoomId not found");
            callback({
              success: false,
            });
            return;
          }

          const room = rooms.get(roomId);
          if (!room) {
            console.error("Room not found");
            callback({
              success: false,
            });
            return;
          }

          // Search for the producer among all peers in the room
          let producer: mediaSoup.types.Producer | undefined;
          for (const peer of room.peers.values()) {
            producer = peer.producers.find((p) => p.id === producerId);
            if (producer) break;
          }

          if (!producer) {
            console.error("Producer not found");
            callback({
              success: false,
            });
            return;
          }

          if (!room.router.canConsume({ producerId, rtpCapabilities })) {
            console.error("Cannot consume");
            callback({
              success: false,
            });
            return;
          }

          const transport = await findTransportById(transportId, roomId);
          if (!transport) {
            console.log("Transport not found");
            callback({
              success: false,
            });
            return;
          }

          const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
          });

          room.peers.get(socket.id)?.consumers.push(consumer);
          callback({
            id: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            success: true,
          });

          consumer.observer.on("close", () => console.log("Consumer closed"));
          return;
        } catch (error) {
          callback({
            success: false,
            error,
          });
        }
      }
    );
  });
}

export { setupSocket };
