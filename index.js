import os
import requests
import discord
from discord.ext import tasks



DISCORD_CHANNEL_ID = int(os.getenv("DISCORD_CHANNEL_ID", "1540280209994162286"))

ROBLOX_USERS = {3055067105:BlackwidowX05,1545919573:mittimmy,355852663:degamer567890}

for entry in os.getenv("ROBLOX_USERS", "").split(","):
    entry = entry.strip()

    if not entry:
        continue

    try:
        user_id, username = entry.split(":", 1)
        ROBLOX_USERS[int(user_id.strip())] = username.strip()
    except ValueError:
        print(
            "WARNING: Invalid ROBLOX_USERS entry. "
            "Use ID:Username,ID:Username"
        )

CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "15"))
FAILED_CHECKS_REQUIRED = int(
    os.getenv("FAILED_CHECKS_REQUIRED", "3")
)

intents = discord.Intents.default()
client = discord.Client(intents=intents)



session_active = False
players_in_session = set()
failed_checks = 0
shutdown_notified = False


def get_presences():
    if not ROBLOX_USERS:
        raise RuntimeError("No Roblox users have been configured.")

    response = requests.post(
        "https://presence.roblox.com/v1/presence/users",
        json={"userIds": list(ROBLOX_USERS.keys())},
        timeout=10
    )

    response.raise_for_status()

    return response.json()["userPresences"]


def find_players():
    presences = get_presences()
    found = []

    for presence in presences:
        user_id = presence["userId"]

        if user_id not in ROBLOX_USERS:
            continue

      
        if presence.get("userPresenceType") == 2:
            found.append({
                "user_id": user_id,
                "name": ROBLOX_USERS[user_id]
            })

    return found


async def get_alert_channel():
    try:
        channel = await client.fetch_channel(DISCORD_CHANNEL_ID)
        return channel
    except Exception as error:
        print("ERROR getting Discord channel:", error)
        return None


async def send_startup_message():
    channel = await get_alert_channel()

    if channel is None:
        return

    await channel.send(
        "🟢 **Roblox Server Monitor is online!**\n"
        "I am now monitoring the configured Roblox players."
    )

    print("Startup message sent to Discord.")


async def send_shutdown_message():
    global shutdown_notified

    if shutdown_notified:
        return

    channel = await get_alert_channel()

    if channel is None:
        return

    names = ", ".join(sorted(players_in_session))

    message = (
        "@everyone\n"
        "🔴 **Roblox private server may have shut down!**\n\n"
        "**Players previously detected:** "
        f"{names}\n\n"
        "None of the monitored players have been detected "
        f"in-game for {FAILED_CHECKS_REQUIRED * CHECK_INTERVAL} seconds.\n\n"
        "⚠️ This uses Roblox's public presence API, so it "
        "detects when the monitored players stop appearing "
        "in-game. It does not directly verify a specific "
        "private-server instance."
    )

    await channel.send(
        message,
        allowed_mentions=discord.AllowedMentions(everyone=True)
    )

    print("🚨 SHUTDOWN ALERT SENT TO DISCORD!")

    shutdown_notified = True



@tasks.loop(seconds=CHECK_INTERVAL)
async def monitor_servers():
    global session_active
    global players_in_session
    global failed_checks
    global shutdown_notified

    try:
        players = find_players()

        print("---- Roblox check ----")

        if players:
            names = ", ".join(
                player["name"] for player in players
            )
            print(f"Players currently in-game: {names}")
        else:
            print("None of the monitored players are currently in-game.")

      
        if not session_active:
            if players:
                session_active = True

                players_in_session = {
                    player["name"] for player in players
                }

                failed_checks = 0
                shutdown_notified = False

                print(
                    "Monitoring session started: "
                    + ", ".join(sorted(players_in_session))
                )

            return

       
        if players:
            failed_checks = 0

            for player in players:
                players_in_session.add(player["name"])

            print("Session still active.")
            return

       
        failed_checks += 1

        print(
            f"Nobody detected "
            f"({failed_checks}/{FAILED_CHECKS_REQUIRED})"
        )

        if failed_checks >= FAILED_CHECKS_REQUIRED:
            print("Possible server shutdown detected.")

            await send_shutdown_message()

            session_active = False
            players_in_session.clear()
            failed_checks = 0

    except Exception as error:
        print("Roblox check error:", error)
        # API errors do not count toward shutdown detection.

@client.event
async def on_ready():
    print("----------------------------------------")
    print("Roblox Server Monitor is online!")
    print(f"Logged in as: {client.user}")
    print("----------------------------------------")

    await send_startup_message()

    if not monitor_servers.is_running():
        monitor_servers.start()



TOKEN = os.getenv("DISCORD_BOT_TOKEN")

if not TOKEN:
    print(
        "ERROR: DISCORD_BOT_TOKEN environment variable "
        "has not been configured."
    )
else:
    client.run(TOKEN)
