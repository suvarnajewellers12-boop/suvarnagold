// utils/qz.ts
import qz from "qz-tray";

export const initQZ = async () => {
  try {
    await qz.websocket.connect();
    console.log("QZ Connected");
  } catch (err) {
    console.error("QZ connection failed", err);
  }
};