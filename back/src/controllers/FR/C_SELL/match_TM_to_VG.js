import fs from "fs";
import path from "path";
import removeAccents from "remove-accents";

function normalize(str) {
    return removeAccents(str || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "")
        .trim();
}

function loadSalleMatchingJSON(venueName) {
    if (!venueName) return null;
    const sallesDir = path.join(process.cwd(), "back/src/config/matchings/salles");
    const salleFileName = venueName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, "_") // remplacer tout ce qui n'est pas alphanumérique par "_"
        .replace(/_+/g, "_") // ⚠️ remplace les "__" multiples par un seul "_"
        .replace(/^_|_$/g, "") // ⚠️ retire "_" début/fin
        + ".json";
    const salleFilePath = path.join(sallesDir, salleFileName);
    if (fs.existsSync(salleFilePath)) {
        return JSON.parse(fs.readFileSync(salleFilePath, "utf8"));
    }
    return {};
}

function loadGeneralMatchingJSON() {
    const generalFile = path.join(process.cwd(), "back/src/config/matchings/general_matchings.json");
    if (fs.existsSync(generalFile)) {
        return JSON.parse(fs.readFileSync(generalFile, "utf8"));
    }
    return {};
}

/**
 * @param {string} zoneLabelTM
 * @param {string} venueName
 * @param {Array<{value: string}>} viagogoBlocks
 * @returns {string|null}
 */
function matchTMToVG(zoneLabelTM, venueName, viagogoBlocks) {
    const normalizedTM = normalize(zoneLabelTM);

    // --- 1. Cherche dans le général ---
    const generalMapping = loadGeneralMatchingJSON();
    if (generalMapping) {
        for (const key of Object.keys(generalMapping)) {
            if (key === "description") continue;
            if (normalize(key) === normalizedTM) {
                for (const vgLabel of generalMapping[key]) {
                    const match = viagogoBlocks.find(
                        b => normalize(b.value) === normalize(vgLabel)
                    );
                    if (match) {
                        console.log(`✅ [C1] [MATCHING GENERAL] TM "${zoneLabelTM}" -> VG "${match.value}"`);
                        return match.value;
                    }
                }
            }
        }
    }
    
    // --- 2. Cherche dans la salle ---
    const salleMapping = loadSalleMatchingJSON(venueName);
    if (salleMapping) {
        for (const key of Object.keys(salleMapping)) {
            if (key === "description") continue;
            if (normalize(key) === normalizedTM) {
                for (const vgLabel of salleMapping[key]) {
                    const match = viagogoBlocks.find(
                        b => normalize(b.value) === normalize(vgLabel)
                    );
                    if (match) {
                        console.log(`✅ [C1] [MATCHING SALLE] [${venueName}] TM "${zoneLabelTM}" -> VG "${match.value}"`);
                        return match.value;
                    }
                }
            }
        }
    }

    // --- 3. Aucun match trouvé ---
    console.log(`⚠️ [C1] [MATCHING] Aucun mapping trouvé pour "${zoneLabelTM}" (Salle: ${venueName})`);
    return null;
}

export default matchTMToVG;
