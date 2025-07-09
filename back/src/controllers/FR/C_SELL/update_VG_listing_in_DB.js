import Event from "../../../schemas/Event.js";

/**
 * Détection du ticket, de la catégorie/zone
 */
function detectCatOrZone(event, zone_label, date_seance) {

  let ticketIdx = -1, catIdx = -1, zoneIdx = -1, type = null, catLabel = null;

  for (let i = 0; i < (event.tickets || []).length; i++) {
    const ticket = event.tickets[i];
    // Correspondance sur la date (à adapter si autre critère)
    if (ticket.dateSeance !== date_seance) continue;

    for (let j = 0; j < (ticket.infoCategories || []).length; j++) {
      const cat = ticket.infoCategories[j];
      if (
        cat.llgCatPl === zone_label ||
        cat.llcCatPl === zone_label ||
        cat.codCatPl === zone_label
      ) {
        ticketIdx = i;
        catIdx = j;
        type = "cat";
        catLabel = cat.llgCatPl || cat.llcCatPl || cat.codCatPl;
        break;
      }
      for (let k = 0; k < (cat.zones || []).length; k++) {
        const zone = cat.zones[k];
        if (
          zone.llczone === zone_label ||
          zone.placementcatpl === zone_label ||
          zone.idzone === zone_label
        ) {
          ticketIdx = i;
          catIdx = j;
          zoneIdx = k;
          type = "zone";
          catLabel = cat.llgCatPl || cat.llcCatPl || cat.codCatPl;
          break;
        }
      }
      if (type) break;
    }
    if (type) break;
  }

  return { type, ticketIdx, catIdx, zoneIdx, catLabel };
}

/**
 * MAJ du VGListing sur la bonne catégorie/zone dans le bon ticket
 */
export default async function updateVGListingInDB(eventInfos, zone_label, VGListing, category_mere) {
  try {
    const event = await Event.findById(eventInfos.event_id);
    if (!event) {
        console.warn(`❌ [C1] [ERROR] Event introuvable en base (event_id: ${eventInfos.event_id})`);
        return;
    }

    const date_seance = eventInfos.date_seance;
    const tickets = event.tickets || [];
    let updated = false;

    for (let ticketIdx = 0; ticketIdx < tickets.length; ticketIdx++) {
        const ticket = tickets[ticketIdx];
        if (ticket.dateSeance !== date_seance) continue;

        const categories = ticket.infoCategories || [];
        for (let catIdx = 0; catIdx < categories.length; catIdx++) {
            const cat = categories[catIdx];
            const catLabel = cat.llgCatPl || cat.llcCatPl || cat.codCatPl;

            // ✅ 1️⃣ Si le label correspond à la catégorie => MAJ catégorie directement
            if (catLabel === zone_label) {
                const query = {
                    _id: event._id,
                    [`tickets.${ticketIdx}.infoCategories.${catIdx}.llgCatPl`]: cat.llgCatPl
                };
                const update = {
                    $set: {
                        [`tickets.${ticketIdx}.infoCategories.${catIdx}.VGListing`]: VGListing,
                        updated_at: new Date()
                    }
                };
                await Event.updateOne(query, update);
                updated = true;
                break;
            }

            // ✅ 2️⃣ Sinon, chercher dans les zones :
            // Si category_mere est fourni, ne chercher que dans cette catégorie.
            if (category_mere && catLabel !== category_mere) continue;

            const zones = cat.zones || [];
            for (let zoneIdx = 0; zoneIdx < zones.length; zoneIdx++) {
                const zone = zones[zoneIdx];
                const zoneLabels = [zone.llczone, zone.placementcatpl, zone.idzone];

                if (zoneLabels.includes(zone_label)) {
                    const query = {
                        _id: event._id,
                        [`tickets.${ticketIdx}.infoCategories.${catIdx}.zones.${zoneIdx}.llczone`]: zone.llczone
                    };
                    const update = {
                        $set: {
                            [`tickets.${ticketIdx}.infoCategories.${catIdx}.zones.${zoneIdx}.VGListing`]: VGListing,
                            updated_at: new Date()
                        }
                    };
                    await Event.updateOne(query, update);
                    updated = true;
                    break;
                }
            }
            if (updated) break;
        }
        if (updated) break;
    }

    if (!updated) {
        console.log(`⏩ [C1] Aucune catégorie ou zone "${zone_label}" trouvée dans "${category_mere || "toutes catégories"}" (event_id: ${event._id})`);
    }

} catch (err) {
    console.error("❌ [C1] [ERROR] Erreur updateVGListingInDB globale :", err);
}
}