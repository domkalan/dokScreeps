import { ScreepsHttpClient, ScreepsSocketClient } from 'screeps-api'
import he from 'he';
import fs from 'node:fs';
import path from 'node:path';

// Configuration
const TOKEN = JSON.parse(fs.readFileSync(path.resolve('./screeps.json'), 'utf8')).main.token;
const LOG_FILE = path.resolve('./data/screeps_json_log.jsonl'); // Saves as JSON Lines format
let DATA_COLLECTED = 0;

async function main() {
    // count the lines in the log file to determine how many performance data entries have already been collected
    if (fs.existsSync(LOG_FILE)) {
        const fileContent = fs.readFileSync(LOG_FILE, 'utf8');
        DATA_COLLECTED = fileContent.split('\n').filter(line => line.trim() !== '').length;

        console.log(`Existing log file found. Already collected ${DATA_COLLECTED} performance data entries.`);
    }

    // create the api client
    const api = await ScreepsHttpClient.fromConfig('main', { app: 'dokScreeps-performance-tracker' });

    // get the details of the current user
    const user = await api.authMe();
    console.log(`Authenticated as user: ${user.username}`);

    // listen for WebSocket events
    api.socket.on(ScreepsSocketClient.CONNECTED, () => {
        console.log('WebSocket client connected')
    })
    api.socket.on(ScreepsSocketClient.DISCONNECTED, () => {
        console.log('WebSocket client disconnected')
    })
    api.socket.on(ScreepsSocketClient.AUTH, (event) => {
        // Contains either 'ok' or 'failed'
        console.log('WebSocket auth:', event.data.status)
    })

    // Subscribe to console events
    function onConsole(event) {
        const { messages, error, shard } = event.data
        const shardTag = shard ? `[${shard}] ` : ''

        if (error) console.error(shardTag + error)

        // messages is undefined if nothing was logged or evaluated
        if (!messages) return

        for (const message of messages.log) {
            // Decode HTML entities in the message
            const decodedMessage = he.decode(message)

            if (!decodedMessage.startsWith('perfTickData: ')) {
                console.log(shardTag + decodedMessage)

                continue;
            }

            try {
                const perfData = JSON.parse(decodedMessage.replace('perfTickData: ', ''));
                DATA_COLLECTED++;

                console.log(shardTag + `Performance data collected (${DATA_COLLECTED})`);

                // write the performance data to a JSON Lines file
                fs.appendFileSync(LOG_FILE, JSON.stringify({ shard: shard || null, ...perfData }) + '\n', 'utf8');
            } catch (err) {
                console.error(shardTag + 'Error parsing performance data:', err)
            }
        }
    }

    api.socket.subscribeUserConsole(onConsole)

    // create the socket client
    await api.socket.connect()
}

main();