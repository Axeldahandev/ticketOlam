import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';


puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROXY_CONFIG_PATH = path.resolve(__dirname, '../config/proxies.json');
const INDEX_PATH = path.resolve(__dirname, '../config/indexProxy.txt');
const BAN_PATH = path.resolve(__dirname, '../config/banProxies.txt');

const SITE_KEY = "6LdWxZEkAAAAAIHtgtxW_lIfRHlcLWzZMMiwx9E1";
const PAGE_URL = "https://www.ticketmaster.fr/fr";
const API_KEY_2CAPTCHA = "0a065fd50c6a460c0f7dc6cc1c7214c1";

// --- Proxy utils ---

async function getProxies() {
    const raw = await fs.readFile(PROXY_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw).proxies;
}
async function getBanList() {
    try {
        const bans = JSON.parse(await fs.readFile(BAN_PATH, 'utf-8'));
        const now = Date.now();
        return bans.filter(b => b.expireAt > now);
    } catch { return []; }
}
async function setBanList(banList) {
    await fs.writeFile(BAN_PATH, JSON.stringify(banList, null, 2), 'utf-8');
}

async function getNextProxy() {
    const proxies = await getProxies();
    let idx = 0;
    try { idx = parseInt(await fs.readFile(INDEX_PATH, 'utf-8'), 10) || 0; } catch {}
    let banList = await getBanList();
    const banned = new Set(banList.map(b => b.proxy));
    let count = 0, next = null;

    // 1er passage, on cherche un proxy valide
    while (count < proxies.length) {
        const proxy = proxies[idx % proxies.length];
        if (!banned.has(proxy)) { next = proxy; break; }
        idx = (idx + 1) % proxies.length; count++;
    }

    // Si aucun proxy valide, on débannit tout et on recommence une seule fois
    if (!next) {
        console.warn('ℹ️ [A2] [INFO] Tous les proxies sont bannis, réinitialisation de la banlist...');
        await setBanList([]); // Vide la banlist
        // Recharge la banlist vide
        banList = [];
        idx = 0;
        count = 0;
        while (count < proxies.length) {
            const proxy = proxies[idx % proxies.length];
            if (!banned.has(proxy)) { next = proxy; break; }
            idx = (idx + 1) % proxies.length; count++;
        }
        if (!next) throw new Error('⚠️ [A2] [WARNING] Aucun proxy valide utilisable !');
    }

    await fs.writeFile(INDEX_PATH, ((idx + 1) % proxies.length).toString(), 'utf-8');
    return next;
}


async function banProxy(proxy) {
    const bans = await getBanList();
    bans.push({ proxy, expireAt: Date.now() + 20 * 60 * 1000 });
    await setBanList(bans);
    console.log(`ℹ️ [A2] [INFO] Proxy banni pour 20 min (${proxy})`);
}

function parseProxy(proxyString) {
    const [host, port, user, pass] = proxyString.split(':');
    return { host, port, user, pass };
}

// --- 2captcha solveur en fetch natif ---
async function solveRecaptchaEnterprise() {
    const params = new URLSearchParams({
        key: API_KEY_2CAPTCHA,
        method: "userrecaptcha",
        googlekey: SITE_KEY,
        pageurl: PAGE_URL,
        version: "invisible",
        enterprise: "1",
        json: "1",
    });
    const inRes = await fetch(`http://2captcha.com/in.php?${params}`);
    const inData = await inRes.json();
    if (inData.status !== 1) throw new Error("Erreur d'envoi à 2captcha : " + inData.request);
    const requestId = inData.request;
    let token = null;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(`http://2captcha.com/res.php?key=${API_KEY_2CAPTCHA}&action=get&id=${requestId}&json=1`);
        const pollData = await pollRes.json();
        if (pollData.status === 1) { token = pollData.request; break; }
        if (pollData.request !== "CAPCHA_NOT_READY") throw new Error("Erreur polling 2captcha : " + pollData.request);
    }
    if (!token) throw new Error("Timeout de récupération du token 2captcha");
    console.log("ℹ️ [A2] [INFO] Nouveau token reCAPTCHA récupéré avec 2captcha");
    return token;
}

// --- MAIN FUNCTION ---
export async function getTicketmasterSessionCookies() {
    let tries = 0;
    const maxTries = 50; // Ou proxies.length mais + robuste
    let lastErr = null;

    while (tries < maxTries) {
        const proxyString = await getNextProxy();
        const { host, port, user, pass } = parseProxy(proxyString);
        const launchArgs = [
            `--proxy-server=http://${host}:${port}`,
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
        ];
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: launchArgs,
                defaultViewport: { width: 1200, height: 800 },
                userDataDir: `/tmp/puppeteer_${Date.now()}_${Math.random()}`
            });
            const page = await browser.newPage();
            if (user && pass) await page.authenticate({ username: user, password: pass });
            await page.deleteCookie(...(await page.cookies()));
            await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 35000 });
            await page.goto("https://leboncoin.fr/", { waitUntil: 'networkidle2', timeout: 35000 });
            await page.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 35000 });
            await page.waitForSelector('textarea[name="g-recaptcha-response"]', { timeout: 20000 });
            const token = await solveRecaptchaEnterprise();
            await page.evaluate((token) => {
                const textarea = document.querySelector('textarea[name="g-recaptcha-response"]');
                if (textarea) {
                    textarea.value = token;
                    textarea.innerHTML = token;
                    const evt = document.createEvent('HTMLEvents');
                    evt.initEvent('input', true, true);
                    textarea.dispatchEvent(evt);
                }
            }, token);
            await new Promise(resolve => setTimeout(resolve, 7500));
            const cookies = await page.cookies();
            const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

            if (cookieHeader.length < 100) {
                console.error("⚠️ [A2] [WARNING] Cookies reçus inexploitables, nouvelle tentative avec un nouveau proxy...");
                if (browser) await browser.close();
                await banProxy(proxyString);
                continue; // Passe au proxy suivant
            }
            await browser.close();
            console.log(`✅ [A2] [INFO] Cookie Ticketmaster\n ${cookieHeader}`);
            return cookieHeader; // SUCCESS
        } catch (err) {
            if (browser) await browser.close();
            await banProxy(proxyString);
            lastErr = err;
            tries++;
            console.log(`ℹ️ [A2] [INFO] Utilisation d'un nouveau proxy (${tries}/${maxTries})`);
        }
    }
    // Si on sort de la boucle, c’est que tout a échoué
    throw lastErr;
}
