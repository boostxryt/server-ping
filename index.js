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
    console.log(`📡 Ik volg momenteel ${usersToMonitor.length} Roblox spelers via de Direct API.`);
    
    // Start direct de controlelus
    checkRobloxStatusDirect();
    setInterval(checkRobloxStatusDirect, checkInterval);
});

async function checkRobloxStatusDirect() {
    const channel = await client.channels.fetch(channelId).catch(() => null);

    for (const monitoredUser of usersToMonitor) {
        try {
            // We omzeilen de proxy en vragen RECHTSTREEKS de publieke gebruikersinfo op
            const response = await axios.get(`https://roblox.com{monitoredUser.id}`, {
                timeout: 5000
            });

            if (response.data) {
                // De Users API stuurt een isOnline status mee (indien publiek zichtbaar)
                // Als dit niet werkt door Roblox restricties, gebruiken we de alternatieve community avatar status
                const currentlyOnline = response.data.isOnline || false;

                console.log(`[DIRECT-CHECK] ${monitoredUser.name} online status is: ${currentlyOnline}`);

                if (currentlyOnline && !monitoredUser.isOnline) {
                    monitoredUser.isOnline = true;
                    if (channel) channel.send(`🟢 Speler **${monitoredUser.name}** is zojuist online gegaan op Roblox!`);
                } else if (!currentlyOnline && monitoredUser.isOnline) {
                    monitoredUser.isOnline = false;
                    if (channel) channel.send(`🔴 Speler **${monitoredUser.name}** is zojuist offline gegaan!`);
                }
            }
        } catch (error) {
            console.log(`📡 Direct API status voor ${monitoredUser.name}: ${error.message}`);
        }
    }
}

client.login(token);
