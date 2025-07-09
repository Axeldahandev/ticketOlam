import { Router } from "express";
import { getVGListingsWithSeats } from "../controllers/listingsController.js";
import Event from "../schemas/Event.js";

const router = Router();

router.get("/", getVGListingsWithSeats);

router.patch('/stop-listing', async (req, res) => {
    const { eventName, venue, dateSeance, TMName, VGName, type } = req.body;

    try {
        const filter = {
            name: eventName,
            "venue.name": venue,
            "tickets.dateSeance": dateSeance,
            "tickets.infoCategories": {
                $elemMatch: type === "zone"
                    ? { "zones.llczone": TMName, "zones.VGListing.blockVG": VGName }
                    : { llgCatPl: TMName, "VGListing.blockVG": VGName }
            }
        };

        const update = {
            $unset: type === "zone"
                ? { "tickets.$[].infoCategories.$[].zones.$[zone].VGListing": "" }
                : { "tickets.$[].infoCategories.$[cat].VGListing": "" },
            $set: { updated_at: new Date() }
        };

        const arrayFilters = type === "zone"
            ? [{ "zone.llczone": TMName, "zone.VGListing.blockVG": VGName }]
            : [{ "cat.llgCatPl": TMName, "cat.VGListing.blockVG": VGName }];

        const result = await Event.collection.updateOne(
            filter,
            update,
            { arrayFilters }
        );

        res.json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: result.modifiedCount === 0
                ? "Aucun document modifié (VGListing déjà supprimé ou non trouvé)."
                : "VGListing supprimé et updatedAt mis à jour."
        });
    } catch (error) {
        console.error("❌ Erreur lors de la suppression de VGListing via driver natif :", error);
        res.status(500).json({ error: "Erreur lors de la suppression de VGListing." });
    }
});

export default router;