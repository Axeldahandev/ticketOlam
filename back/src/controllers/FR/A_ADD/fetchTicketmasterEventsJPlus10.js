import Event from "../../../schemas/Event.js";

const API_KEYS_TICKETMASTER = [
    "Lxano8rowYCNTrJbFg11FANtzRGR13fz",
    "bz4SPklWgkx13JXZGMWdCRmXuo85RN1t",
    "UUw6voAfCa2fsSqgAkIR54LMeM3ogIQR",
    "ES9PknBLjdz8RRVFIHyjBijHGa6Arlso",
    "Jcms4Ln6dAlXGXQejRKAsAIAIx47hGxZ",
    "XLzt77LMWn8ipH2YG4cIoAt2aAXG1yzi",
    "mAFGJFFSuGVEdJDaPD4mSfGBABqw9aAS",
    "VSZLGKlJefzSoG9vPkPkj0Phsn7SqMD7",
    "LA3OLmsNWEJDErfRjw3m8iIDNWqDKX5u",
    "IsJlz50FKBgGm1pDFBhQWrDJgewwweCv"
];

const formatTicketmasterApiResponse = (ticketmasterEvents) => {
    return ticketmasterEvents
        .map(event => {

            const eventUrl = event.url;
            const website_url = extractTicketmasterEventUrl(eventUrl);
            const tickets_url = formatTicketsUrl(website_url);

            // Si on n’a pas d’URL exploitable, on retourne null pour filtrer après
            if (!website_url || !eventUrl || !tickets_url) return null;

            const venue = event._embedded?.venues?.[0] || {};
            return {
                ticketmaster_id: event.id,
                name: event.name,
                local_date: event.dates.start.localDate,
                local_time: typeof event.dates.start.localTime === "string"
                    ? event.dates.start.localTime.substring(0, 5)
                    : null,
                venue: {
                    name: venue.name || null,
                    city: venue.city?.name || null,
                    country: venue.country?.name || null,
                    postal_code: venue.postalCode || null,
                },
                classifications: {
                    segment: event.classifications?.[0]?.segment?.name || null,
                    genre: event.classifications?.[0]?.genre?.name || null,
                    subgenre: event.classifications?.[0]?.subGenre?.name || null,
                },
                steps: [
                    { step_id: 1, step_name: "Fetch Ticketmaster API", step_description: "Récupération des événements de l'API Ticketmaster.", status: true },
                    { step_id: 2, step_name: "Premier scraping", step_description: "Récupération des places disponibles.", status: false },
                    { step_id: 3, step_name: "Check mise en vente", step_description: "Vérification et tri des listings à effectuer sur viagogo.", status: false },
                ],
                original_ticketmaster_api_url: eventUrl,
                website_url: website_url,
                tickets_url,
                tickets: [],
                viagogo_listings: [],
                created_at: new Date(),
                updated_at: new Date(),
            };
        })
        .filter(Boolean)
        .filter(event =>
            event.local_date &&
            event.website_url
        )
        .filter(event =>
            !(
                (event.classifications.segment === "Arts & Theatre" && event.classifications.genre === "Cultural" && event.classifications.subgenre === "Cultural") ||
                (event.classifications.segment === "Film" && event.classifications.genre === "Documentary" && event.classifications.subgenre === "Documentary") ||
                (event.classifications.segment === "Miscellaneous" && event.classifications.genre === "Family" && event.classifications.subgenre === "Other") ||
                (event.classifications.segment === "Miscellaneous" && event.classifications.genre === "Hobby/Special Interest Expos" && event.classifications.subgenre === "Hobby/Special Interest Expos") ||
                (event.classifications.segment === "Miscellaneous" && event.classifications.genre === "Fair & Festivals") ||
                (event.name === "LE MYSTERE MOZART")
            )
        );
};

function extractTicketmasterEventUrl(website_url) {
    if (!website_url) return null;
    // Cherche le paramètre 'u=' (URL encodée)
    const uMatch = website_url.match(/[?&]u=([^&]+)/);
    if (!uMatch || !uMatch[1]) {
        return null; // On retourne null si le paramètre n'existe pas
    }
    // Décode l’URL
    const eventUrl = decodeURIComponent(uMatch[1]);
    return eventUrl;
}

function formatTicketsUrl(eventUrl) {
    if (!eventUrl) return null;
    // Regex pour choper les IDs
    const match = eventUrl.match(/idmanif\/(\d+)\/idtier\/(\d+)/);
    if (!match) {
        return null; // Retourne null si pattern absent
    }
    const idmanif = match[1];
    const idtier = match[2];
    // Génère l'URL API grille tarifaire
    const apiUrl = `https://www.ticketmaster.fr/api/grille-tarifaire/manifestation/idmanif/${idmanif}/${idtier}?codLang=FR&codCoMod=WEB&onlyFirstAvailableByDay=false&tokenRecaptchaGoogle=`;
    return apiUrl;
}

const fetchTicketmasterEventsByKeywordFromApi = async (req, res) => {
    let ticketmasterEvents = [];
    let page = 0;
    let totalPages = 1;
    const size = 200;
    let count = 0;

    const apiKey = API_KEYS_TICKETMASTER[Math.floor(Math.random() * API_KEYS_TICKETMASTER.length)];
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - 10);
    const dateJMoins10 = dateObj.toISOString().slice(0, 10); // format AAAA-MM-JJ

    console.log(`⚙️ [A1] [PARAMÈTRES] Evènements mis en vente le : "${dateJMoins10}" | (API Key : ${apiKey})`);
    console.log("\n");

    try {
        while (page < totalPages) { 
            const url = `https://app.ticketmaster.com/discovery/v2/events?apikey=${apiKey}&locale=*&countryCode=FR&onsaleOnStartDate=${dateJMoins10}&size=${size}&page=${page}`;

            const response = await fetch(url);
            const data = await response.json();
            
            if (data.page && typeof data.page.totalPages === "number") {
                totalPages = data.page.totalPages;
            } else {
                break;
            }

            if (data._embedded && data._embedded.events) {
                ticketmasterEvents = ticketmasterEvents.concat(data._embedded.events);
            } else {
                break;
            }

            page++;
            await new Promise(res => setTimeout(res, 200)); // Sleep soft
        }

        console.log(`ℹ️ [A1] [INFO]  ${ticketmasterEvents.length}  évènements reçus depuis l'API Ticketmaster.`);
        const cleanedEvents = formatTicketmasterApiResponse(ticketmasterEvents);
        console.log(`ℹ️ [A1] [INFO]  ${cleanedEvents.length}  évènements restants après le tri des évènements non pertinents.`);
        console.log("\n");


        for (const event of cleanedEvents) {
            try {
                // Vérification si l'événement existe déjà
                const existingEvent = await Event.findOne({ 
                    ticketmaster_id: event.ticketmaster_id 
                });

                if (!existingEvent) {
                    // Création d'un nouvel événement
                    const newEvent = new Event(event);
                    await newEvent.save();
                    count++
                    console.log(`✅ [A1] Evènement ajouté en base de donnés | ${event.local_date} ${event.local_time} - ${event.name} (${event.venue.name})`);
                }
            } catch (error) {
                console.error(`⚠️ [A1] [WARNING] Erreur lors de la vérification/ajout de l'événement ${event.name} :`, error);
            }
        }
        console.log("\n");
        console.log(`✅ [A1] [INFO] ${count} nouveaux événements ajoutés en base de données.`);
        req.addedEvents = count;
        
    } catch (error) {
        console.error("❌ [A1] [ERROR] Erreur lors de la requête vers l'API Ticketmaster:", error);
        return res.status(500).json({ error: "Erreur lors de la récupération des événements Ticketmaster" });
    }
};

export default fetchTicketmasterEventsByKeywordFromApi;
