import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const proxiesPath = path.resolve(__dirname, '../config/proxies.json');
const indexPath = path.resolve(__dirname, '../config/indexProxy.txt');
const banPath = path.resolve(__dirname, '../config/banProxies.txt');

function parseProxy(proxyString) {
    // Format : host:port:user:pass
    const [host, port, user, pass] = proxyString.split(':');
    return { host, port, user, pass };
}

// CHARGER LA LISTE DES PROXIES
async function getProxies() {
    const raw = await fs.readFile(proxiesPath, 'utf-8');
    const proxies = JSON.parse(raw).proxies;
    return proxies;
}

// CHARGER LE TABLEAU DES PROXIES BANNIS (timestamp unix ms)
async function getBanList() {
    try {
        const content = await fs.readFile(banPath, 'utf-8');
        const bans = JSON.parse(content);
        // Filtre ceux encore actifs
        const now = Date.now();
        return bans.filter(b => b.expireAt > now);
    } catch {
        return [];
    }
}

// ÉCRIRE LA BANLIST (tableau d’objets { proxy, expireAt })
async function setBanList(banList) {
    await fs.writeFile(banPath, JSON.stringify(banList, null, 2), 'utf-8');
}

// PRENDRE LE PROCHAIN PROXY DISPONIBLE NON BANNI
async function getNextProxy() {
    const proxies = await getProxies();
    let idx = 0;
    try {
        idx = parseInt(await fs.readFile(indexPath, 'utf-8'), 10) || 0;
    } catch {}

    // Lire la banlist
    const banList = await getBanList();
    const bannedProxies = new Set(banList.map(b => b.proxy));
    // Cherche le prochain proxy non banni
    let count = 0;
    let nextProxy = null;
    while (count < proxies.length) {
        const proxy = proxies[idx % proxies.length];
        if (!bannedProxies.has(proxy)) {
            nextProxy = proxy;
            break;
        }
        idx = (idx + 1) % proxies.length;
        count++;
    }
    // Si pas de proxy dispo
    if (!nextProxy) throw new Error('Tous les proxies sont bannis !');

    // Stocke l’index du prochain à utiliser
    await fs.writeFile(indexPath, ((idx + 1) % proxies.length).toString(), 'utf-8');

    return nextProxy;
}

// BAN UN PROXY POUR 15 MIN
async function banProxy(proxy) {
    const banList = await getBanList();
    // Ajoute le ban
    banList.push({ proxy, expireAt: Date.now() + 30 * 60 * 1000 });
    await setBanList(banList);
    console.log(banList)
    console.log(`Proxy banni pour 30 min : ${proxy}`);
    console.log(`Nombre de proxies bannis : ${banList.length}`);
}

export { getNextProxy, banProxy, parseProxy };
