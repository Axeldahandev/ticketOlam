async function onsale_requests_for_event(eventInfo, matchedEvent, listing, cookie, blockVG) {
    
    let priceWithFees = await fetch('https://inv.viagogo.com/listings/revalueprices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({
            addressId: 438498223,
            sellerNetProceeds: listing.listingPrice,
            eventLink: matchedEvent.eventLink,
            currencyCode: 'EUR',
            websitePrice: null
        })
    }).then(res => res.json());

    function getSellerListingsUrl(sellerEventsUrl) {
        // On extrait l'ID de l'événement avec une regex
        const match = sellerEventsUrl.match(/\/sellerevents\/(\d+)/);
        if (!match) {
            throw new Error("⚠️ [C1] [WARNING] URL invalide : impossible de trouver l'ID de l'événement");
        }
        const eventId = match[1];
        // On construit la nouvelle URL
        return `https://api.viagogo.net/v2/events/${eventId}/sellerlistings`;
    }

    function formatDateFR(dateString) {
        const date = new Date(dateString);
        const pad = n => n.toString().padStart(2, '0');
        const jour = pad(date.getDate());
        const mois = pad(date.getMonth() + 1);
        const annee = date.getFullYear();
        const heures = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const secondes = pad(date.getSeconds());
        return `${jour}/${mois}/${annee} ${heures}:${minutes}:${secondes}`;
    }

    let body1 = {
        UsedCalculatedFaceValue: null,
        CalculatedFaceValue: null,
        ServerError: null,
        serverStamp: 0,
        Listing : {
            QuantityOnPageLoad: null,
            AvailableTickets: Math.min(listing.max_buy, 10),
            SplitType: "Any",
            Section: blockVG,
            Section: blockVG,
            Row: null,
            isSeated: null,
            SeatFrom: null,
            SeatTo: null,
            WebsitePrice: priceWithFees.websitePrice,
            Proceeds: listing.listingPrice,
            CurrencyCode: 'EUR',
            FaceValue: listing.listingPrice,
            IsFaceValueRequired: false,
            MaxDisplayQuantity: null,
            ConnectedSellerTypeId: null,
            ConnectedSellerEventOrganiserTypeId: null,
            IsPublishToViagogo: true,
            IsPublishToViagogo: false,
            TicketLocationAddressId: 438498223,
            EventLink: matchedEvent.EventLink,
            EventListingsLink: null,
            CreateListingLink: getSellerListingsUrl(matchedEvent.EventLink),
            TicketType: 'ETicket',
            IsDetailModified: "True",
            IsPriceModified: "False",
            IsQuantityModified: "False",
            IsInHandHasValue: "False",
            OriginalIsPublishToViagogo: "False",
            CanEditQuantity: "True",
            CanEditPrice: "True",
            CanEditFaceValue: "True",
            CanEditSplitType: "True",
            CanEditTicketType: "True",
            CanEditNotes: "True",
            CanEditTicketLocation: "True",
            CanEditSeating: "True",
            EventName: matchedEvent.EventName,
            EventDate: formatDateFR(matchedEvent.EventDateVal),
            VenueName: matchedEvent.VenueName,
            VenueCity: matchedEvent.VenueCity,
            VenueCountryCode: 'FR',
            ExistingMaxPriceReductionPercentage: null,
            Pcid: null
        },
    }

    const response1 = await fetch('https://inv.viagogo.com/Listings/savelisting', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify(body1)
    });

    let body2 = {
        UsedCalculatedFaceValue: null,
        CalculatedFaceValue: null,
        ServerError: null,
        serverStamp: 0,
        Listing : {
            QuantityOnPageLoad: null,
            AvailableTickets: Math.min(listing.max_buy, 10),
            SplitType: "Any",
            Section: blockVG,
            Section: blockVG,
            Row: null,
            isSeated: null,
            SeatFrom: null,
            SeatTo: null,
            WebsitePrice: priceWithFees.websitePrice,
            Proceeds: listing.listingPrice,
            CurrencyCode: 'EUR',
            FaceValue: listing.listingPrice,
            IsFaceValueRequired: false,
            MaxDisplayQuantity: null,
            ConnectedSellerTypeId: null,
            ConnectedSellerEventOrganiserTypeId: null,
            IsPublishToViagogo: true,
            TicketLocationAddressId: 438498223,
            EventLink: matchedEvent.EventLink,
            EventListingsLink: null,
            CreateListingLink: getSellerListingsUrl(matchedEvent.EventLink),
            TicketType: 'ETicket',
            IsDetailModified: "True",
            IsPriceModified: "False",
            IsQuantityModified: "False",
            IsInHandHasValue: "False",
            OriginalIsPublishToViagogo: "False",
            CanEditQuantity: "True",
            CanEditPrice: "True",
            CanEditFaceValue: "True",
            CanEditSplitType: "True",
            CanEditTicketType: "True",
            CanEditNotes: "True",
            CanEditTicketLocation: "True",
            CanEditSeating: "True",
            EventName: matchedEvent.EventName,
            EventDate: formatDateFR(matchedEvent.EventDateVal),
            VenueName: matchedEvent.VenueName,
            VenueCity: matchedEvent.VenueCity,
            VenueCountryCode: 'FR',
            ExistingMaxPriceReductionPercentage: null,
            Pcid: null,
            // AcceptConfirmation: true
        },
    }

    let acceptConfirmation;
    {
        const res = await fetch('https://inv.viagogo.com/Listings/savelisting', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },
            body: JSON.stringify(body2)
        });
    
        const text = await res.text();
    
        if (!res.ok) {
            console.error(`[Viagogo ERROR ${res.status}] sur /Listings/savelisting :\n${text.slice(0, 500)}...`);
        }
    
        try {
            acceptConfirmation = JSON.parse(text);
        } catch (e) {
            acceptConfirmation = { Success: false };
        }
    }
    
    console.log("✅ [C1] [INFO] Listing effectué sur VG => Success :", acceptConfirmation.Success);
    
    return acceptConfirmation;

}

export default onsale_requests_for_event;
