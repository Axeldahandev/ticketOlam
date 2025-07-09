import Event from "../schemas/Event.js";

const homeController = (req, res) => {
    res.json({ message: "API backend opérationnelle !" });
  };

const getEventsCountInDatabase = async (req, res) => {
  try {
    // Nombre total d'événements
    const total = await Event.countDocuments({
      "venue.country": { $ne: "" }
    });

    // Nombre d'événements par pays
    const counts = await Event.aggregate([
      { $match: { "venue.country": { $ne: "" } } },
      { $group: { _id: "$venue.country", count: { $sum: 1 } } }
    ]);

    const byCountry = counts.map(item => ({
      country: item._id,
      count: item.count
    }));

    res.json({
      total,
      byCountry
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du comptage des événements" });
  }
};

const getVGListingsCountByCountry = async (req, res) => {
  try {
    const events = await Event.find({});
    const countryCounts = [];
    let total = 0;
    let eventsWithAtLeastOneListing = 0;

    for (const event of events) {
        const country = event.venue?.country;
        if (!country) continue;

        let existingCountry = countryCounts.find(c => c.name === country);
        if (!existingCountry) {
            existingCountry = { name: country, listings: 0, events: 0 };
            countryCounts.push(existingCountry);
        }

        let hasListing = false;

        event.tickets?.forEach(ticket => {
            ticket.infoCategories?.forEach(category => {
                if (category.VGListing) {
                    existingCountry.listings += 1;
                    total += 1;
                    hasListing = true;
                }
                category.zones?.forEach(zone => {
                    if (zone.VGListing) {
                        existingCountry.listings += 1;
                        total += 1;
                        hasListing = true;
                    }
                });
            });
        });

        if (hasListing) {
            eventsWithAtLeastOneListing += 1;
            existingCountry.events += 1;
        }
    }

    res.json({ total, eventsWithAtLeastOneListing, countryCounts });
} catch (error) {
    console.error("Erreur lors de la récupération des VGListings:", error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des VGListings." });
}
};

export { homeController, getEventsCountInDatabase, getVGListingsCountByCountry };