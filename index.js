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

console.log('📡 De Roblox-controlelus is direct gestart op de achtergrond.');
checkRobloxStatusDirect();
setInterval(checkRobloxStatusDirect, checkInterval);

client.once(Events.ClientReady, () => {
    console.log('🤖 Bot is succesvol opgestart als ' + client.user.tag + '!');
    console.log('📡 Ik volg momenteel ' + usersToMonitor.length + ' Roblox spelers.');
});

async function checkRobloxStatusDirect() {
    try {
        const idList = usersToMonitor.map(u => u.id);

        if (!idList.length) return;

        const response = await axios.post(
            'https://presence.roblox.com/v1/presence/users',
            {
                userIds: idList
            },
            {
                timeout: 5000
            }
        );

        const presences = response.data.userPresences;

        if (!presences) return;

        presences.forEach(presence => {
            const monitoredUser = usersToMonitor.find(
                u => u.id === presence.userId.toString()
            );

            if (!monitoredUser) return;

            const state = presence.userPresenceType;

            let status;

            if (state === 2) {
                status = 'In Game';
            } else if (state === 1) {
                status = 'Online';
            } else if (state === 4) {
                status = 'In Studio';
            } else {
                status = 'Offline';
            }

            console.log(
                [LOG] Status voor ${monitoredUser.name}: ${status}
            );
        });

    } catch (error) {
        console.log(
            '⚠️ Statusbericht:',
            error.message
        );
    }
}
