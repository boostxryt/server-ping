const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// Controleer of de belangrijkste variabelen aanwezig zijn
if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CHANNEL_ID || !process.env.ROBLOX_USERS) {
    console.error("Fout: Misbepaalde omgevingsvariabelen! Controleer DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID en ROBLOX_USERS op Render.");
    process.exit(1);
}

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
const usersToMonitor = process.env.ROBLOX_USERS.split(',').map(u => {
    const [id, name] = u.split(':');
    return { id: id.trim(), name: name.trim(), isOnline: false };
});

client.once('ready', () => {
    console.log(`🤖 Bot is succesvol opgestart als ${client.user.tag}!`);
    console.log(`👀 Ik volg momenteel ${usersToMonitor.length} Roblox spelers.`);
    
    // Start de herhalende controle
    checkRobloxPresence();
    setInterval(checkRobloxPresence, checkInterval);
});

async function checkRobloxPresence() {
    try {
        const userIds = usersToMonitor.map(u => parseInt(u.id));
        const response = await axios.post('https://roproxy.com', { userIds });
        
        if (!response.data || !response.data.userPresences) return;

        const channel = await client.channels.fetch(channelId);
        if (!channel) return console.error("Discord kanaal niet gevonden!");

        response.data.userPresences.forEach(presence => {
            const monitoredUser = usersToMonitor.find(u => u.id === presence.userId.toString());
            if (!monitoredUser) return;

            // Type 0 = Offline, 1 = Website, 2 = In Game, 3 = Studio
            const currentlyOnline = presence.userPresenceType > 0;

            if (currentlyOnline && !monitoredUser.isOnline) {
                // Speler is net online gekomen!
                monitoredUser.isOnline = true;
                let statusText = "online op Roblox";
                if (presence.userPresenceType === 2) statusText = `aan het spelen in game: **${presence.lastLocation || 'Onbekende Game'}**`;
                
                channel.send(`🎮 **${monitoredUser.name}** is zojuist ${statusText}!`);
                console.log(`[ALERT] ${monitoredUser.name} is online gegaan.`);
            } else if (!currentlyOnline && monitoredUser.isOnline) {
                // Speler is offline gegaan
                monitoredUser.isOnline = false;
                console.log(`[INFO] ${monitoredUser.name} is offline gegaan.`);
            }
        });
    } catch (error) {
        console.error("Fout bij het ophalen van Roblox status:", error.message);
    }
}

client.login(token);

