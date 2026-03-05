const WebSocket = require('ws');
const { io } = require('socket.io-client');
const readline = require('readline');

// Non-interactive mode (for Launcher): channel ID from environment variable
if (process.env.BRIDGE_NONINTERACTIVE === '1' && process.env.BRIDGE_CHANNEL_ID) {
    const channelId = process.env.BRIDGE_CHANNEL_ID.trim().toLowerCase();
    console.log(`[Híd] Launcher mód — Csatorna: ${channelId}`);
    startBridge(channelId);
} else {
    // Interactive mode (for .bat file): ask for channel name
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("==================================================");
    console.log("      STREAM RPG ENGINE - FELHŐ HÍD (BRIDGE)      ");
    console.log("==================================================");
    console.log("Ez a kis program összeköti a te gépeden futó");
    console.log("Streamer.bot-ot a Felhőben (Vercel/Render) futó");
    console.log("szerverrel. Nincs szükség Ngrok-ra vagy Port");
    console.log("Forwardra! A program automatikusan fut a háttérben.");
    console.log("==================================================\n");

    rl.question('Kérlek add meg a csatornád nevét (pl. Papi): ', (channelId) => {
        if (!channelId) {
            console.log("Hiba: Nem adtál meg csatornanevet. Indítsd újra a programot!");
            process.exit(1);
        }
        channelId = channelId.trim().toLowerCase();
        rl.close();
        startBridge(channelId);
    });
}

function startBridge(channelId) {

    // Ide tedd be a végleges felhős API url-edet:
    const backendUrl = 'https://papigame.onrender.com';
    const localWsUrl = 'ws://127.0.0.1:8080/';

    console.log(`\n[Híd] Csatlakozás a felhős szerverhez: ${backendUrl} ...`);
    const socket = io(backendUrl);

    socket.on('connect', () => {
        console.log(`[Híd] Sikeresen csatlakozva a felhőhöz! (ID: ${socket.id})`);
        socket.emit('joinRoom', channelId);

        console.log(`[Híd] Csatlakozás a helyi Streamer.bot-hoz: ${localWsUrl} ...`);
        connectToStreamerBot(channelId, localWsUrl, socket);
    });

    socket.on('connect_error', (err) => {
        console.error(`[Híd] Hiba a felhős csatlakozáskor: ${err.message}`);
    });
}

function connectToStreamerBot(channelId, wsUrl, socket) {
    let ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log(`[Híd] Sikeres csatlakozás a Streamer.bot-hoz! Feliratkozás chat eseményekre...`);
        // Feliratkozás MINDEN eseményre minden platformon
        ws.send(JSON.stringify({
            request: 'Subscribe',
            events: {
                Twitch: [
                    'ChatMessage', 'ChatClear', 'ChatRoom', 'ChatSettingsUpdate',
                    'ChatUserTimeout', 'ChatUserBan', 'Announcement', 'Whisper',
                    'AutoModMessageHeld', 'AutoModMessageUpdate',
                    'Follow', 'Subscription', 'Resubscription',
                    'GiftSubscription', 'MassGiftSubscription', 'PrimeCommunityGiftReceived',
                    'Cheer', 'BitsBadgeTier',
                    'RewardRedeemed', 'AutomaticRewardRedemption',
                    'Raid',
                    'HypeTrainBegin', 'HypeTrainProgress', 'HypeTrainEnd', 'HypeTrainVictory',
                    'PollBegin', 'PollProgress', 'PollReady', 'PollStarted', 'PollTerminated', 'PollUpdated',
                    'PredictionCreated', 'PredictionCancelled', 'PredictionLocked',
                    'PredictionProgress', 'PredictionReady', 'PredictionRefunded',
                    'PredictionStarted', 'PredictionTerminated', 'PredictionUpdated',
                    'StreamOnline', 'StreamOffline', 'StreamTitleUpdate', 'StreamViewerCountUpdate',
                    'ClipCreated', 'AdRun', 'UserUpdate',
                    'BetterTTVEmoteAdded', 'BetterTTVEmoteRemoved',
                    'FrankerFaceZEmoteAdded', 'FrankerFaceZEmoteRemoved',
                    'SevenTVEmoteAdded', 'SevenTVEmoteRemoved'
                ],
                YouTube: [
                    'ChatMessage', 'Message', 'FirstWords',
                    'SuperChat', 'SuperSticker',
                    'NewSponsor', 'NewSubscriber', 'Gift', 'GiftMembershipReceived', 'MemberMilestone',
                    'BroadcastStarted', 'BroadcastEnded', 'BroadcastUpdated', 'BroadcastStatisticsUpdated',
                    'PollStarted', 'PollUpdated', 'PollClosed',
                    'UserBanned', 'SponsorOnlyStarted', 'SponsorOnlyEnded',
                    'PresentViewers'
                ],
                Kick: [
                    'ChatMessage', 'Message', 'FirstWords',
                    'Follow', 'Subscription', 'Resubscription',
                    'GiftSubscription', 'MassGiftSubscription', 'KicksGifted',
                    'StreamOnline', 'StreamOffline', 'ViewerCountUpdate', 'ChannelUpdate',
                    'UserBanned', 'UserTimedOut',
                    'SeventvEmoteAdded', 'SeventvEmoteRemoved',
                    'PresentViewers'
                ],
                Trovo: [
                    'ChatMessage', 'Message', 'FirstWords',
                    'Follow', 'Subscription', 'Resubscription',
                    'GiftSubscription', 'MassGiftSubscription',
                    'Raid',
                    'SpellCast', 'CustomSpellCast',
                    'StreamOnline', 'StreamOffline',
                    'PresentViewers'
                ]
            },
            id: 'bridge-sub'
        }));

        console.log("\n==================================================");
        console.log("✅ MINDEN KÉSZEN ÁLL! A HÍD AKTÍV ÉS MŰKÖDIK!");
        console.log("✅ Most már nyugodtan bezárhatod ezt az ablakot a");
        console.log("✅ tálcára letéve, és megnyithatod a weboldalt a");
        console.log("✅ Vercelen! A chat játékok működni fognak!");
        console.log("==================================================\n");
    });

    ws.on('message', (data) => {
        try {
            const payload = JSON.parse(data.toString());
            // Ha a Streamer.bot-tól jött egy releváns esemény, azonnal lőjük is fel a felhőnek!
            if (payload.event) {
                const platform = payload.event?.source || 'Unknown';
                console.log(`[Híd] Event átküldve a felhőbe: ${payload.event?.type || payload.event} (Platform: ${platform})`);

                if (platform === 'YouTube' || platform === 'youtube') {
                    console.log(`[YOUTUBE KÉM DATA]: ${JSON.stringify(payload.data || payload)}`);
                }

                socket.emit('botProxyEvent', {
                    channelId: channelId,
                    payload: payload
                });
            }
        } catch (e) {
            // parse error, ignore
        }
    });

    ws.on('error', (err) => {
        console.error('\n[Híd] Hiba a Streamer.bot kapcsolatban!', err.message);
        console.log('Futtatod a Streamer.bot programot? Be van kapcsolva benne a WebSocket Server?');
    });

    ws.on('close', () => {
        console.log('[Híd] A Streamer.bot kapcsolat megszakadt. Újrapróbálkozás 5 másodperc múlva...');
        setTimeout(() => connectToStreamerBot(channelId, wsUrl, socket), 5000);
    });

    // Ha a szerverről jön üzenet kifelé a chatedbe, a híd átveszi és leadja a Streamer.bot-nak
    socket.on('botMessageOutbound', (event) => {
        if (event.channelId === channelId && ws.readyState === WebSocket.OPEN) {
            const actionName = event.action || 'RPG Chat';
            const actionArgs = event.actionArgs || { message: event.message };
            console.log(`[Híd] DoAction: "${actionName}" → Streamer.bot`);
            ws.send(JSON.stringify({
                request: 'DoAction',
                action: {
                    name: actionName
                },
                args: actionArgs,
                id: `bridge-${Date.now()}`
            }));
        }
    });
}
