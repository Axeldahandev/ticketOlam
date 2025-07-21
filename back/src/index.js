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

app.use(express.json());
app.use(cors({
  origin: "*", // temporairement pour tester
}));

app.use((req, res, next) => {
  // console.log("Request received from:", req.headers.origin);
  next();
});

app.use("/", homeRoutes);
app.use("/listings", listingsRoutes);
app.use("/fr", frRoutes);
app.use("/events", eventsRoutes);
app.use("/errors", errorsRoutes);


const startServer = async () => {
  await connectDatabase();
  app.listen(6001, '0.0.0.0', () => {
    console.log(`✅ OK - Serveur lancé sur http://localhost:6001}`);
  });
};

startServer();
