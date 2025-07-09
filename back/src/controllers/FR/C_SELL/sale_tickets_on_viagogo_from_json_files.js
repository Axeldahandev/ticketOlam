import Event from "../../../schemas/Event.js";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import removeAccents from "remove-accents";
import mongoose from "mongoose";
import * as cheerio from "cheerio";
import matchTMToVG from "./match_TM_to_VG.js";
import onsale_requests_for_event from "./onsale_requests_for_event.js";
import updateVGListingInDB from "./update_VG_listing_in_DB.js";

puppeteer.use(StealthPlugin());

const get_viagogo_cookies = async (req, res, next) => {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        
        const page = await browser.newPage();
        await page.goto("https://google.fr/", { waitUntil: "networkidle0" });
        await page.waitForSelector('.QS5gu.sy4vM', { visible: true });
        await page.click('.QS5gu.sy4vM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.goto("https://inv.viagogo.com/", { waitUntil: "networkidle2" });
        await new Promise(resolve => setTimeout(resolve, 500));
        while (page.url() !== "https://inv.viagogo.com/") {
            await page.goto("https://facebook.com/", { waitUntil: "networkidle0" });
            await new Promise(resolve => setTimeout(resolve, 500));
            await page.goto("https://inv.viagogo.com/", { waitUntil: "networkidle2" });
            await new Promise(resolve => setTimeout(resolve, 500));
            await page.waitForSelector('#Login_UserName');
            await page.waitForSelector('#Login_Password');
            await page.type('#Login_UserName', "ticketolam@gmail.com");
            await page.type('#Login_Password', "TW79wZS4%iZG_xi");
            await page.click('#sbmt');
            await page.waitForNavigation({ waitUntil: "networkidle2" });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log("✅ Connexion réussie");
        const cookies = await page.cookies("https://inv.viagogo.com/");
        const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");
        console.log("✅ [C1] [INFO] Nouveaux cookies Viagogo récupérés");
        await browser.close();
        return cookieHeader;
    } catch (error) {
        console.error(error);
        res && res.status(500).json({ error: error.message });
    }
};

function isMatchingEvent(listing, viagogoEvents, finalVenueName) {
    for (const viagogoEvent of viagogoEvents.Events) {
        const dateTm = (listing.date_seance || "").slice(0, 10);
        const dateVg = (viagogoEvent.EventDateVal || "").slice(0, 10);
        const hourTm = (listing.date_seance || "").slice(11, 16);
        const hourVg = (viagogoEvent.EventDateVal || "").slice(11, 16);
        const [htm, mtm] = hourTm.split(":").map(Number);
        const [hvg, mvg] = hourVg.split(":").map(Number);
        const minutesTm = htm * 60 + mtm;
        const minutesVg = hvg * 60 + mvg;
        const diffMinutes = Math.abs(minutesTm - minutesVg);
        const matchingHour = diffMinutes <= 120;
        const matchingDate = dateTm === dateVg;
        const normalize = str =>
            removeAccents(str || "")
                .toLowerCase()
                .replace(/(^|\s)le\s+/g, " ")
                .replace(/(^|\s)la\s+/g, " ")
                .replace(/[^a-z0-9]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        const matchingName = normalize(listing.event_name).includes(normalize(viagogoEvent.EventName)) || normalize(viagogoEvent.EventName).includes(normalize(listing.event_name));
        const matchingVenue = normalize(finalVenueName).includes(normalize(viagogoEvent.VenueName)) ||
            normalize(viagogoEvent.VenueName).includes(normalize(listing.venue.name));
        if (matchingName && matchingDate && matchingHour && matchingVenue) {
            return viagogoEvent;
        }
    }
    return null;
}

function formatDate(dateString) {
    if (!dateString) return "";
    return dateString.split("T")[0];
}

function cleanViagogoListingsFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ [CLEANUP] Fichier non trouvé : ${filePath}`);
        return;
    }

    try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        let events = JSON.parse(fileContent);

        const initialCount = events.length;
        const filteredEvents = events.filter(event => Array.isArray(event.listings) && event.listings.length > 0);
        const removedCount = initialCount - filteredEvents.length;

        console.log(`🗑️ [CLEANUP] Nettoyage du fichier : ${filePath}`);

        if (filteredEvents.length === 0) {
            // Plus aucun event => suppression du fichier
            fs.unlinkSync(filePath);
            console.log(`🗑️ [CLEANUP] Fichier listings supprimé car plus aucun event : ${filePath}`);
        } else {
            // Réécriture du fichier propre
            fs.writeFileSync(filePath, JSON.stringify(filteredEvents, null, 2));
            console.log(`✅ [CLEANUP] Fichier listings nettoyé : ${filePath}`);
        }

    } catch (err) {
        console.error(`❌ [CLEANUP] Erreur lors du nettoyage du fichier : ${filePath}`, err);
    }
}

const sale_tickets_on_viagogo_from_json_files = async (req, res, next) => {
    let totalListingsCount = 0;
    let totalVGListed = 0;
    let cookies;

    try {
        cookies = await get_viagogo_cookies();
        if (!cookies) throw new Error("⚠️ [C1] [WARNING] Impossible de récupérer les cookies Viagogo");
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
        return;
    }

    const tempDir = path.join(process.cwd(), "./src/temp");
    
    const listingFiles = fs.readdirSync(tempDir)
    .filter(file => file.startsWith("listings_viagogo_") && file.endsWith(".json"))
    .reverse(); 
    
    if (listingFiles.length === 0) {
        return res.status(404).json({ message: "Aucun fichier de listings Viagogo trouvé dans /src/temp" });
    }

    for (const file of listingFiles) {
        const filePath = path.join(tempDir, file);
        try {
            let events = JSON.parse(fs.readFileSync(filePath, "utf8")); 
            console.log(`ℹ️ [C1] [INFO] ${events.length} évènements à traiter pour la mise en vente sur Viagogo`);

            // Pour chaque groupe/event
            for (const event of events) {
                console.log(`\nℹ️ [C1] [INFO] Traitement de l'évènement : (${event.date_seance}) ${event.event_name} - ${event.venue.name}`);
                if (!Array.isArray(event.listings) || event.listings.length === 0) continue;

                const eventInfo = {
                    event_id: event.event_id,
                    event_name: event.event_name,
                    date_seance: event.date_seance,
                    venue: event.venue,
                    ticketmaster_id: event.ticketmaster_id,
                };

                function normalizeName(str) {
                    return (str || "")
                        .replace(/-/g, " ")
                        .replace(/[^\w\s']/g, ' ')
                        .replace(/\s+/g, " ")
                        .trim();
                }

                function removeDuplicateWords(phrase) {
                    if (!phrase) return "";

                    const stopWords = new Set(['le', 'la', 'les']);
                    const seen = new Set();
                
                    return removeAccents(phrase)           // retire les accents
                        .toLowerCase()                     // tout en minuscule
                        .replace(/[^\w\s']/g, ' ')          // supprime ponctuations  
                        .split(/\s+/)                      // split par espace(s)
                        .filter(word => {
                            if (!word || stopWords.has(word)) return false; // stop word ou vide
                            if (seen.has(word)) return false;               // déjà vu
                            seen.add(word);
                            return true;                                    // mot accepté
                        })
                        .join(' '); // recompose la phrase
                }

                let finalVenueName = eventInfo.venue.name;
                    
                const venueMap = {
                    "ZENITH TOULOUSE METROPOLE": "Zenith de Toulouse",
                    "ZENITH EUROPE STRASBOURG": "Zenith Strasbourg Europe",
                    "ZENITH DE LILLE": "Zenith Arena Lille",
                    "ZENITH PARIS - LA VILLETTE": "Zenith de Paris",
                    "ZENITH LIMOGES METROPOLE": "Zenith de Limoges",
                    "ZENITH SUD MONTPELLIER": "Zenith de Montpellier",
                    "ZENITH NANTES METROPOLE": "Zenith de Nantes",
                };
                
                if (venueMap[eventInfo.venue.name]) {
                    finalVenueName = venueMap[eventInfo.venue.name];
                }
                
                const rawPhrase = `${eventInfo.event_name} ${finalVenueName}`;
                const normalizedPhrase = normalizeName(rawPhrase);
                const searchPhrase = removeDuplicateWords(normalizedPhrase);

                console.log(`ℹ️ [C1] [INFO] Recherche Viagogo : ${searchPhrase}`);

                const params = new URLSearchParams({
                    SearchPhrase: searchPhrase,
                    DateFrom: "",
                    DateTo: "",
                    name: ""
                });

                let response = await fetch("https://inv.viagogo.com/Listings/EventSearch", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "Cookie": cookies,
                        "Accept": "*/*",
                        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Cache-Control": "no-cache",
                    },
                    body: params
                });

                let viagogoEvents;

                try {
                    viagogoEvents = await response.json() ;
                } catch (e) {
                    viagogoEvents = null
                }


                if (viagogoEvents === null || viagogoEvents.Events === undefined || viagogoEvents.Events.length === 0 ) {
                    const firstWord = searchPhrase.split(" ")[0];
                    const searchPhrase2 = `${firstWord} ${finalVenueName}`;
                    const paramsFirstWord = new URLSearchParams({
                        SearchPhrase: searchPhrase2,
                        DateFrom: "",
                        DateTo: "",
                        name: ""
                    });
                
                    console.log(`ℹ️ [C1] [INFO] Tentative recherche avec le premier mot : "${searchPhrase2}"`);
                
                    let response2 = await fetch("https://inv.viagogo.com/Listings/EventSearch", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                            "Cookie": cookies,
                            "Accept": "*/*",
                            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                            "Cache-Control": "no-cache",
                        },
                        body: paramsFirstWord
                    });

                    try {
                        viagogoEvents = await response2.json() ;
                    } catch (e) {
                        console.error(`❌ [C1] [ERROR] Erreur EventSearch Viagogo [${eventInfo.event_name}] :`, response.status);
                        continue;
                    }
                }

                let matchedEvent = isMatchingEvent(eventInfo, viagogoEvents, finalVenueName);

                if (matchedEvent !== null) {
                    console.log(`✅ [C1] [INFO] Évènement Viagogo correspondant trouvé : ${matchedEvent.EventName}`);
                    console.log(`\n`);

                    const params = new URLSearchParams({
                        eventlink: matchedEvent.EventLink,
                        ticketType: 'ETicket',
                        pcid: ""
                    });

                    await new Promise(resolve => setTimeout(resolve, 150));

                    const response = await fetch("https://inv.viagogo.com/Listings/NewListing", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                            "Cookie": cookies,
                            "Accept": "*/*",
                            "Accept-Encoding": "gzip, deflate, br",
                            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                            "Cache-Control": "no-cache",
                        },
                        body: params
                    });

                    const htmlResponse = await response.text();
                    const $ = cheerio.load(htmlResponse);

                    const blocks = [];
                    $('.js-section option').each((i, el) => {
                        const value = $(el).attr('value');
                        const label = $(el).text().trim();
                        if (value && !label.match(/choisir/i)) blocks.push({ value });
                    });

                    await Event.updateOne(
                        {
                            ticketmaster_id: eventInfo.ticketmaster_id,
                            "tickets.dateSeance": eventInfo.date_seance
                        },
                        {
                            $set: {
                                "tickets.$.viagogo_listing_url": matchedEvent.EventLink,
                                viagogo_blocks: blocks,
                                updated_at: new Date()
                            }
                        }
                    );

                    // --- TRAITEMENT DES LISTINGS ---
                    // Marque ceux qui réussissent avec un flag à true
                    for (let i = 0; i < event.listings.length; i++) {
                        const listing = event.listings[i]; // ATTENTION : index utilisé ici car suppression potentielle
                    
                        totalListingsCount++;
                    
                        const blockVG = matchTMToVG(listing.zone_label, eventInfo.venue.name, blocks);
                    
                        if (blockVG === null) {
                            // Cas non matché = conserver
                            const errorData = {
                                ticketmaster_event_name: eventInfo.event_name,
                                venue: eventInfo.venue.name,
                                zone_label: listing.zone_label,
                                blocks: blocks,
                                viagogo_event: viagogoEvents.Events,
                            };
                            
                            const errorFilePath = path.join(process.cwd(), "./src/temp/errors/errors_matching_events.json");
                            let existingErrors = [];
                    
                            try {
                                if (fs.existsSync(errorFilePath)) {
                                    const fileContent = fs.readFileSync(errorFilePath, 'utf8');
                                    existingErrors = JSON.parse(fileContent);
                                }
                    
                                existingErrors.push(errorData);
                                const transformedErrors = existingErrors.map(err => ({
                                    ...err,
                                    blocks: Array.isArray(err.blocks)
                                        ? err.blocks.map(b => b.value || b)
                                        : [],
                                }));
                    
                                fs.writeFileSync(errorFilePath, JSON.stringify(transformedErrors, null, 2));
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            } catch (writeError) {
                                console.error("❌ [C1] [ERROR] Erreur lors de l'écriture dans le fichier d'erreurs :", writeError);
                            }
                    
                            continue; // passe au listing suivant
                        } else {
                            const VGresponse = await onsale_requests_for_event(eventInfo, matchedEvent, listing, cookies, blockVG);
                            if (VGresponse?.Success === true) {
                                console.log(`✅ [C1] [INFO] Listing supprimé du fichier ${filePath} :`, listing.zone_label, "\n");
                                totalVGListed++;
                                // listing traité avec succès -> on le retire de la liste
                    
                                event.listings.splice(i, 1); // suppression immédiate
                                i--; // très important : ajuster l'index car on a enlevé un élément !
                    

                                // Mise à jour fichier JSON tout de suite
                                fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
                                
                            } else {
                                console.log(`❌ [C1] [ERROR] Echec mise en vente pour le listing : ${listing.zone_label} => conservé`);
                            }
                            let VGListing = VGresponse?.NewListingEventDetails || { error: "Pas de réponse VG" };
                            VGListing.blockVG = blockVG;

                            try {
                                await updateVGListingInDB(eventInfo, listing.zone_label, VGListing, listing.category_mere );
                            } catch (e) {
                                console.error("❌ [C1] [ERROR] Erreur MAJ VGListing :", e);
                            }
                        }
                    }

                    // Après la boucle, ne conserve que ceux NON traités
                    event.listings = event.listings.filter(l => !l.succesfullyListed);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.log(`␀ [C1] [INFO] Aucun évènement Viagogo trouvé pour l'évènement : ${eventInfo.event_name} (${eventInfo.date_seance}) - ${eventInfo.venue.name}`);

                    const errorData = {
                        ticketmaster_event_name: eventInfo.event_name,
                        date_seance: eventInfo.date_seance,
                        venue: eventInfo.venue.name,
                        SearchPhrase: searchPhrase,
                        blocks: [],
                        viagogo_events: [],
                    };

                    const eventNotFoundOnVG = path.join(process.cwd(), "./src/temp/errors/events_not_found.json");

                    if (!fs.existsSync(eventNotFoundOnVG)) {
                        fs.writeFileSync(eventNotFoundOnVG, JSON.stringify([], null, 2));
                    }
                    let existingEventsNotFound = [];

                    try {
                        if (fs.existsSync(eventNotFoundOnVG)) {
                            const fileContent = fs.readFileSync(eventNotFoundOnVG, 'utf8');
                            existingEventsNotFound = JSON.parse(fileContent);
                        }

                        if (
                            Array.isArray(errorData.viagogo_events) && errorData.viagogo_events.length === 0 &&
                            Array.isArray(errorData.blocks) && errorData.blocks.length === 0
                        ) {
                            existingEventsNotFound.push(errorData);
                            fs.writeFileSync(eventNotFoundOnVG, JSON.stringify(existingEventsNotFound, null, 2));
                        }

                        // ------------------------------------------------------------
                        // faire da demande d'évènement ici
                        // ------------------------------------------------------------

                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (writeError) {
                        console.error("❌ [C1] [ERROR] Erreur lors de l'écriture dans le fichier d'erreurs :", writeError);
                    }
                }
            }

            cleanViagogoListingsFile(filePath);
        } catch (err) {
            console.error(`❌ [C1] [ERROR]`, err);
        }
    }

    
    req.totalListingsCount = totalListingsCount;
    req.totalVGListed = totalVGListed;
};

export default sale_tickets_on_viagogo_from_json_files;
