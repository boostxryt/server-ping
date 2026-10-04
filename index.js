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

// Haal de spelers strak op uit Railway
const usersToMonitor = (process.env.ROBLOX_USERS || "").split(',').map(u => {
    if (!u.includes(':')) return null;
    const [id, name] = u.split(':');
    return { id: id.trim(), name: name.trim(), isOnline: false };
}).filter(Boolean);

// DIT START DE LUS DIRECT OP DE ACHTERGROND, ONAFHANKELIJK VAN DISCORD
console.log('📡 De Roblox-controlelus is direct gestart op de achtergrond.');
checkRobloxStatusDirect();
setInterval(checkRobloxStatusDirect, checkInterval);

client.once(Events.ClientReady, () => {
    console.log('🤖 Bot is succesvol opgestart als ' + client.user.tag + '!');
    console.log('📡 Ik volg momenteel ' + usersToMonitor.length + ' Roblox spelers.');
});

async function checkRobloxStatusDirect() {
    try {
        const idLijst = usersToMonitor.map(u => u.id).join(',');
        if (!idLijst) return;

        // HIER STAAT NU DE VOLLEDIGE, CORRECTE ROBLOX LINK
        const completeUrl = 'https://roblox.com' + idLijst + '&size=150x150&format=Png&isCircular=false';
        
        const response = await axios.get(completeUrl, { timeout: 5000 });

        if (!response.data || !response.data.data) return;

        response.data.data.forEach(playerData => {
            const monitoredUser = usersToMonitor.find(u => u.id === playerData.targetId.toString());
            if (!monitoredUser) return;

            // Log de status live in Railway om te zien dat er data binnenkomt
            console.log('[LOG] Status voor ' + monitoredUser.name + ': ' + playerData.state);
        });
    } catch (error) {
        console.log('📡 Statusbericht: ' + error.message);
    }
}

client.login(token);
