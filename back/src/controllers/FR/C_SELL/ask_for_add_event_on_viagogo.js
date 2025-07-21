import stringSimilarity from 'string-similarity';

function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire accents
    .replace(/[^a-z0-9\s]/g, "") // retire ponctuation
    .replace(/\s+/g, " ") // espace simple
    .trim();
}

function normalizeVenueName(name) {
  if (!name) return "";
  const stopWords = new Set(["le", "la", "les", "de", "du", "des", "metropole", "arena", "stade", "salle", "the", "of"]);

  return name
    .split('-')[0].trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(word => word && !stopWords.has(word))
    .join(" ")
    .trim();
}

function findClosestMatchSalle(inputVenueName, candidateVenues, eventCity, threshold = 0.7) {
  if (!inputVenueName || !eventCity || !Array.isArray(candidateVenues) || candidateVenues.length === 0) return null;

  const normalizedInput = normalizeVenueName(inputVenueName);
  const normalizedCity = eventCity.toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const venue of candidateVenues) {
    const venueNameRaw = venue.VenueName || venue.name || "";
    const venueCityRaw = venue.VenueCity || venue.city || "";

    const normalizedCandidateName = normalizeVenueName(venueNameRaw);
    const normalizedVenueCity = venueCityRaw.toLowerCase();

    // Vérifier que la ville correspond (strict)
    if (normalizedVenueCity !== normalizedCity) continue;

    // Vérifier que le nom normalisé de la salle recherchée est inclus dans le nom normalisé candidat
    if (!normalizedCandidateName.includes(normalizedInput)) continue;

    // Calculer similarité string pour choisir le meilleur
    const similarity = stringSimilarity.compareTwoStrings(normalizedInput, normalizedCandidateName);

    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = venue;
    }
  }

  // Retourne le meilleur match si au-dessus du seuil, sinon null
  if (bestScore >= threshold) {
    return bestMatch;
  }

  return null;
}

function findClosestMatchArtist(results, query) {
  if (!query || !Array.isArray(results) || results.length === 0) return null;

  const normalizedQuery = normalizeString(query);
  const queryWords = normalizedQuery
    .split(" ")
    .filter(word => word.length >= 3); // ignore mots < 3 lettres

  if (queryWords.length === 0) return null;

  // Cherche un match exact (normalisé)
  const exactMatch = results.find(r => normalizeString(r.Display) === normalizedQuery);
  if (exactMatch) return exactMatch;

  // Cherche un Display qui commence par la query normalisée
  const startsWithMatch = results.find(r => normalizeString(r.Display).startsWith(normalizedQuery));
  if (startsWithMatch) return startsWithMatch;

  // Cherche un Display contenant tous les mots (dans n'importe quel ordre)
  const allWordsMatch = results.find(r => {
    const normalizedDisplay = normalizeString(r.Display);
    return queryWords.every(word => normalizedDisplay.includes(word));
  });
  if (allWordsMatch) return allWordsMatch;

  // Sinon, cherche le Display qui contient le maximum de mots de la query
  // mais il faut au moins la moitié des mots présents pour valider
  let bestMatch = null;
  let bestCount = 0;
  for (const r of results) {
    const normalizedDisplay = normalizeString(r.Display);
    const matchedCount = queryWords.filter(word => normalizedDisplay.includes(word)).length;
    if (matchedCount > bestCount) {
      bestCount = matchedCount;
      bestMatch = r;
    }
  }
  if (bestCount >= Math.ceil(queryWords.length / 2)) {
    return bestMatch;
  }

  // Aucun match satisfaisant trouvé
  return null;
}

const askForAddEventOnViagogo = async (cookies, eventInfo) => {
  console.log("[C1] [INFO] Demande d'ajout d'événement sur Viagogo");

  let artist = eventInfo.event_name;
  let salle = eventInfo.venue.name;
  let city = eventInfo.venue.city;
  let country = eventInfo.venue.country;
  const dateObj = new Date(eventInfo.date_seance);
  let date_seance = dateObj.toLocaleDateString('fr-FR');
  let heure_seance = dateObj.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const url = eventInfo.ticketmaster_url;


  try {
    const response_viagogo_artists = await fetch("https://inv.viagogo.com/Listings/CategorySearch", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": cookies,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Origin": "https://inv.viagogo.com",
        "Referer": "https://inv.viagogo.com/Listings",
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        "Cache-Control": "no-cache"
      },
      body: new URLSearchParams({
        text: eventInfo.event_name.split('-')[0].trim()
      })
    });

    let viagogo_artists = await response_viagogo_artists.json();
    viagogo_artists = viagogo_artists.SearchResults;

    const matchedArtist = findClosestMatchArtist(viagogo_artists, eventInfo.event_name.split('-')[0].trim());

    if (matchedArtist) {
      console.log("Artiste trouvé :", matchedArtist.Display);
      artist = matchedArtist.Display;
    } else {
      console.log("Aucun artiste correspondant à l'évènement répertorié sur Viagogo");
    }
  } catch (err) {
    console.error("[C1] [ERROR] Erreur lors de la recherche d'artiste sur Viagogo :", err);
  }

  try {
    const response_viagogo_venues = await fetch("https://inv.viagogo.com/Listings/VenueSearch", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": cookies,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Origin": "https://inv.viagogo.com",
        "Referer": "https://inv.viagogo.com/Listings",
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        "Cache-Control": "no-cache"
      },
      body: new URLSearchParams({
        text: eventInfo.venue.name.split('-')[0].trim()
      })
    });

    let viagogo_venues = await response_viagogo_venues.json();
    viagogo_venues = viagogo_venues.SearchResults;

    // Filtrer par ville pour éviter les faux positifs
    const filteredVenues = viagogo_venues.filter(v =>
      (v.VenueCity || "").toLowerCase() === eventInfo.venue.city.toLowerCase()
    );

    console.log("viagogo_venues filtrées par ville", filteredVenues);

    const matchedVenue = findClosestMatchSalle(eventInfo.venue.name, filteredVenues, eventInfo.venue.city);

    if (matchedVenue) {
      console.log("Salle trouvée :", matchedVenue.VenueName);
      salle = matchedVenue.VenueName;
    } else {
      console.log("Aucune salle correspondante trouvée sur Viagogo");
    }
  } catch (err) {
    console.error("[C1] [ERROR] Erreur lors de la recherche de salle sur Viagogo :", err);
  }

  const body = new URLSearchParams({
    CategoryName: artist,
    q: artist,
    CategoryId: "",
    EventName: eventInfo.event_name,
    EventDate: date_seance,
    EventTime: heure_seance,
    VenueName: salle,
    q: salle,           
    VenueCity: city,
    VenueCountry: country === "France" ? "FR" : country,
    VenueID: "",             // si tu as un id salle valide, sinon vide
    OnSaleDate: "",          // si tu as une date de mise en vente, sinon vide
    OnSaleTime: heure_seance,   // même heure de l'évènement par défaut, ou à ajuster
    VenueConfigId: "",       // souvent vide
    FaceValueCurrencyCode: "EUR", // ou autre devise
    FaceValueMin: "",
    FaceValueMax: "",
    EventUrl: url
  });

  const response = await fetch("https://inv.viagogo.com/Listings/RequestEvent", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Cookie": cookies,
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Origin": "https://inv.viagogo.com",
      "Referer": "https://inv.viagogo.com/Listings",
      "User-Agent": "Mozilla/5.0",
      "X-Requested-With": "XMLHttpRequest",
      "Cache-Control": "no-cache"
    },
    body: body.toString()
  });

  if (response.status === 200) {
    console.log("[C1] [INFO] ✅ Demande d'ajout d'événement sur Viagogo envoyée avec succès");
    return true;
  } else {
    console.log("[C1] [INFO] ❌ Erreur lors de l'envoi de la demande d'ajout d'événement sur Viagogo");
    return false;
  }
  
};

export default askForAddEventOnViagogo;
