const { Client, GatewayIntentBits, Events } = require('discord.js');
const axios = require('axios');

// Log de status van de variabelen in plaats van de bot direct te crashen
console.log("=== OMGEVINGSVARIABELEN CHECK ===");
console.log("DISCORD_BOT_TOKEN aanwezig:", process.env.DISCORD_BOT_TOKEN ? "JA" : "NEE");
console.log("DISCORD_CHANNEL_ID aanwezig:", process.env.DISCORD_CHANNEL_ID ? "JA" : "NEE");
console.log("ROBLOX_USERS aanwezig:", process.env.ROBLOX_USERS ? "JA" : "NEE");
console.log("=================================");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildPresences
    ]
});

// Instellingen uitlezen
const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const checkInterval = parseInt(process.env.CHECK_INTERVAL || '15') * 1000;

// Roblox gebruikers splitsen (ID:Naam)
const usersToMonitor = (process.env.ROBLOX_USERS || "").split(',').map(u => {
    if (!u.includes(':')) return null;
    const [id, name] = u.split(':');
    return { id: id.trim(), name: name.trim(), isOnline: false };
}).filter(Boolean);

// Juiste clientReady event
client.once(Events.ClientReady, () => {
    console.log(`🤖 Bot is succesvol opgestart als ${client.user.tag}!`);
    console.log(`📡 Ik volg momenteel ${usersToMonitor.length} Roblox spelers.`);
    
    // Start de timer om elke X seconden te controleren
    setInterval(checkRobloxPresence, checkInterval);
});

async function checkRobloxPresence() {
    try {
        const userIds = usersToMonitor.map(u => parseInt(u.id));
        if (userIds.length === 0) return;
        
const response = await axios.post('https://roblox.school', { userIds });


        if (!response.data || !response.data.userPresences) {
            console.log("⚠️ De proxy gaf geen spelerdata terug.");
            return;
        }

        const channel = await client.channels.fetch(channelId).catch(() => null);

        response.data.userPresences.forEach(presence => {
            const monitoredUser = usersToMonitor.find(u => u.id === presence.userId.toString());
            if (!monitoredUser) return;

            // DIT PRINT DE LIVE STATUS IN RAILWAY (0 = offline, 1 = website, 2 = in game)
            console.log(`[TEST] Live status voor ${monitoredUser.name}: ${presence.userPresenceType}`);

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
        console.error("Fout bij het ophalen van Roblox status:", error.message);
    }
}

// Log in bij Discord
client.login(token);
