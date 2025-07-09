import express from "express";
import cors from "cors";
import homeRoutes from "./routes/homeRoutes.js";
import frRoutes from "./routes/frRoutes.js";
import listingsRoutes from "./routes/listingsRoutes.js";
import eventsRoutes from "./routes/eventsRoutes.js";
import errorsRoutes from './routes/errorsRoutes.js';
import connectDatabase from "./config/database.js";
import "./config/cronJobs.js";

const app = express();
const PORT = process.env.PORT || 6001;

app.use(express.json());
app.use(cors({
  origin: '*', // à restreindre plus tard si besoin
}));

app.use("/", homeRoutes);
app.use("/listings", listingsRoutes);
app.use("/fr", frRoutes);
app.use("/events", eventsRoutes);
app.use("/errors", errorsRoutes);

const startServer = async () => {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`✅ OK - Serveur lancé sur http://localhost:${PORT}`);
  });
};

startServer();
