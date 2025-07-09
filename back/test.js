// viagogo_get_listings.js
import got from 'got';
import mongoose from 'mongoose';
import Event from './src/schemas/Event.js';
import connectDatabase from './src/config/database.js';

await connectDatabase(); // Assurez-vous d'avoir votre fonction de connexion Mongo prête

function normalizeSection(section) {
    return section?.trim().toLowerCase()
        .replace("catégorie", "cat")
        .replace("catégorie ", "cat")
        .replace("catégories", "cat")
        .replace("cat ", "cat")
        .replace(/\./g, "")
        .replace(/\s+/g, "")
        || "";
}

// Normalisation date
function extractDateStr(dateStr) {
    // Extrait "YYYY-MM-DD" de "2025-10-22T19:00:00"
    return new Date(dateStr).toISOString().split("T")[0];
}

(async () => {
    const csrfToken = 'c3hUHS75QY1sIzY70IovRDRAq8tB73sG8P47ybqPYDSPisJLHhw7oQjQRp8jrD1DwpVrAl8wDXZFdfyHbnf3EklxhB2nYPXxX27Xiz28yZk1';

    const headers = {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "accept": "application/json, text/plain, */*",
        "x-csrf-token": csrfToken,
         "cookie": `_ga=GA1.2.1416720908.1751720303; _ga_1686WQLB4Q=GS2.2.s1751720296$o1$g1$t1751720389$j49$l0$h0; _gid=GA1.2.1383006041.1751720303; bm_sz=449AB14A27D8B521227E7C8558309A89~YAAQPFNzaJzqcLGXAQAA4Oir2hxyk0sxnx8HrnlJjgyNGtsvveLHssQPXb4zTd6jb5a0wdNbYHg+0rbRRkH9iyBSNN1ZOvGRo/uIP3lGlxW6BAb51MgJJ+cP8LI708BUMZ3wVujWMB6oZCXXP0kWICDKg++zHAH1BpKeUeqnu6mGx0napPt0PULRwnKDhsmQBXYZ44khuPVEZWfXiVs8YHSTxxZqAMhsbKFC/Q2XzJJ/2PhE1vo3PctYwsMYytYZEyMxnpL7jY9/e2L2Z6EGMzLB+0VEq/9HVmQ4fKm/yQQfPIErw+iBmi+BMlfpUKIc4W65dLMz/z9u6dBAMVFrboWXr5YCGK6UhDS7v0Bl/21X3j9btUKbTTH9mEJuT+boi8g0sLi1/QxTxtm9W6sLPu0B56nqe5sC6QuqwXBgd5nu4xMqbfyhNoHjuC55dvr9Bwx1DRVhMfMmw1Q=~3294774~4534582; _gat=1; _abck=CC004D668D1A251C63DAB1C02FB65947~0~YAAQPFNzaFDlcLGXAQAAmGmr2g7CRGVkS8BIVOPDA7h+/pqbE4A3bqxLCjLdRQ5++cbR9lGxAwZ64y2l+WZ+rIofC2a4zZZNYEvkxRJXuA+VOzSm4Cwp46PUyuVXHIaJyQrXoKTnZXVY3UI3S4Ul8Q3+cwMtTzDaaT1f/EorUE0cBia46ASJ+VKuDypZwPpXgp7w9YrPD27QN9b026woi8s770Ed52q9ahUBq4bgoJrpOhg7roRYq/hZrK/LzHiHVcKpeC3Zzdz6+xvIBPDJ3ElbogRySRAJmfiWucux1L9zzHeccsj+P45+QjW8hpzcQdw/BtX+qTQngOGA2v4QuQh5Wp8XMKnjPyc7fli439J6+uwfOkDSjrUqsdzCCyfCvSYs7SBmN7eZCT7aZFBUQj+Faxp+HX/7PnvTgV6UBZShUAsdZIbKYSIRquKnjr3b7oiQ+Trq9cv80kQOkssibrqJhEHLaxqPgoWbOgEhlRGDeEQhBgBtoWU6iEfg5q1H/1OfsWZtXp0fHkkV9RbNiBLVnasBgoSogYZnJFcVCEjq7GgPjsWq9jE3Nd53I5tcLMAUaRvwofCac89G0/YDtnDcZtsgdqDJZ5fvOj9fTpbe+vDnT5cnrzLzNN5eHFNnvi6/Q3ruQOlodM0S8gZAhVHwZZBRG92O5quSKRmcSlpx5Jy3SMyIBzfwXU37seZTockUXzPucE3J+hrfXZa1xR4L669su03ah9pezAu8hh9gGSHeE7/o1fMSIMTRng735erKjpGIkABdR5mMBmwDTn3FUztgPjH5ask=~-1~-1~1751723895; sel=p; wsp=eyJ1IjoiVGlja2V0IE9sYW0iLCJsIjoxMDM2fQ2; wsu.2=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTE3MjE1NTYsImF1ZCI6InZnZyIsInNpZCI6IjI1ZmRkYzFkLTQ0ODMtNGZkMC1hOTY4LTY2OTVjZjY5MDYxNCIsImp0aSI6ImMxYThiNmNhLTU5MDEtNDAwZi05NDM3LTMyMzU3MThlNmFjNCIsImpyaSI6IjZjZGI4MDlkLTc2ZTktNDBiOC05NThmLTI4OGNjZTQyNzY5YSIsImlzcyI6InYyIiwic3ViIjoiOTVmMzdmYWMtNTNjMi00ZDhjLWIxNTEtMTUyOTdlNzc1MmVkIiwiYW0iOjM4NSwiYXMiOjIsInIiOiJQb3dlclNlbGxlciIsImlnIjpmYWxzZSwiaWVjIjp0cnVlfQ.XbH4fGAlW7TeG5AV6QIjfPWyz6Zbp_Zf_p3GHE1ypQbIOtKcGfaW48D3ba5hGSFs8lHMwnmwdqUr5QQnlFFIZOi7ePrF9E2K-f_9tfVYM_9u0bXsXymOxXx_pi1Tj3EeZJo2WP1gU1SB3EdqQM-6mmHeKVGSfvyuuY9MHc-eRaGpbmAnd2JiwhlqfhBRqqWwmMAc0tQxHtfeJGVdu3ZdLNp-8Lz3S9IgYBZkiPx6mlIvcIHu6DddmLZWYUNMkiGNzwVQtJXWyOILEDoqQHCwyvIcA37Wk7a4vVcLxsQTDLgzyy2nvWlzwUijzbZ_nyCTfEqTCbXvzFp1q8GYe8lhsQ; ai_user=Dsz1y/cIMtvUnfsZHw5ybu|2025-07-05T12:58:23.425Z; wsso=eyJ1bCI6eyJuIjpudWxsLCJzIjpmYWxzZSwibGciOjIuMzMsImx0Ijo0OC44NywiY3QiOiJGUiJ9LCJydiI6eyJjIjpbXSwiZSI6W10sImwiOltdfSwicCI6W10sImlkIjpudWxsfQ==; _uetsid=ba611ce0599f11f09032d74c0d551402; _uetvid=ba6136c0599f11f0bb4ec36598709681; bm_s=YAAQPFNzaB7dcLGXAQAAsZSq2gMSoDfF0YAS9kkKm7+/8J906PPJSltUsqKC4UXcV6ovUM2uNcauO0kEdXIBES608kepGElTehDs9jYcCmiYPCpI2vHz/K0Ct9fco3BEyq4xdTHTOKA4OObZQsXsiRQnjwx+tPjUUp0Oq6qZpvc1gW9rZeZyl1mlDq6kHIguT+J38pai6b1rZWKD3LmKpesD4rMmk0GnLKIz01vrfX0a1oNFRdi30vTmaxCi4cIUz8HIXwZOfbqN0fCSTlYuYTKnmluXUHh7hCVhYZH/o08b5KBZ3VsGIMReUgnWispGpIAS5tq2jsvszE1yhX/lEr4lLLqXku/yTxRXcxDYx0dU6NMVrWV+t+PB7GIiNNTKeRrAWvb1oc9Br33D5Gvsr0vd1kwj4bQF5RIV+J/mNS49qDIxrxi70BhUIiUcVqxb9boYnz6kImCvTV2VnaW3ZSugeiHv1sRkSo8D860KSlbDj+b3Ar3/m3CiEVDJDgvl5sN015GYmr4DJonNdeuwjO+7HkChe2jnHNbtc2kkLTRBWIc5Xv1zTaYgh6ClVSNXLkdMDuI=; uis=Nbwdhf8vIJ5MvOHz59wdRkNbGqHZIC8wRR1y3EQaKnqq2pcBn3HMeLzcmGaquugJeJSq2pcBAAA; CookieConsent=eyJoYXNTZWxlY3RlZFByZWZlcmVuY2VzIjp0cnVlLCJwcmVmZXJlbmNlcyI6eyJhZHZlcnRpc2luZyI6dHJ1ZSwiYW5hbHl0aWNzIjp0cnVlLCJwcmVmZXJlbmNlcyI6dHJ1ZX19; _gcl_au=1.1.2133146811.1751720301; bm_sv=91C913518233CCF0D0DA3CC180FCF8E3~YAAQPFNzaIzbcLGXAQAAuX6q2hx91u9uziKdJo3hCLNoIFwrjpRgT8dtxoPRfeVcFdp1NsKtGc4InimRKekIASbyKqwIk3tY3Amt/7y35MLlmUjwArMVeQeOU+QyvUQnUV9Mzl8nyj3buYWxej8QdGbCMefFV6KiTgPbfKSrIs5JF9/m3T5M3lp/pMkLcSRh/LZl7DnP7vokjgicKoj6qej78cyGsAWp5b+TuJ/2sxFwtY+87SBp3OTmEspCartb~1; usl=1751720296004; auths=0; _rvt=mSX2M6dDYsbpark6osbyI6pGCavmNGGHAZGW9uM1Ok4AzHUFg9bWcuxf1EBwSmdGKuVTTYbSg5bDGGa0U8rP5BBxkz-E0vjEDiljW9j3nSY1; ak_bmsc=898C46B3D3D365AA05D8506A194229AF~000000000000000000000000000000~YAAQPFNzaO/acLGXAQAAQHSq2hzrE0AoMgFcQ3a3/zKBod205K1rzxU7jqi8XASSHSJyxs3pbnJTKB965TexzRRd5OzDBMLnqQVZ7zbJvqf2/bU/YGb4bxawzV/YOA/EGGQhZ8Y1tz6K8/gEVKHiSY5a0AjRCcLosVUnAJJ3bKOmRlFts27G8VGDE8VuOqo+EMA6R+oyP1XY52hawRIvXmBL8HCaguWVC69cX1kiZdhAf8M1h6ELvX95DoASbgQwJrJDwqHCEXGylaS3lkXdkdttk3AI/lo7Nu2Qqi9FS/TrLXh7/SkAeU79TIfw6D3+GsFJDvhyFWvjLgPFh0v5BjJHWzOq4gZeQ+heFun5QMFfRN3M3PpOKMN/V+NOypwQpc88I+lciBjm2Q==; bm_so=BD56AB67C4F9FF6489DE24171F59A0EAC358BD3B92BED4DA8F46392AB10C5ADB~YAAQPFNzaPHacLGXAQAAQHSq2gREWpsdQsHLRZshL8W+awQOkoI+n6Jv+ou3t9lGNWnmtRSKKH8YLo3omhYRHr/asIvEViREs5jGlg6fTXpXeJyADopfL5nCJpGbE8qnmuBO0v5AmuhfVNVpKCiQEyE5DRrNV1X5nT6uaQ6jLuos2JKTor4KJVuoyj/L2GFxU/fQ0mcRsmu0fwHaS07WA8ULVxByZefOvA4mrnxLl2Ib+aO0V/Q90UBUFfB2W6ZdO1txwWh5UtXelJZWqAY6wycJKs9u04OYiDCdxKkwp0yQ/zS6MXY/cwLDtcfpGkcX53CqoVFgon1GgcP1i5H9yK6DMunUug+LEKKD87Wt2pIG2aOh0iBBqN3LTtThXcy17aofN+i6agEUIrYwdfYcxdoJKLgaVQbzyaZRHQNkhIvWII+YK1d+HiNW/HpBhcTBCI+xSBN6So34i29Qgbxy; bm_ss=ab8e18ef4e; d=HLbCaE8r3gGgKeEEbJ8dQqpHu2ANZVJFnBIwvA2; s=eKZU9tQLfUudifro7m-ea7Ttq5nDu90I0; wsso-session=eyJ1bCI6bnVsbCwidXBsIjp7Im4iOiJQYXJpcyIsInMiOmZhbHNlLCJsZyI6Mi4zMywibHQiOjQ4Ljg3LCJjdCI6IkZSIiwic3JjIjoiSVAiLCJkdCI6IjAwMDEtMDEtMDFUMDA6MDA6MDArMDA6MDAifSwiZCI6bnVsbCwicnYiOnsiYyI6W10sImUiOltdLCJsIjpbXSwicnRjX3UiOm51bGwsInJ0Y19ldCI6IjIwMjUtMDctMDVUMTI6NTg6MTIuNzc3MjA5WiJ9LCJmYyI6eyJjIjpbXX0sInAiOltdLCJpZCI6bnVsbH0=`
    };

    const searchParams = {
        filters: 'STATUS:ACTIVE|PENDING',
        sort: 'action_date asc',
        page: '1',
        pageSize: '1000000',
        isMLBLinked: 'false'
    };

    try {
        let response = await got.get('https://my.viagogo.fr/listings/getListings', {
            headers,
            searchParams,
            http2: true
        });

        console.log('✅ Listings récupérés avec succès :');
        const jsonResponse = JSON.parse(response.body);
        const listings = jsonResponse.Listing;

        let updated = 0, notFound = 0;

        const allEvents = await Event.find({}, { tickets: 1 });

        for (const l of listings) {
            const eventName = l.EventDescription?.trim() || "";
            const venueName = l.VenueDescription?.trim() || "";
            const eventDate = new Date(l.EventDate).toISOString().split("T")[0];
            const section = l.Section?.trim() || "";
            const listingId = l.Id;

            console.log(`\n🔍 Recherche : ${eventName} | ${venueName} | ${eventDate} | ${section} | ListingId: ${listingId}`);

            let found = false;

            for (const event of allEvents) {
                for (const ticket of event.tickets || []) {
                    for (const category of ticket.infoCategories || []) {
                        // Vérifie VGListing sur infoCategories
                        if (category.VGListing) {
                            console.log(`➡️ Vérification category.VGListing: EventName: ${category.VGListing.EventName}, VenueName: ${category.VGListing.VenueName}, Date: ${category.VGListing.EventDateTimeDisplay}, Section: ${category.VGListing.blockVG}`);
                            if (
                                category.VGListing.EventName?.trim().toLowerCase() === eventName.toLowerCase() &&
                                category.VGListing.VenueName?.trim().toLowerCase() === venueName.toLowerCase() &&
                                new Date(category.VGListing.EventDateTimeDisplay)?.toDateString() === new Date(eventDate)?.toDateString() &&
                                normalizeSection(category.VGListing.blockVG) === normalizeSection(section)
                            ) {
                                category.VGListing.listingId = listingId;
                                found = true;
                            }
                        }

                        // Vérifie VGListing sur zones
                        for (const zone of category.zones || []) {
                            if (zone.VGListing) {
                                console.log(`➡️ Vérification zone.VGListing: EventName: ${zone.VGListing.EventName}, VenueName: ${zone.VGListing.VenueName}, Date: ${zone.VGListing.EventDateTimeDisplay}, Section: ${zone.VGListing.blockVG}`);
                                if (
                                    zone.VGListing.EventName?.trim().toLowerCase() === eventName.toLowerCase() &&
                                    zone.VGListing.VenueName?.trim().toLowerCase() === venueName.toLowerCase() &&
                                    new Date(zone.VGListing.EventDateTimeDisplay)?.toDateString() === new Date(eventDate)?.toDateString() &&
                                    normalizeSection(zone.VGListing.blockVG) === normalizeSection(section)
                                ) {
                                    zone.VGListing.listingId = listingId;
                                    found = true;
                                }
                            }
                        }
                    }
                }
                if (found) {
                    await event.save();
                    console.log(`✅ ListingId ${listingId} ajouté pour ${eventName} | Section: ${section}`);
                    updated++;
                    break; // évite de continuer à itérer une fois trouvé et sauvegardé
                }
            }

            if (!found) {
                console.log(`❌ Aucun VGListing trouvé pour ce listing`);
                notFound++;
            }
        }

        console.log(`\n✅ Terminé : ${updated} listingIds mis à jour | ${notFound} non trouvés`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur lors de la récupération ou mise à jour:', error.response?.body || error);
        process.exit(1);
    }
})();
