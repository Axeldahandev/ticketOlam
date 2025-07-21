import Event from "../schemas/Event.js";
import path from "path";
import fs from "fs";

const getVGListingsWithSeats = async (req, res) => {
    try {
        const { page = 1, sortBy = "places" } = req.query;
        const events = await Event.find({});
        const listings = [];

        for (const event of events) {
            const eventName = event.name;
            const venue = event.venue?.name || "";
            const city = event.venue?.city || "";
            const country = event.venue?.country || "";

            if (!event.tickets) continue;

            for (const ticket of event.tickets) {
                if (!ticket.infoCategories) continue;

                for (const category of ticket.infoCategories) {
                    if (category.VGListing) {
                        listings.push({
                            eventId: event._id,
                            eventName,
                            venue,
                            city,
                            country,
                            type: "category",
                            TMName: category.llgCatPl,
                            VGName: category.VGListing.blockVG,
                            nbPlaces: category.nbPlaces,
                            eventDate: ticket.dateSeance,
                        });
                    }

                    if (category.zones) {
                        for (const zone of category.zones) {
                            if (zone.VGListing) {
                                listings.push({
                                    eventId: event._id,
                                    eventName,
                                    venue,
                                    city,
                                    country,
                                    type: "zone",
                                    TMName: zone.llczone,
                                    VGName: zone.VGListing.blockVG,
                                    nbPlaces: zone.nbplaces,
                                    eventDate: ticket.dateSeance,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Tri selon le paramètre
        if (sortBy === "date") {
            listings.sort((a, b) => b.eventDate - a.eventDate);
        } else if (sortBy === "places") {
            listings.sort((a, b) => a.nbPlaces - b.nbPlaces);
        }

        // Pagination 50 par page
        const pageInt = parseInt(page);
        const paginatedListings = listings.slice((pageInt - 1) * 50, pageInt * 50);

        res.json({
            count: listings.length,
            page: pageInt,
            totalPages: Math.ceil(listings.length / 50),
            listings: paginatedListings
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des VGListings:", error);
        res.status(500).json({ error: "Erreur serveur lors de la récupération des VGListings." });
    }
};

export { getVGListingsWithSeats };