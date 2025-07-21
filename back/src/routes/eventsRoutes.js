import { Router } from "express";
import { listOfTickets, deleteEvents, getListOfListingFiles, getEventsFromListingFile } from "../controllers/eventsController.js";
import Event from "../schemas/Event.js";

const router = Router();

router.get("/list", listOfTickets);

router.post("/listing-files", getListOfListingFiles);

router.post("/events-from-file", getEventsFromListingFile);

router.get("/:id", async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.json(event);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/delete", deleteEvents);


export default router;