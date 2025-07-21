import Event from "../../../schemas/Event.js";
import fs from "fs";
import path from "path";

// Fonction maison pour nettoyer le nom salle en slug propre
function slugifyVenueName(name) {
  if (!name) return "unknown";
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // supprime accents
    .replace(/[^a-z0-9]+/g, "-")                    // remplace non-alphanum par tiret
    .replace(/^-+|-+$/g, "")                         // supprime tirets debut/fin
    .replace(/-+/g, "-");                            // plusieurs tirets → un seul
}

const extractAndFilterListings = async (req, res, next) => {
  try {
    // 1. Récupérer tous les évènements cibles
    const events = await Event.find({
      $and: [
        { steps: { $elemMatch: { step_id: 1, status: true } } },
        { steps: { $elemMatch: { step_id: 2, status: true } } },
        { steps: { $elemMatch: { step_id: 3, status: false } } },
        { "venue.country": "France" }
      ]
    });

    // 2. Détection stricte des doublons par tickets identiques (hors _id & infoCategories) et MAJ en DB
    const seen = {};
    let doublons = 0;
    const uniqueEvents = [];

    for (const event of events) {
      const normTickets = normalizeTickets(event.tickets);
      const key = normTickets.join("|||");

      if (seen[key]) {
        // Doublon → MAJ en base
        const newSteps = (event.steps || []).map(s => ({
            ...s,
            status: true
          }));
          
        const setObj = {
          tickets: [{ Doublon: true }],
          updated_at: new Date(),
          original_ticketmaster_api_url: "",
          website_url: "",
          tickets_url: "",
          viagogo_listings: [],
          venue: {
            name: "",
            city: "",
            country: "",
            postal_code: ""
          },
          classifications: {
            segment: "",
            genre: "",
            subgenre: ""
          },
          steps: newSteps
        };
          
        await Event.updateOne(
          { _id: event._id },
          { $set: setObj }
        );

        doublons++;
      } else {
        seen[key] = true;
        uniqueEvents.push(event); // Ajoute les uniques dans un tableau
      }
    }

    console.log(`\n🔁 [B1] [INFO] ${doublons} doublon(s) ne seront pas traités.`);

    // 3. Filtrage et regroupement (inchangé)
    const groupedResults = {};
    let totalListings = 0;

    for (const event of uniqueEvents) {
      let eventHasListing = false; // On ne fait la MAJ que si au moins 1 listing trouvé

      for (const ticket of event.tickets || []) {
        if (!Array.isArray(ticket.infoCategories)) continue;
        const dateSeance = ticket.dateSeance || event.local_date;
        const groupKey = `${event._id}|||${dateSeance}`;
        if (!groupedResults[groupKey]) {
          groupedResults[groupKey] = {
            event_id: event._id,
            ticketmaster_id: event.ticketmaster_id,
            ticketmaster_url: event.website_url,
            event_name: event.name,
            date_seance: dateSeance,
            venue: event.venue,
            listings: [],
            _catSet: new Set(),
            _zoneSet: new Set()
          };
        }
        // Catégories
        for (const cat of ticket.infoCategories) {
          const catLabel = cat.llgCatPl || cat.llcCatPl || cat.codCatPl;
          if (cat.nbPlaces >= 80) {
            if (catLabel && !groupedResults[groupKey]._catSet.has(catLabel)) {
              groupedResults[groupKey].listings.push({
                zone_label: catLabel,
                nbPlaces: cat.nbPlaces,
                price: cat.infoNatCliTarifs?.[0]?.price ?? null,
                listingPrice: Number((cat.infoNatCliTarifs?.[0]?.price ?? 0) * 1.2),
                max_buy: cat.infoNatCliTarifs?.[0]?.max ?? null,
                devise: cat.infoNatCliTarifs?.[0]?.devise ?? "EUR",
                date_seance: dateSeance,
                type: "category"
              });
              groupedResults[groupKey]._catSet.add(catLabel);
              totalListings++;
              eventHasListing = true;
            }
          }

          // Zones
          for (const zone of cat.zones || []) {
            const zoneLabel = zone.llczone || zone.placementcatpl || zone.idzone;
            if (zone.nbplaces >= 50) {
              if (zoneLabel && !groupedResults[groupKey]._zoneSet.has(zoneLabel)) {
                groupedResults[groupKey].listings.push({
                  zone_label: zoneLabel,
                  nbPlaces: zone.nbplaces,
                  price: cat.infoNatCliTarifs?.[0]?.price ?? null,
                  listingPrice: Number((cat.infoNatCliTarifs?.[0]?.price ?? 0) * 1.2),
                  max_buy: cat.infoNatCliTarifs?.[0]?.max ?? null,
                  devise: cat.infoNatCliTarifs?.[0]?.devise ?? "EUR",
                  date_seance: dateSeance,
                  type: "zone",
                  category_mere: catLabel
                });
                groupedResults[groupKey]._zoneSet.add(zoneLabel);
                totalListings++;
                eventHasListing = true;
              }
            }
          }

        }
      }

      // --- MAJ DU STEP 3 : Une seule fois par event (si listings trouvés) ---
      if (eventHasListing) {
        await Event.updateOne(
          { _id: event._id, "steps.step_id": 3 },
          { $set: { "steps.$.status": true, updated_at: new Date() } }
        );
      }
    }

    // 6. Nettoyage final
    const finalResult = Object.values(groupedResults)
      .map(ev => {
        delete ev._catSet;
        delete ev._zoneSet;
        return ev;
      })
      .filter(ev => ev.listings.length > 0);

    // 7. Crée le dossier temp si besoin
    const tempDir = path.join(process.cwd(), "back/src/temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 8. Sauvegarde par salle
    for (const groupKey in groupedResults) {
      const group = groupedResults[groupKey];
      if (!group.listings.length) continue;
    
      const venueSlug = slugifyVenueName(group.venue.name);
      const filename = `listings_viagogo_${venueSlug}.json`;
      const filepath = path.join(tempDir, filename);
    
      try {
        let existingData = [];
        if (fs.existsSync(filepath)) {
          const content = fs.readFileSync(filepath, "utf-8");
          existingData = JSON.parse(content);
          if (!Array.isArray(existingData)) existingData = [];
        }
    
        // Evite doublon d'event_id (par exemple)
        const isAlreadyInFile = existingData.some(ev => ev.event_id === group.event_id);
        if (!isAlreadyInFile) {
          existingData.push(group);
          fs.writeFileSync(filepath, JSON.stringify(existingData, null, 2));
          console.log(`✅ [B1] [INFO] Ajout de l'événement dans : ${filepath}`);
        } else {
          console.log(`⏩ [B1] [INFO] Événement déjà présent dans : ${filepath}, pas d'ajout.`);
        }
    
      } catch (e) {
        console.error(`[B1] [ERROR] Erreur lecture/écriture fichier ${filename} :`, e);
      }
    }

    console.log(`\n✅ [B1] [INFO] Nombre total de nouveaux listings générés : ${totalListings}\n`);

    req.numberOfListings = totalListings;
    next();
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// Fonction pour "nettoyer" un ticket pour la comparaison (hors _id, hors infoCategories)
const cleanTicket = ticket => {
  const { _id, infoCategories, ...rest } = ticket || {};
  return rest;
};

// Normalise le tableau de tickets (on retire infoCategories, _id, on trie tout)
const normalizeTickets = tickets => {
  if (!Array.isArray(tickets)) return [];
  return tickets.map(cleanTicket)
    .map(t => JSON.stringify(t))
    .sort();
};

export default extractAndFilterListings;
