import "dotenv/config";
import "./config/env";
import http from "http";
import { createApp } from "./app";
import { initMessagingSocket } from "./modules/messaging/socket";
import { env } from "./config/env";

const port = env.PORT;
const app = createApp();
const httpServer = http.createServer(app);

initMessagingSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`✅ API de gestion écolière démarrée sur http://localhost:${port}`);
  console.log(`   Socket.IO (messagerie temps réel) attaché sur le même port.`);
});
