import Event from "../../../schemas/Event.js";
import { getTicketmasterSessionCookies } from "../../../services/getTicketmasterSessionCookies.js";
import AbortController from "abort-controller"; 

const MAX_RETRIES = 5;

async function fetchWithTimeout(url, options = {}, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

const processFirstScrapingForEvents = async (req, res, next) => {
    try {
        const events = await Event.find({
            $and: [
                { steps: { $elemMatch: { step_id: 1, status: true } } },
                { steps: { $elemMatch: { step_id: 2, status: false } } }
            ]
        });
        
        
        if (events.length === 0) {
            console.log("✅ [A2] [INFO] Aucun événement à traiter. Arrêt du processus.");
            req.scrapedEvents = 0;
            return next();
        } else {
            console.log(`ℹ️ [A2] [INFO] ${events.length} évènements à traiter avec aucun scraping effectué`);
        }
        
        let cookies = await getTicketmasterSessionCookies();
        let count = 0;
        
        for (let i = 0; i < events.length; i++) {
            let event = events[i];
            let attempt = 0;
            let done = false;

            while (attempt < MAX_RETRIES && !done) {
                try {
                    // console.log(`processFirstScrapingForEvents : Traitement de l'event ${event.name} (${event.local_date} ${event.local_time})`);
                    
                    const resp = await fetchWithTimeout(event.tickets_url, {
                        method: "GET",
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
                    }, 30000);

                    // Toujours lire le body en text, puis tenter JSON.parse
                    let rawText = await resp.text();
                    let data;
                    try {
                        data = JSON.parse(rawText);
                    } catch (e) {
                        data = { text: rawText };
                    }

                    // Blocage détecté
                    if (data.response && data.response === "block") {
                        attempt++;
                        if (attempt < MAX_RETRIES) {
                            console.log(`ℹ️ [A2] [INFO] Blocage détecté pour ${event.name} ${event.venue.name} (${attempt}/${MAX_RETRIES}), régénération d'un nouveau cookie Ticketmaster...`);
                            cookies = await getTicketmasterSessionCookies();
                        } else {
                                console.warn(`⚠️ [A2] [WARNING] Blocage persistant (${MAX_RETRIES}/${MAX_RETRIES}) sur ${event.name} ${event.venue.name}. Suppression de l'évènement de la base de données.`);
                                await Event.deleteOne({ _id: event._id });
                            done = true;
                        }
                    }
                    else if (typeof data.text === "string" && data.text.includes("n'est pas ouverte à la vente")) {
                        console.log(`✅ [A2] ${event.local_date} ${event.local_time} - ${event.name} (${event.venue.name}) : l'évènement n'est pas ouvert à la vente`);
                        await Event.findByIdAndUpdate(
                            event._id,
                            {
                                $set: {
                                    tickets: data.text,
                                    "steps.1.status": true
                                },
                                $currentDate: { updated_at: true }
                            }
                        );
                        count++;
                        done = true;
                    }
                    
                    // Cas normal JSON
                    else {
                        // Copie les URLs d'origine
                        const oldTicketsUrl = event.tickets_url;
                    
                        // Peut-être update les URLs selon le ticket correspondant
                        let updatedEvent = updateEventUrlsWithCorrectIdmanif(event);
                    
                        // Vérifie si l’URL a changé
                        const idmanifUpdated = (updatedEvent.tickets_url !== oldTicketsUrl);
                    
                        let finalTicketsData = data;
                        // Si modifié, refaire le fetch une seule fois
                        if (idmanifUpdated) {
                            console.log(`ℹ️ [A2] [INFO] L'URL a changé pour ${event.local_date} ${event.local_time} - ${event.name} (${event.venue.name}), récupération des tickets...`);
                            let resp2 = await fetch(updatedEvent.tickets_url, {
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
                            let rawText2 = await resp2.text();
                            try {
                                finalTicketsData = JSON.parse(rawText2);
                            } catch (e) {
                                finalTicketsData = { text: rawText2 };
                            }
                        }
                    
                        
                        // Nettoie les tickets
                        let cleanedTickets = cleanTickets(finalTicketsData) || [];
                        // Ajoute l'URL propre à chaque ticket
                        let ticketsWithUrls = addUrlToTickets(cleanedTickets, updatedEvent.tickets_url);
                        // Applique le filtrage des tarifs sur chaque infoCategories de chaque ticket
                        ticketsWithUrls = ticketsWithUrls.map(ticket => ({
                            ...ticket,
                            infoCategories: formatInfoCategories(ticket.infoCategories)
                        }));

                        await Event.findByIdAndUpdate(
                            event._id,
                            {
                                $set: {
                                    tickets_url: updatedEvent.tickets_url,
                                    tickets: ticketsWithUrls,
                                    "steps.1.status": true
                                },
                                $currentDate: { updated_at: true }
                            }
                        );

                        console.log(`ℹ️ [A2] [INFO] Tickets récupérés pour l'évènement : ${event.local_date} ${event.local_time} - ${event.name} (${event.venue.name})`);
                        count++;
                        done = true;
                    }
                    
                } catch (error) {
                    attempt++;
                    if (attempt < MAX_RETRIES) {
                        console.log(`⚠️ [A2] [WARNING] Erreur lors de la récupération des tickets pour ${event.local_date} ${event.local_time} - ${event.name} (${event.venue.name}) (${attempt}/${MAX_RETRIES}), régénération d'un nouveau cookie Ticketmaster...`, error);
                        cookies = await getTicketmasterSessionCookies();
                    } else {
                        console.error(`❌ [A2] [ERROR] Erreur persistante pour ${event.local_date} ${event.local_time} - ${event.name} (${event.venue.name}) :`, error);
                        done = true;
                    }
                }
            }
        }

        console.log("\nℹ️ [A2] [INFO] Vérification des événements avec plusieurs séances et récupération des places disponibles pour chaque séance\n");
        
        const eventsWithNullInfoCategories = await Event.find({
            $and: [
                { "tickets.infoCategories": { $exists: true, $eq: null } },
                { tickets: { $ne: [ { Doublon: true } ] } }
              ]
        });
        console.log(eventsWithNullInfoCategories);
        console.log(`ℹ️ [A2] [INFO] ${eventsWithNullInfoCategories.length} évènements avec plusieurs séances à traiter\n`);
        
            for (let i = 0; i < eventsWithNullInfoCategories.length; i++) {
                let event = eventsWithNullInfoCategories[i];
                let idtier = extractIdtierFromTicketsUrl(event.tickets_url);
                let hasUpdate = false;
            
                // Pour chaque ticket de l’event
                for (let j = 0; j < (event.tickets || []).length; j++) {
                    let ticket = event.tickets[j];
                    if (ticket.infoCategories == null && ticket.idmanif && ticket.idseanc && idtier) {
                        let url = `https://www.ticketmaster.fr/api/grille-tarifaire/manifestation/idmanif/${ticket.idmanif}/seance/idseance/${ticket.idseanc}/${idtier}?codLang=FR&codCoMod=WEB&onlyFirstAvailableByDay=false&tokenRecaptchaGoogle=`;
                        let attempt = 0, data = null;
                        while (attempt < MAX_RETRIES && !data) {
                            try {
                                let resp = await fetch(url, {
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
                                let rawText = await resp.text();
                                try { data = JSON.parse(rawText); } catch { data = { text: rawText }; }
                            } catch (err) {
                                attempt++;
                                if (attempt < MAX_RETRIES) {
                                    console.log(`ℹ️ [A2] [INFO] [${attempt}/${MAX_RETRIES}] Ticket ${ticket.idseanc} sur ${event.name} ${event.venue.name} (${event.local_date} ${event.local_time})`);
                                    cookies = await getTicketmasterSessionCookies();
                                } else {
                                    console.error(`⚠️ [A2] [WARNING] Echec ticket ${ticket.idseanc} sur ${event.name}`);
                                }
                            }
                        }
                        // ---------- LOGIQUE DE MAPPING ROBUSTE ----------
                        let infoCategories = null;
                        if (Array.isArray(data) && data[0]?.infoCategories) {
                            infoCategories = data[0].infoCategories;
                        } else if (Array.isArray(data) && data[0]?.nbPlaces !== undefined) {
                            infoCategories = data;
                        } else if (data?.infoCategories) {
                            infoCategories = data.infoCategories;
                        } else if (data && Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
                            infoCategories = data[0]; // fallback si data[0] = object unique
                        }
                        if (infoCategories !== null && infoCategories !== undefined) {
                            event.tickets[j].url = url;
                            event.tickets[j].infoCategories = formatInfoCategories(infoCategories); // ← Ici
                            hasUpdate = true;
                            console.log(`ℹ️ [A2] [INFO] Succès update pour ${event.name} - Séance ${ticket.idseanc}`);
                        }                        
                    }
                }
                if (hasUpdate) {
                    await Event.findByIdAndUpdate(event._id, {
                        $set: { tickets: event.tickets },
                        $currentDate: { updated_at: true }
                    });
                }
                
            }
            

        
        console.log(`✅ [A2] [INFO] ${count} évènements traités avec succès.`);
        req.scrapedEvents = count;
        next();
    } catch (error) {
        console.error("❌ [A2] [ERROR] Erreur globale :", error);
        next(error);
    }
};

function cleanTickets(tickets) {
    const keysToRemove = [
      "nameManif", "showDateSeanceTime", "idNatcl", "nameNatcl", "codcatpl", "llgcatpl", "llccatpl",
      "codtypcatpl", "llctypcatpl", "llgtypcatpl", "hasPlacesDispo", "dateAnnonce", "dateOuvte",
      "hasZoning", "status", "llgseanc", "afficheDateSeance", "openPass", "descriptionFR",
      "descriptionEN", "image", "nbPlacesCommandable", "basketPlan", "needMireCodeFanClub",
      "urlCodeFanClub", "tarifTempsReel"
    ];
  
    return tickets.map(ticket => {
      const cleanedTicket = { ...ticket };
      keysToRemove.forEach(key => delete cleanedTicket[key]);
      return cleanedTicket;
    });
  }

  function updateEventUrlsWithCorrectIdmanif(event) {
    if (
        !Array.isArray(event.tickets) ||
        event.tickets.length <= 1 ||
        !event.local_date ||
        !event.local_time
    ) return event;

    const targetDateHour = `${event.local_date}T${event.local_time}`;

    const matchingTicket = event.tickets.find(ticket => 
        typeof ticket.dateSeance === "string" &&
        ticket.dateSeance.substring(0, 16) === targetDateHour
    );

    if (matchingTicket && matchingTicket.idmanif) {
        // Remplacement dans tickets_url
        if (typeof event.tickets_url === "string") {
            event.tickets_url = event.tickets_url.replace(
                /idmanif\/\d+/,
                `idmanif/${matchingTicket.idmanif}`
            );
        }
    }
    return event;
}

function addUrlToTickets(tickets, tickets_url) {
    if (!Array.isArray(tickets) || !tickets_url) return tickets;

    // Extraire idtier de l’URL d’origine
    const idtier = extractIdtierFromTicketsUrl(tickets_url);

    // Sécurité : trouver l’index du ticket principal (celui avec infoCategories != null)
    let mainTicketIdx = tickets.findIndex(t => t.infoCategories !== null && t.infoCategories !== undefined);
    if (mainTicketIdx === -1) mainTicketIdx = 0;

    return tickets.map((ticket, idx) => {
        let idmanif = ticket.idmanif;
        let idseanc = ticket.idseanc;
        let url;
        if (idx === mainTicketIdx) {
            // principal, url classique (pas de /seance/idseance/)
            url = `https://www.ticketmaster.fr/api/grille-tarifaire/manifestation/idmanif/${idmanif}/${idtier}?codLang=FR&codCoMod=WEB&onlyFirstAvailableByDay=false&tokenRecaptchaGoogle=`;
        } else {
            // secondaire, url avec /seance/idseance/
            url = `https://www.ticketmaster.fr/api/grille-tarifaire/manifestation/idmanif/${idmanif}/seance/idseance/${idseanc}/${idtier}?codLang=FR&codCoMod=WEB&onlyFirstAvailableByDay=false&tokenRecaptchaGoogle=`;
        }
        return { ...ticket, url };
    });
}

function extractIdtierFromTicketsUrl(tickets_url) {
    const match = tickets_url.match(/\/(\d+)\?codLang=/);
    return match ? match[1] : null;
}

function formatInfoCategories(infoCategories) {
    // 1. Rien à formatter : return null (pour conserver "à traiter")
    if (!Array.isArray(infoCategories)) return null;
  
    // 2. On filtre sur TARIF NORMAL
    const filtered = infoCategories
      .map(cat => ({
        ...cat,
        infoNatCliTarifs: Array.isArray(cat.infoNatCliTarifs)
          ? cat.infoNatCliTarifs
              .filter(tarif => tarif.nameNatCl === "TARIF NORMAL")
              .map(tarif => ({
                idNatCl: tarif.idNatCl,
                nameNatCl: tarif.nameNatCl,
                price: tarif.price,
                max: tarif.max,
                devise: tarif.devise || "EUR",
                contingent: tarif.contingent
              }))
          : [],
        zones: Array.isArray(cat.zones) ? cat.zones : []
      }))
      .filter(cat => cat.infoNatCliTarifs && cat.infoNatCliTarifs.length > 0);
  
    // 3. S'il ne reste rien, retourne []
    return filtered.length > 0 ? filtered : [];
  }
  
export default processFirstScrapingForEvents;
