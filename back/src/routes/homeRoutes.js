import { Router } from "express";
import { homeController, getEventsCountInDatabase, getVGListingsCountByCountry } from "../controllers/homeController.js";

const router = Router();

router.get("/", homeController);
router.get("/events-count-in-database", getEventsCountInDatabase);
router.get("/vg-listings-count-by-country", getVGListingsCountByCountry);

export default router;
