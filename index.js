const http = require("http");
const { Server } = require("socket.io");

// Inicializace HTTP serveru a Socket.io s povoleným CORS pro vývoj
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*", // Povolit přístup ze všech domén
  },
});

// Globální proměnná pro držení hráče, který čeká na zahájení zápasu
let waitingPlayer = null;

io.on("connection", (socket) => {
  // --- LOGIKA MATCHMAKINGU ---

  if (waitingPlayer === null) {
    // První připojený hráč se stává čekajícím
    waitingPlayer = socket;
    socket.emit("status", "Waiting for opponent...");
  } else {
    // Druhý připojený hráč vytvoří s čekajícím hráčem dvojici
    const roomId = `room_${waitingPlayer.id}_${socket.id}`;

    // Oba hráče připojíme do společné místnosti (room)
    waitingPlayer.join(roomId);
    socket.join(roomId);

    // Informujeme prvního hráče, že hra začíná (nastavíme ho jako hostitele)
    waitingPlayer.emit("start", {
      opponent: socket.id,
      opponentName: socket.handshake.query.name, // Jméno předané z klienta při spojení
      room: roomId,
      side: "left",
      isHost: true,
    });

    // Informujeme druhého hráče, že hra začíná
    socket.emit("start", {
      opponent: waitingPlayer.id,
      opponentName: waitingPlayer.handshake.query.name,
      room: roomId,
      side: "right",
      isHost: false,
    });

    // Po spárování vyprázdníme čekárnu pro další dvojici
    waitingPlayer = null;
  }

  // --- HERNÍ UDÁLOSTI ---

  // Přeposílání pohybu pálky ostatním v místnosti (relay)
  socket.on("paddleMove", (data) => {
    socket.to(data.room).emit("paddleMove", data);
  });

  // Přeposílání pohybu míčku ostatním v místnosti
  socket.on("ballMove", (data) => {
    socket.to(data.room).emit("ballMove", data);
  });

  // --- UKONČENÍ SPOJENÍ ---

  socket.on("disconnect", () => {
    // Pokud se odpojí hráč, který právě čekal v čekárně, musíme ji uvolnit
    if (waitingPlayer === socket) {
      waitingPlayer = null;
    }
  });
});

// Spuštění serveru na portu 3000
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
