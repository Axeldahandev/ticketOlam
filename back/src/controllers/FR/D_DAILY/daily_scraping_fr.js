import mongoose from "mongoose";
import Event from "../../../schemas/Event.js";
import { getTicketmasterSessionCookies } from "../../../services/getTicketmasterSessionCookies.js";

const updateNbPlacesOnly = (oldInfoCategories, newInfoCategories, logs = []) => {
  return oldInfoCategories.map(oldCat => {
    const newCat = newInfoCategories.find(nc => nc.codCatPl === oldCat.codCatPl);
    if (newCat) {
      if (oldCat.nbPlaces !== newCat.nbPlaces) {
        logs.push(`Catégorie ${oldCat.codCatPl} : nbPlaces ${oldCat.nbPlaces} -> ${newCat.nbPlaces}`);
      }
      const updatedCat = { ...oldCat, nbPlaces: newCat.nbPlaces };

      if (Array.isArray(oldCat.zones) && Array.isArray(newCat.zones)) {
        updatedCat.zones = oldCat.zones.map(oldZone => {
          const newZone = newCat.zones.find(nz => nz.llczone === oldZone.llczone || nz.idzone === oldZone.idzone);
          if (newZone && oldZone.nbplaces !== newZone.nbplaces) {
            logs.push(`Zone ${oldZone.idzone} ${oldZone.llczone} : nbplaces ${oldZone.nbplaces} -> ${newZone.nbplaces}`);
          }
          return newZone ? { ...oldZone, nbplaces: newZone.nbplaces } : oldZone;
        });
      }
      return updatedCat;
    }
    return oldCat;
  });
};

const findMatchingTicketInDBandUpdatePlaces = async ({ eventId, idseanc, idmanif, dateSeance, newInfoCategories }) => {
  const event = await Event.findOne({ _id: new mongoose.Types.ObjectId(eventId) });
  if (!event) return;

  const ticketIndex = event.tickets.findIndex(
    t => t.idseanc === idseanc && t.idmanif === idmanif && t.dateSeance === dateSeance
  );

  if (ticketIndex === -1) return;

  const logs = [];
  const updatedInfoCategories = updateNbPlacesOnly(event.tickets[ticketIndex].infoCategories, newInfoCategories, logs);

  if (logs.length > 0) {
    console.log(`📝 MAJ Event ${eventId} - Ticket ${idseanc}`);
    logs.forEach(log => console.log("   ↪", log));
  } else {
    return; // aucune modification
  }

  const updateQuery = {};
  updateQuery[`tickets.${ticketIndex}.infoCategories`] = updatedInfoCategories;

  await Event.updateOne(
    { _id: eventId },
    { $set: updateQuery, $currentDate: { updated_at: true } }
  );
};

async function fetchSeanceData(seance, cookies) {
  try {
    const response = await fetch(seance.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive",
        "Referer": "https://www.ticketmaster.fr/",
        "Origin": "https://www.ticketmaster.fr",
        "Sec-Fetch-Mode": "cors",
        "Cookie": cookies
      }
    });

    let data = await response.json();

    if (data?.response === 'block') {
      console.warn(`🛑 Blocage détecté pour ${seance.url}. Rafraîchissement des cookies...`);
      const newCookies = await getTicketmasterSessionCookies();
      return await fetchSeanceData(seance, newCookies);
    }

    if (!Array.isArray(data)) data = [data];
    data = data.filter(obj => obj && obj.infoCategories);

    console.log(`✅ ${seance.url}`);

    for (const record of data) {
      await findMatchingTicketInDBandUpdatePlaces({
        eventId: seance.id,
        idseanc: record.idseanc,
        idmanif: record.idmanif,
        dateSeance: record.dateSeance,
        newInfoCategories: record.infoCategories
      });
    }

  } catch (err) {
    console.error(`❌ Erreur pour ${seance.url}:`, err.message);
  }
}

export default async function daily_scraping_fr(req, res, next) {
  let events = [];
  try {
    events = await Event.find({
      $and: [
        { steps: { $elemMatch: { step_id: 1, status: true } } },
        { steps: { $elemMatch: { step_id: 2, status: true } } },
        { steps: { $elemMatch: { step_id: 3, status: true } } },
        {
          tickets: {
            $elemMatch: {
              $or: [
                { "infoCategories.VGListing": { $exists: true } },
                { "infoCategories.zones.VGListing": { $exists: true } }
              ]
            }
          }
        }
      ]
    }, { _id: 1, tickets: 1 });
    
  } catch (error) {
    console.error("❌ [DAILY][SCRAPING] [ERROR] Erreur lors de la récupération des événements :", error);
    return res.status(500).json({ error: "Erreur lors de la récupération des événements" });
  }

  if (events.length === 0) {
    console.log("✅ [DAILY][SCRAPING] [INFO] Aucun événement à traiter. Arrêt du processus.");
    req.scrapedEvents = 0;
    return next();
  }

  console.log(`ℹ️ [DAILY][SCRAPING] [INFO] ${events.length} évènements en vente à traiter.`);

  const seancesUnique = events.flatMap(event =>
    event.tickets.map(ticket => ({
      id: event._id,
      idseanc: ticket.idseanc,
      idmanif: ticket.idmanif,
      url: ticket.url
    }))
  );

  const cookies = await getTicketmasterSessionCookies();
  for (const seance of seancesUnique) {
    await fetchSeanceData(seance, cookies);
  }

  req.scrapedEvents = seancesUnique.length;
  return next();
}
