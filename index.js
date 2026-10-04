const { Client, GatewayIntentBits, Events } = require('discord.js');
const axios = require('axios');

console.log("=== OMGEVINGSVARIABELEN CHECK ===");
console.log("DISCORD_BOT_TOKEN aanwezig:", process.env.DISCORD_BOT_TOKEN ? "JA" : "NEE");
console.log("DISCORD_CHANNEL_ID aanwezig:", process.env.DISCORD_CHANNEL_ID ? "JA" : "NEE");
console.log("ROBLOX_USERS aanwezig:", process.env.ROBLOX_USERS ? "JA" : "NEE");
console.log("=================================");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const checkInterval = parseInt(process.env.CHECK_INTERVAL || '15') * 1000;

const usersToMonitor = (process.env.ROBLOX_USERS || "").split(',').map(u => {
    if (!u.includes(':')) return null;
    const [id, name] = u.split(':');
    return { id: id.trim(), name: name.trim(), isOnline: false };
}).filter(Boolean);

client.once(Events.ClientReady, () => {
    console.log(`🤖 Bot is succesvol opgestart als ${client.user.tag}!`);
    console.log(`📡 Ik volg momenteel ${usersToMonitor.length} Roblox spelers.`);
    
    // Start direct met controleren en herhaal elke X seconden
    checkRobloxPresence();
    setInterval(checkRobloxPresence, checkInterval);
});

async function checkRobloxPresence() {
    try {
        const userIds = usersToMonitor.map(u => parseInt(u.id));
        if (userIds.length === 0) return;
        
        // DE MEEST STABIELE RECHTSTREEKSE ROUTE VIA EEN UP-TO-DATE COMMUNITY PROXY
        const response = await axios.post('https://roproxy.org', { userIds }, {
            timeout: 5000 
        });

        if (!response.data || !response.data.userPresences) {
            console.log("⚠️ De proxy reageerde wel, maar stuurde geen geldige data.");
            return;
        }

        const channel = await client.channels.fetch(channelId).catch(() => null);

        response.data.userPresences.forEach(presence => {
            const monitoredUser = usersToMonitor.find(u => u.id === presence.userId.toString());
            if (!monitoredUser) return;

            // Log de status live in Railway om te zien wat er gebeurt
            console.log(`[STATUS-CHECK] ${monitoredUser.name} is momenteel type: ${presence.userPresenceType}`);

            // Type 0 = Offline, 1 = Website, 2 = In Game, 3 = Studio
            const currentlyOnline = presence.userPresenceType > 0;

            if (currentlyOnline && !monitoredUser.isOnline) {
                monitoredUser.isOnline = true;
                let statusText = "online op Roblox";
                if (presence.userPresenceType === 2) {
                    statusText = `aan het spelen in game: **${presence.lastLocation || 'Onbekende Game'}**`;
                }
                if (channel) channel.send(`🟢 Speler **${monitoredUser.name}** is zojuist ${statusText}!`);
            } else if (!currentlyOnline && monitoredUser.isOnline) {
                monitoredUser.isOnline = false;
                if (channel) channel.send(`🔴 Speler **${monitoredUser.name}** is zojuist offline gegaan!`);
            }
        });
    } catch (error) {
        console.log(`📡 Proxy statusbericht: ${error.message}`);
    }
}

client.login(token);
