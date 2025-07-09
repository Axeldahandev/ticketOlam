import Event from "../schemas/Event.js";

const listOfTickets = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 25;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const sortBy = "date";

        const filter = {
            ...(search && { name: { $regex: search, $options: "i" } }),
            original_ticketmaster_api_url: { $ne: "" }
        };

        const events = await Event.find(filter)
            .collation({ locale: "fr", strength: 1 })
            .sort({ [sortBy]: -1 });

        const expandedEvents = [];

        for (const event of events) {
            const tickets = event.tickets || [];

            // Grouper tickets par date
            const groupedByDate = {};

            for (const ticket of tickets) {
                if (!ticket.dateSeance) continue;
                const dateKey = new Date(ticket.dateSeance).toISOString();

                if (!groupedByDate[dateKey]) {
                    groupedByDate[dateKey] = [];
                }
                groupedByDate[dateKey].push(ticket);
            }

            for (const [dateIso, ticketsForDate] of Object.entries(groupedByDate)) {
                const date = new Date(dateIso);
                const formattedDate = date.toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "Europe/Paris"
                }).replace(",", " -").replace(/\.$/, "");

                // Détermination correcte de onsale
                let onsale = false;

                for (const ticket of ticketsForDate) {
                    const infoCategories = ticket.infoCategories || [];
                    for (const category of infoCategories) {
                        // Si VGListing existe directement sur category
                        if (category.VGListing && typeof category.VGListing === 'object') {
                            onsale = true;
                            break;
                        }
                        // Si VGListing existe dans zones
                        const zones = category.zones || [];
                        for (const zone of zones) {
                            if (zone.VGListing && typeof zone.VGListing === 'object') {
                                onsale = true;
                                break;
                            }
                        }
                        if (onsale) break;
                    }
                    if (onsale) break;
                }

                expandedEvents.push({
                    event_id: event._id,
                    event_name: event.name,
                    venue: event.venue,
                    created_at: event.created_at,
                    updated_at: event.updated_at,
                    dates_count: Object.keys(groupedByDate).length,
                    date: formattedDate,
                    onsale // ✅ désormais correct
                });
            }
        }

        const totalDates = expandedEvents.length;
        const totalEvents = events.length;
        const totalPages = Math.ceil(totalDates / limit);
        const paginatedEvents = expandedEvents.slice(skip, skip + limit);

        res.json({
            page,
            totalPages,
            totalEvents,
            totalDates,
            sortBy,
            events: paginatedEvents
        });

    } catch (error) {
        console.error("❌ [LIST_EVENTS_EXPANDED_BY_DATE] Erreur :", error);
        res.status(500).json({ error: "Erreur serveur lors de la récupération des événements par date." });
    }
};

export { listOfTickets };
