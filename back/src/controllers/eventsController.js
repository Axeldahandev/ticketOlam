import Event from "../schemas/Event.js";
import path from "path";
import fs from "fs";

const listOfTickets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const salle = req.query.salle || "";
    const sortBy = "date";

    // FILTRE avec condition AND sur name ET venue.name si les 2 sont fournis
    const filter = {
      original_ticketmaster_api_url: { $ne: "" },
    };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }
    if (salle) {
      filter["venue.name"] = { $regex: salle, $options: "i" };
    }

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
            if (category.VGListing && typeof category.VGListing === 'object') {
              onsale = true;
              break;
            }
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
          dateIso: dateIso,
          onsale
        });
      }
    }

    const totalDates = expandedEvents.length;
    const totalEvents = events.length;
    const totalPages = Math.ceil(totalDates / limit);
    expandedEvents.sort((a, b) => new Date(a.dateIso) - new Date(b.dateIso));
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

function getListingFileNameFromVenueName(venueName) {
    if (!venueName) return null;
    // Nettoyage basique : minuscule, espaces remplacés par "-", accents retirés
    let cleaned = venueName.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
      .replace(/[^a-z0-9\s-]/g, "") // que lettres, chiffres, espace, tiret
      .replace(/\s+/g, "-") // espace -> tiret
      .replace(/-+/g, "-"); // tirets multiples -> 1 tiret
    return `listings_viagogo_${cleaned}.json`;
  }
  
  const deleteEvents = async (req, res) => {
    try {
      const { eventIds } = req.body; // tableau d'IDs à supprimer
  
      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ error: "Liste d'IDs vide ou invalide" });
      }
  
      // 1) Récupérer les événements à supprimer avec leurs infos (notamment la salle)
      const eventsToDelete = await Event.find({ _id: { $in: eventIds } });
  
      // 2) Supprimer les événements en base
      const deleteResult = await Event.deleteMany({ _id: { $in: eventIds } });
  
      // 3) Pour chaque événement, supprimer dans le fichier listing de la salle
      for (const ev of eventsToDelete) {
        const venueName = ev.venue?.name;
        if (!venueName) continue;
  
        const fileName = getListingFileNameFromVenueName(venueName);
        if (!fileName) continue;
  
        const filePath = path.join(process.cwd(), "src", "temp", fileName);
  
        if (!fs.existsSync(filePath)) {
          console.warn(`Fichier listings non trouvé : ${filePath}`);
          continue;
        }
  
        try {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          let eventsInFile = JSON.parse(fileContent);
  
          // Filtrer les événements supprimés
          const filteredEvents = eventsInFile.filter(e => !eventIds.includes(e.event_id));
  
          if (filteredEvents.length === 0) {
            // Supprimer le fichier si plus aucun event
            fs.unlinkSync(filePath);
            console.log(`Fichier listings supprimé car vide : ${fileName}`);
          } else {
            // Réécrire le fichier avec les events filtrés
            fs.writeFileSync(filePath, JSON.stringify(filteredEvents, null, 2));
            console.log(`Fichier listings mis à jour : ${fileName}`);
          }
        } catch (err) {
          console.error(`Erreur traitement fichier ${fileName} :`, err);
        }
      }
  
      return res.json({
        message: `${deleteResult.deletedCount} événements supprimés, fichiers listings mis à jour`,
      });
    } catch (error) {
      console.error("Erreur suppression events :", error);
      return res.status(500).json({ error: "Erreur serveur lors de la suppression" });
    }
  };

const getListOfListingFiles = (req, res) => {
  try {
    const listingsDir = path.resolve("./src/temp"); // dossier où sont stockés les listings
    const files = fs.readdirSync(listingsDir)
      .filter(file => file.endsWith(".json"))
      .map(file => file.replace(".json", "")); // enlever extension

    console.log("Fichiers listings trouvés:", files);

    res.json({ files });
  } catch (error) {
    console.error("Erreur récupération fichiers listings :", error);
    res.status(500).json({ error: "Erreur serveur lors récupération fichiers listings." });
  }
};

const getEventsFromListingFile = (req, res) => {
  try {
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ error: "Paramètre 'file' manquant dans le body." });
    }

    const listingsDir = path.resolve("./src/temp");
    const filePath = path.join(listingsDir, `${file}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Fichier ${file} non trouvé.` });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    let eventsInFile = JSON.parse(fileContent);

    return res.json({ events: eventsInFile });
  } catch (error) {
    console.error("Erreur récupération événements fichier listing:", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
};

export { listOfTickets, deleteEvents, getListOfListingFiles, getEventsFromListingFile };
