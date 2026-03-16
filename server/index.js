import path from "node:path";
import { Database } from "bun:sqlite";
import { API_PREFIX, HARDCODED_PASSWORD, createApp } from "./app.js";

const PORT = Number(process.env.PORT || 3001);
const DB_PATH = path.join(process.cwd(), "dailynotes.sqlite");
const db = new Database(DB_PATH);
const app = createApp({ db });

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}${API_PREFIX}`);
  console.log(`Local app password: ${HARDCODED_PASSWORD}`);
});
